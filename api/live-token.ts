import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
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
  // Supports both classic AIza... and 2026 Google AQ.... API keys
  return (trimmed.startsWith('AIza') || trimmed.startsWith('AQ.')) && trimmed.length >= 25;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawUserId = ((req.query.userId || req.body?.userId || 'praveen') as string).toLowerCase().trim();
    const inlineKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

    let resolvedKey = '';

    // Priority 1: Inline key passed from client settings
    if (isValidGeminiApiKey(inlineKey)) {
      resolvedKey = inlineKey;
    }

    // Priority 2: Server environment variable (GEMINI_API_KEY)
    if (!resolvedKey && isValidGeminiApiKey(process.env.GEMINI_API_KEY)) {
      resolvedKey = process.env.GEMINI_API_KEY!.trim();
    }
    if (!resolvedKey && isValidGeminiApiKey(process.env.VITE_GEMINI_API_KEY)) {
      resolvedKey = process.env.VITE_GEMINI_API_KEY!.trim();
    }

    // Priority 3: Stored key in Neon user_settings for this user
    if (!resolvedKey) {
      const sql = getDb();
      if (sql) {
        try {
          const rows: any = await sql`SELECT "settings" FROM user_settings WHERE "userId" = ${rawUserId} LIMIT 1`;
          const dbKey = rows?.[0]?.settings?.apiKey;
          if (isValidGeminiApiKey(dbKey)) {
            resolvedKey = dbKey.trim();
          }
        } catch {
          // Ignore DB lookup errors and report cleanly below
        }
      }
    }

    if (!resolvedKey) {
      return res.status(200).json({
        available: false,
        reason: 'missing_valid_gemini_key',
        message: 'Add a Google AI Studio Gemini API key (starts with AIza...) to activate Gemini 3.8 Neural Live Audio.'
      });
    }

    // Mint a short-lived Ephemeral Auth Token via v1alpha so raw API keys never stay exposed in WebSocket URLs
    const ai = new GoogleGenAI({
      apiKey: resolvedKey,
      httpOptions: { apiVersion: 'v1alpha' }
    });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const authToken = await ai.authTokens.create({
      config: {
        uses: 3,
        expireTime,
        newSessionExpireTime
      }
    });

    if (!authToken?.name) {
      return res.status(200).json({
        available: false,
        reason: 'token_creation_failed',
        message: 'Could not mint Gemini Live ephemeral token. Check your Gemini API key.'
      });
    }

    return res.status(200).json({
      available: true,
      token: authToken.name,
      model: 'gemini-3.8-live',
      expiresAt: expireTime
    });
  } catch (err: any) {
    console.warn('Live token error:', err?.message || err);
    return res.status(200).json({
      available: false,
      reason: 'invalid_key_or_quota',
      message: err?.message || 'Gemini API key rejected or unavailable.'
    });
  }
}
