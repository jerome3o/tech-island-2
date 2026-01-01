import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

interface ChatMessage {
  id: number;
  user_id: string;
  user_email: string;
  user_name: string; // Display name from users.alias
  content: string;
  created_at: string;
}

// Get recent messages
app.get('/api/messages', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const before = c.req.query('before'); // For pagination

  let query = `
    SELECT cm.id, cm.user_id, cm.user_email, cm.content, cm.created_at,
           COALESCE(u.alias, cm.user_email) as user_name
    FROM chat_messages cm
    LEFT JOIN users u ON cm.user_id = u.id
  `;

  if (before) {
    query += ` WHERE cm.id < ? ORDER BY cm.id DESC LIMIT ?`;
    const result = await db.prepare(query).bind(parseInt(before), limit).all<ChatMessage>();
    return c.json({ messages: result.results.reverse() });
  } else {
    query += ` ORDER BY cm.id DESC LIMIT ?`;
    const result = await db.prepare(query).bind(limit).all<ChatMessage>();
    return c.json({ messages: result.results.reverse() });
  }
});

// Get new messages since a given ID (for polling)
app.get('/api/messages/since/:id', async (c) => {
  const db = c.env.DB;
  const sinceId = parseInt(c.req.param('id'));

  const result = await db.prepare(`
    SELECT cm.id, cm.user_id, cm.user_email, cm.content, cm.created_at,
           COALESCE(u.alias, cm.user_email) as user_name
    FROM chat_messages cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.id > ?
    ORDER BY cm.id ASC
    LIMIT 100
  `).bind(sinceId).all<ChatMessage>();

  return c.json({ messages: result.results });
});

// Post a new message
app.post('/api/messages', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { content } = await c.req.json<{ content: string }>();

  if (!content || content.trim().length === 0) {
    return c.json({ error: 'Message cannot be empty' }, 400);
  }

  if (content.length > 2000) {
    return c.json({ error: 'Message too long (max 2000 chars)' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO chat_messages (user_id, user_email, content)
    VALUES (?, ?, ?)
    RETURNING id, user_id, user_email, content, created_at
  `).bind(user.id, user.email, content.trim()).first<ChatMessage>();

  // Get display name from users table
  const userInfo = await db.prepare(`
    SELECT COALESCE(alias, ?) as user_name FROM users WHERE id = ?
  `).bind(user.email, user.id).first<{ user_name: string }>();

  return c.json({
    message: {
      ...result,
      user_name: userInfo?.user_name || user.email
    }
  });
});

export default app;
