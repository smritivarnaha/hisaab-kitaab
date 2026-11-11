import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  return connectionString ? neon(connectionString) : null;
}

function isValidGeminiApiKey(key?: string | null): key is string {
  if (!key) return false;
  const trimmed = key.trim();
  return (trimmed.startsWith('AIza') || trimmed.startsWith('AQ.')) && trimmed.length >= 25;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { contents, generationConfig, userId = 'praveen', apiKey } = req.body || {};
    if (!Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({ error: 'Missing contents' });
    }

    let resolvedKey = '';
    if (isValidGeminiApiKey(apiKey)) {
      resolvedKey = apiKey.trim();
    }
    if (!resolvedKey && isValidGeminiApiKey(process.env.GEMINI_API_KEY)) {
      resolvedKey = process.env.GEMINI_API_KEY!.trim();
    }
    if (!resolvedKey && isValidGeminiApiKey(process.env.VITE_GEMINI_API_KEY)) {
      resolvedKey = process.env.VITE_GEMINI_API_KEY!.trim();
    }
    if (!resolvedKey) {
      const sql = getDb();
      if (sql) {
        try {
          const rows: any = await sql`SELECT "settings" FROM user_settings WHERE "userId" = ${String(userId).toLowerCase().trim()} LIMIT 1`;
          const dbKey = rows?.[0]?.settings?.apiKey;
          if (isValidGeminiApiKey(dbKey)) {
            resolvedKey = dbKey.trim();
          }
        } catch {}
      }
    }

    if (!resolvedKey) {
      return res.status(200).json({ ok: false, reason: 'missing_key' });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${resolvedKey}`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'LOW' },
          ...(generationConfig || {})
        }
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(200).json({ ok: false, status: upstream.status, error: errText.slice(0, 300) });
    }

    const data = await upstream.json();
    return res.status(200).json({ ok: true, data });
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: err?.message || 'Gemini proxy error' });
  }
}
