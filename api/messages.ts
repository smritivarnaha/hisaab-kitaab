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
    CREATE TABLE IF NOT EXISTS chat_messages (
      "id" TEXT PRIMARY KEY,
      "sender" TEXT NOT NULL,
      "text" TEXT NOT NULL,
      "timestamp" BIGINT NOT NULL,
      "isVoice" BOOLEAN DEFAULT FALSE,
      "audioLevel" NUMERIC
    )
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let sql: ReturnType<typeof neon>;
  try { sql = getDb(); } catch (err: any) { return res.status(500).json({ error: err.message }); }

  try {
    await ensureTable(sql);

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM chat_messages ORDER BY timestamp ASC LIMIT 200`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const body = req.body;
      // Accept single message or array
      const msgs = Array.isArray(body) ? body : [body];
      await Promise.all(msgs.map((m: any) => {
        if (!m?.id) return Promise.resolve();
        return sql`
          INSERT INTO chat_messages ("id","sender","text","timestamp","isVoice","audioLevel")
          VALUES (${m.id}, ${m.sender}, ${m.text}, ${m.timestamp}, ${m.isVoice || false}, ${m.audioLevel || null})
          ON CONFLICT ("id") DO UPDATE SET "text" = EXCLUDED."text"
        `;
      }));
      return res.status(200).json({ success: true });
    }

    // DELETE all — for reset
    if (req.method === 'DELETE') {
      await sql`DELETE FROM chat_messages`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Messages API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
