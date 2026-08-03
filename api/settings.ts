import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error('No database connection string found.');
  return neon(connectionString);
}

async function ensureTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      "id" TEXT PRIMARY KEY,
      "settingsJson" TEXT NOT NULL,
      "updatedAt" BIGINT NOT NULL,
      "userId" TEXT NOT NULL DEFAULT 'nandini'
    )
  `;
  try {
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'nandini'`;
  } catch {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let sql: ReturnType<typeof neon>;
  try { sql = getDb(); } catch (err: any) { return res.status(500).json({ error: err.message }); }

  try {
    await ensureTable(sql);

    const userId = (req.query.userId || req.headers['x-user-id'] || 'nandini') as string;

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM user_settings WHERE "userId" = ${userId} OR "id" = ${'settings_' + userId} LIMIT 1
      `;
      if (!rows.length) return res.status(200).json(null);
      try {
        const parsed = JSON.parse(rows[0].settingsJson);
        return res.status(200).json(parsed);
      } catch {
        return res.status(200).json(null);
      }
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body) return res.status(400).json({ error: 'Missing settings payload' });

      const settingsId = 'settings_' + userId;
      const jsonStr = JSON.stringify(body);
      const now = Date.now();

      await sql`
        INSERT INTO user_settings ("id", "settingsJson", "updatedAt", "userId")
        VALUES (${settingsId}, ${jsonStr}, ${now}, ${userId})
        ON CONFLICT ("id") DO UPDATE SET
          "settingsJson" = EXCLUDED."settingsJson",
          "updatedAt" = EXCLUDED."updatedAt",
          "userId" = EXCLUDED."userId"
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Settings API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
