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

const DEFAULT_USERS = [
  { id: 'nandini', username: 'nandini', name: 'Nandini', password: 'nandini9100' },
  { id: 'sarthak', username: 'sarthak', name: 'Sarthak', password: 'sarthak9100' },
  { id: 'praveen', username: 'praveen', name: 'Praveen', password: 'praveen9100' }
];

async function ensureUsersTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      "id" TEXT PRIMARY KEY,
      "username" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "updatedAt" BIGINT NOT NULL
    )
  `;

  // Seed default users if table is empty
  for (const u of DEFAULT_USERS) {
    await sql`
      INSERT INTO app_users ("id", "username", "name", "password", "updatedAt")
      VALUES (${u.id}, ${u.username}, ${u.name}, ${u.password}, ${Date.now()})
      ON CONFLICT ("username") DO NOTHING
    `;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let sql: ReturnType<typeof neon>;
  try {
    sql = getDb();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  try {
    await ensureUsersTable(sql);

    const action = req.query.action || 'list';

    // 1. GET /api/auth?action=list - List user accounts for quick login selection
    if (req.method === 'GET' && action === 'list') {
      const rows = await sql`SELECT "id", "username", "name" FROM app_users ORDER BY "name" ASC`;
      return res.status(200).json(rows);
    }

    // 2. POST /api/auth?action=login - Authenticate user
    if (req.method === 'POST' && action === 'login') {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const rows = await sql`
        SELECT "id", "username", "name", "password" FROM app_users 
        WHERE LOWER("username") = ${cleanUsername} LIMIT 1
      `;

      if (!rows.length) {
        return res.status(401).json({ error: 'User account not found' });
      }

      const userRow = rows[0];
      if (userRow.password !== password) {
        return res.status(401).json({ error: 'Incorrect password' });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: userRow.id,
          username: userRow.username,
          name: userRow.name
        }
      });
    }

    // 3. POST /api/auth?action=change-password - Change user password
    if (req.method === 'POST' && action === 'change-password') {
      const { userId, oldPassword, newPassword } = req.body || {};
      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const rows = await sql`
        SELECT "id", "password" FROM app_users WHERE "id" = ${userId} LIMIT 1
      `;

      if (!rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (rows[0].password !== oldPassword) {
        return res.status(400).json({ error: 'Current password does not match' });
      }

      await sql`
        UPDATE app_users SET "password" = ${newPassword}, "updatedAt" = ${Date.now()}
        WHERE "id" = ${userId}
      `;

      return res.status(200).json({ success: true, message: 'Password updated successfully' });
    }

    // 4. POST /api/auth?action=logout - Logout Session Endpoint
    if (req.method === 'POST' && action === 'logout') {
      return res.status(200).json({ success: true, message: 'Session logged out successfully' });
    }

    return res.status(400).json({ error: 'Invalid auth action' });
  } catch (err: any) {
    console.error('Auth API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
