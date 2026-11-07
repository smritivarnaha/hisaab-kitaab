import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    throw new Error('Database connection string is missing. Please set POSTGRES_URL in environment variables.');
  }

  return neon(connectionString);
}

function canonicalEnteredBy(userId: string, providedEnteredBy?: string | null): string {
  const cleanUid = (userId || '').toLowerCase().trim();
  if (cleanUid === 'praveen') return 'Praveen';
  if (cleanUid === 'sarthak') return 'Sarthak';
  if (cleanUid === 'nandini') return 'Nandini';
  return (providedEnteredBy || '').trim() || 'Praveen';
}

let tableInitialized = false;

async function ensureTableExists(sql: ReturnType<typeof neon>) {
  if (tableInitialized) return;
  try {
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
        "userId" TEXT NOT NULL DEFAULT 'nandini',
        "mode" TEXT DEFAULT 'personal',
        "enteredBy" TEXT
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_tx_query ON transactions ("userId", "mode", "timestamp" DESC)`;
    tableInitialized = true;
  } catch (err) {
    console.warn("Table initialization error:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let sql: any;
  try {
    sql = getDb();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  try {
    if (!tableInitialized) {
      await ensureTableExists(sql);
    }

    const rawUserId = (req.query.userId || req.headers['x-user-id'] || 'nandini') as string;
    const userId = rawUserId.toLowerCase().trim();
    const isPartner = userId === 'praveen' || userId === 'sarthak';

    // ── GET — fetch user's own transactions + CONFIRMED shared business ledger (never leak another partner's unconfirmed pending drafts) ──
    if (req.method === 'GET') {
      const rows: any = isPartner
        ? await sql`SELECT * FROM transactions WHERE "userId" = ${userId} OR ("mode" = 'business' AND "isPending" = FALSE) ORDER BY timestamp DESC`
        : await sql`SELECT * FROM transactions WHERE "userId" = ${userId} AND ("mode" IS NULL OR "mode" != 'business') ORDER BY timestamp DESC`;
      const parsed = rows.map((row: any) => ({
        ...row,
        amount: Number(row.amount),
        confidenceScore: row.confidenceScore != null ? Number(row.confidenceScore) : null,
        timestamp: Number(row.timestamp),
        isPending: Boolean(row.isPending),
        mode: row.mode || 'personal',
        enteredBy: row.enteredBy || canonicalEnteredBy(row.userId)
      }));
      return res.status(200).json(parsed);
    }

    // ── POST — upsert a single transaction for specific user ─────────────────
    if (req.method === 'POST') {
      const body = req.body;
      if (!body?.id) return res.status(400).json({ error: 'Missing transaction id' });

      const txUserId = ((body.userId || userId) as string).toLowerCase().trim();
      const safeMode = isPartner ? (body.mode || 'personal') : 'personal';
      // Canonicalize enteredBy from txUserId so a 'praveen' entry can NEVER be saved as 'Sarthak' (and vice versa)
      const safeEnteredBy = canonicalEnteredBy(txUserId, body.enteredBy);

      await sql`
        INSERT INTO transactions (
          "id","amount","currency","type","category","title","merchant",
          "paymentMethod","date","relativeDateText","timestamp","confidenceScore",
          "rawInput","shortDisplayTitle","notes","isPending","person","userId","mode","enteredBy"
        ) VALUES (
          ${body.id}, ${body.amount}, ${body.currency || '₹'}, ${body.type},
          ${body.category}, ${body.title}, ${body.merchant || null},
          ${body.paymentMethod || 'UPI'}, ${body.date}, ${body.relativeDateText || null},
          ${body.timestamp}, ${body.confidenceScore || null}, ${body.rawInput || null},
          ${body.shortDisplayTitle || null}, ${body.notes || null},
          ${body.isPending || false}, ${body.person || null}, ${txUserId}, ${safeMode}, ${safeEnteredBy}
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
          "userId" = CASE WHEN transactions."isPending" = TRUE THEN EXCLUDED."userId" ELSE transactions."userId" END,
          "mode" = EXCLUDED."mode",
          "enteredBy" = EXCLUDED."enteredBy"
        WHERE transactions."isPending" = TRUE OR transactions."userId" = ${userId}
      `;
      return res.status(200).json({ success: true, id: body.id });
    }

    // ── PUT — upsert a batch of transactions ─────────────────────────────────
    if (req.method === 'PUT') {
      const list = req.body;
      if (!Array.isArray(list)) return res.status(400).json({ error: 'Body must be an array' });

      await Promise.all(list.map((body: any) => {
        if (!body?.id) return Promise.resolve();
        const txUserId = ((body.userId || userId) as string).toLowerCase().trim();
        const safeMode = isPartner ? (body.mode || 'personal') : 'personal';
        const safeEnteredBy = canonicalEnteredBy(txUserId, body.enteredBy);
        return sql`
          INSERT INTO transactions (
            "id","amount","currency","type","category","title","merchant",
            "paymentMethod","date","relativeDateText","timestamp","confidenceScore",
            "rawInput","shortDisplayTitle","notes","isPending","person","userId","mode","enteredBy"
          ) VALUES (
            ${body.id}, ${body.amount}, ${body.currency || '₹'}, ${body.type},
            ${body.category}, ${body.title}, ${body.merchant || null},
            ${body.paymentMethod || 'UPI'}, ${body.date}, ${body.relativeDateText || null},
            ${body.timestamp}, ${body.confidenceScore || null}, ${body.rawInput || null},
            ${body.shortDisplayTitle || null}, ${body.notes || null},
            ${body.isPending || false}, ${body.person || null}, ${txUserId}, ${safeMode}, ${safeEnteredBy}
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
            "userId" = CASE WHEN transactions."isPending" = TRUE THEN EXCLUDED."userId" ELSE transactions."userId" END,
            "mode" = EXCLUDED."mode",
            "enteredBy" = EXCLUDED."enteredBy"
          WHERE transactions."isPending" = TRUE OR transactions."userId" = ${userId}
        `;
      }));
      return res.status(200).json({ success: true, count: list.length });
    }

    // ── DELETE — remove a single transaction (only owner/creator can delete) ─
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
      const myCanonicalName = canonicalEnteredBy(userId);
      if (isPartner) {
        await sql`DELETE FROM transactions WHERE "id" = ${id} AND ("userId" = ${userId} OR LOWER(COALESCE("enteredBy", '')) = LOWER(${myCanonicalName}))`;
      } else {
        await sql`DELETE FROM transactions WHERE "id" = ${id} AND "userId" = ${userId} AND ("mode" IS NULL OR "mode" != 'business')`;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
}
