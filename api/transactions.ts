import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// Neon database connection pool
// Will use DATABASE_URL or NEON_DATABASE_URL environment variable
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let pool: Pool | null = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Neon serverless connections
    }
  });
}

// Helper to ensure the transactions table exists
async function ensureTableExists(clientPool: Pool) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      "id" TEXT PRIMARY KEY,
      "amount" NUMERIC NOT NULL,
      "currency" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "merchant" TEXT,
      "paymentMethod" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "relativeDateText" TEXT,
      "timestamp" BIGINT NOT NULL,
      "confidenceScore" NUMERIC,
      "rawInput" TEXT,
      "shortDisplayTitle" TEXT,
      "notes" TEXT,
      "isPending" BOOLEAN NOT NULL DEFAULT FALSE,
      "person" TEXT
    );
  `;
  await clientPool.query(createTableQuery);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!pool) {
    return res.status(500).json({ 
      error: 'Database connection configuration missing. Please set DATABASE_URL or NEON_DATABASE_URL environment variable.' 
    });
  }

  try {
    // Auto-create table if not exists on first request
    await ensureTableExists(pool);

    const { method } = req;

    switch (method) {
      case 'GET': {
        const result = await pool.query('SELECT * FROM transactions ORDER BY timestamp DESC');
        // Parse database values to make sure numbers are returned properly
        const rows = result.rows.map(row => ({
          ...row,
          amount: Number(row.amount),
          confidenceScore: row.confidenceScore !== null ? Number(row.confidenceScore) : null,
          timestamp: Number(row.timestamp),
          isPending: Boolean(row.isPending)
        }));
        return res.status(200).json(rows);
      }

      case 'POST': {
        const body = req.body;
        if (!body || !body.id) {
          return res.status(400).json({ error: 'Invalid transaction payload' });
        }

        const insertQuery = `
          INSERT INTO transactions (
            "id", "amount", "currency", "type", "category", "title", "merchant", 
            "paymentMethod", "date", "relativeDateText", "timestamp", "confidenceScore", 
            "rawInput", "shortDisplayTitle", "notes", "isPending", "person"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT ("id") DO UPDATE SET
            "amount" = EXCLUDED."amount",
            "currency" = EXCLUDED."currency",
            "type" = EXCLUDED."type",
            "category" = EXCLUDED."category",
            "title" = EXCLUDED."title",
            "merchant" = EXCLUDED."merchant",
            "paymentMethod" = EXCLUDED."paymentMethod",
            "date" = EXCLUDED."date",
            "relativeDateText" = EXCLUDED."relativeDateText",
            "timestamp" = EXCLUDED."timestamp",
            "confidenceScore" = EXCLUDED."confidenceScore",
            "rawInput" = EXCLUDED."rawInput",
            "shortDisplayTitle" = EXCLUDED."shortDisplayTitle",
            "notes" = EXCLUDED."notes",
            "isPending" = EXCLUDED."isPending",
            "person" = EXCLUDED."person"
          RETURNING *;
        `;

        const values = [
          body.id,
          body.amount,
          body.currency,
          body.type,
          body.category,
          body.title,
          body.merchant || null,
          body.paymentMethod,
          body.date,
          body.relativeDateText || null,
          body.timestamp,
          body.confidenceScore || null,
          body.rawInput || null,
          body.shortDisplayTitle || null,
          body.notes || null,
          body.isPending || false,
          body.person || null
        ];

        const result = await pool.query(insertQuery, values);
        const saved = {
          ...result.rows[0],
          amount: Number(result.rows[0].amount),
          confidenceScore: result.rows[0].confidenceScore !== null ? Number(result.rows[0].confidenceScore) : null,
          timestamp: Number(result.rows[0].timestamp),
          isPending: Boolean(result.rows[0].isPending)
        };
        return res.status(200).json(saved);
      }

      case 'PUT': {
        // Batch sync endpoint: saves or updates multiple transactions at once
        const list = req.body;
        if (!Array.isArray(list)) {
          return res.status(400).json({ error: 'Body must be an array of transactions' });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const body of list) {
            const upsertQuery = `
              INSERT INTO transactions (
                "id", "amount", "currency", "type", "category", "title", "merchant", 
                "paymentMethod", "date", "relativeDateText", "timestamp", "confidenceScore", 
                "rawInput", "shortDisplayTitle", "notes", "isPending", "person"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              ON CONFLICT ("id") DO UPDATE SET
                "amount" = EXCLUDED."amount",
                "currency" = EXCLUDED."currency",
                "type" = EXCLUDED."type",
                "category" = EXCLUDED."category",
                "title" = EXCLUDED."title",
                "merchant" = EXCLUDED."merchant",
                "paymentMethod" = EXCLUDED."paymentMethod",
                "date" = EXCLUDED."date",
                "relativeDateText" = EXCLUDED."relativeDateText",
                "timestamp" = EXCLUDED."timestamp",
                "confidenceScore" = EXCLUDED."confidenceScore",
                "rawInput" = EXCLUDED."rawInput",
                "shortDisplayTitle" = EXCLUDED."shortDisplayTitle",
                "notes" = EXCLUDED."notes",
                "isPending" = EXCLUDED."isPending",
                "person" = EXCLUDED."person";
            `;
            const values = [
              body.id,
              body.amount,
              body.currency,
              body.type,
              body.category,
              body.title,
              body.merchant || null,
              body.paymentMethod,
              body.date,
              body.relativeDateText || null,
              body.timestamp,
              body.confidenceScore || null,
              body.rawInput || null,
              body.shortDisplayTitle || null,
              body.notes || null,
              body.isPending || false,
              body.person || null
            ];
            await client.query(upsertQuery, values);
          }
          await client.query('COMMIT');
          return res.status(200).json({ success: true, count: list.length });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }

      case 'DELETE': {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Missing active transaction id for deletion' });
        }
        await pool.query('DELETE FROM transactions WHERE "id" = $1', [id]);
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(455).end(`Method ${method} Not Allowed`);
    }
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal Database Server Error', details: err.message });
  }
}
