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

async function ensureTableExists(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      "key" TEXT PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updated_at" BIGINT NOT NULL DEFAULT 0
    )
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let sql: ReturnType<typeof neon>;
  try { sql = getDb(); } catch (err: any) { return res.status(500).json({ error: err.message }); }

  try {
    await ensureTableExists(sql);

    // GET — return all settings as a flat object
    if (req.method === 'GET') {
      const rows = await sql`SELECT "key", "value" FROM app_settings`;
      const result: Record<string, any> = {};
      for (const row of rows as any[]) {
        try { result[row.key] = JSON.parse(row.value); }
        catch { result[row.key] = row.value; }
      }
      return res.status(200).json(result);
    }

    // POST — upsert all settings from body object
    if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Body must be an object' });
      const now = Date.now();
      await Promise.all(
        Object.entries(body).map(([key, value]) =>
          sql`
            INSERT INTO app_settings ("key", "value", "updated_at")
            VALUES (${key}, ${JSON.stringify(value)}, ${now})
            ON CONFLICT ("key") DO UPDATE SET
              "value" = EXCLUDED."value",
              "updated_at" = EXCLUDED."updated_at"
          `
        )
      );
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Settings API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
