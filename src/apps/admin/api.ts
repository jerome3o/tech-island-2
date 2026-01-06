/**
 * Admin App
 *
 * Admin-only page for viewing all users
 * Access restricted to ADMIN_EMAIL
 */

import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Admin middleware - check if user is admin
app.use('/api/*', async (c, next) => {
  const user = c.get('user');
  const adminEmail = c.env.ADMIN_EMAIL;

  if (user.email !== adminEmail) {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  return next();
});

// Get all users
app.get('/api/users', async (c) => {
  const db = c.env.DB;

  const result = await db.prepare(`
    SELECT id, email, alias, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();

  return c.json({ users: result.results });
});

export default app;
