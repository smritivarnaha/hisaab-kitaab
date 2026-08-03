import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) throw new Error('No database connection string found in environment variables.');
  return neon(connectionString);
}

async function ensureTableExists(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      "id" TEXT PRIMARY KEY,
      "amount" NUMERIC NOT NULL,
      "currency" TEXT NOT NULL DEFAULT '₹',
      "type" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "merchant" TEXT,
      "paymentMethod" TEXT NOT NULL DEFAULT 'UPI',
      "date" TEXT NOT NULL,
      "relativeDateText" TEXT,
      "timestamp" BIGINT NOT NULL,
      "confidenceScore" NUMERIC,
      "rawInput" TEXT,
      "shortDisplayTitle" TEXT,
      "notes" TEXT,
      "isPending" BOOLEAN NOT NULL DEFAULT FALSE,
      "person" TEXT,
      "userId" TEXT NOT NULL DEFAULT 'nandini'
    )
  `;
  try {
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "isPending" BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "person" TEXT`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'nandini'`;
  } catch (err) {
    console.warn("Alter table error:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let sql: ReturnType<typeof neon>;
  try {
    sql = getDb();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  try {
    await ensureTableExists(sql);

    const userId = (req.query.userId || req.headers['x-user-id'] || 'nandini') as string;

    // ── GET — fetch all transactions for specific user ────────────────────────
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM transactions WHERE "userId" = ${userId} ORDER BY timestamp DESC`;
      const parsed = rows.map((row: any) => ({
        ...row,
        amount: Number(row.amount),
        confidenceScore: row.confidenceScore != null ? Number(row.confidenceScore) : null,
        timestamp: Number(row.timestamp),
        isPending: Boolean(row.isPending)
      }));
      return res.status(200).json(parsed);
    }

    // ── POST — upsert a single transaction for specific user ─────────────────
    if (req.method === 'POST') {
      const body = req.body;
      if (!body?.id) return res.status(400).json({ error: 'Missing transaction id' });

      const txUserId = body.userId || userId;

      await sql`
        INSERT INTO transactions (
          "id","amount","currency","type","category","title","merchant",
          "paymentMethod","date","relativeDateText","timestamp","confidenceScore",
          "rawInput","shortDisplayTitle","notes","isPending","person","userId"
        ) VALUES (
          ${body.id}, ${body.amount}, ${body.currency || '₹'}, ${body.type},
          ${body.category}, ${body.title}, ${body.merchant || null},
          ${body.paymentMethod || 'UPI'}, ${body.date}, ${body.relativeDateText || null},
          ${body.timestamp}, ${body.confidenceScore || null}, ${body.rawInput || null},
          ${body.shortDisplayTitle || null}, ${body.notes || null},
          ${body.isPending || false}, ${body.person || null}, ${txUserId}
        )
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
          "person" = EXCLUDED."person",
          "userId" = EXCLUDED."userId"
      `;
      return res.status(200).json({ success: true, id: body.id });
    }

    // ── PUT — upsert a batch of transactions ─────────────────────────────────
    if (req.method === 'PUT') {
      const list = req.body;
      if (!Array.isArray(list)) return res.status(400).json({ error: 'Body must be an array' });

      await Promise.all(list.map((body: any) => {
        if (!body?.id) return Promise.resolve();
        const txUserId = body.userId || userId;
        return sql`
          INSERT INTO transactions (
            "id","amount","currency","type","category","title","merchant",
            "paymentMethod","date","relativeDateText","timestamp","confidenceScore",
            "rawInput","shortDisplayTitle","notes","isPending","person","userId"
          ) VALUES (
            ${body.id}, ${body.amount}, ${body.currency || '₹'}, ${body.type},
            ${body.category}, ${body.title}, ${body.merchant || null},
            ${body.paymentMethod || 'UPI'}, ${body.date}, ${body.relativeDateText || null},
            ${body.timestamp}, ${body.confidenceScore || null}, ${body.rawInput || null},
            ${body.shortDisplayTitle || null}, ${body.notes || null},
            ${body.isPending || false}, ${body.person || null}, ${txUserId}
          )
          ON CONFLICT ("id") DO UPDATE SET
            "amount" = EXCLUDED."amount",
            "type" = EXCLUDED."type",
            "category" = EXCLUDED."category",
            "title" = EXCLUDED."title",
            "timestamp" = EXCLUDED."timestamp",
            "isPending" = EXCLUDED."isPending",
            "userId" = EXCLUDED."userId"
        `;
      }));
      return res.status(200).json({ success: true, count: list.length });
    }

    // ── DELETE — remove a single transaction ─────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM transactions WHERE "id" = ${id} AND "userId" = ${userId}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
}
