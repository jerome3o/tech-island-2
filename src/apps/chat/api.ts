import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

interface ChatMessage {
  id: number;
  user_id: string;
  user_email: string;
  content: string;
  created_at: string;
}

// Get recent messages
app.get('/api/messages', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const before = c.req.query('before'); // For pagination

  let query = `
    SELECT id, user_id, user_email, content, created_at
    FROM chat_messages
  `;

  if (before) {
    query += ` WHERE id < ? ORDER BY id DESC LIMIT ?`;
    const result = await db.prepare(query).bind(parseInt(before), limit).all<ChatMessage>();
    return c.json({ messages: result.results.reverse() });
  } else {
    query += ` ORDER BY id DESC LIMIT ?`;
    const result = await db.prepare(query).bind(limit).all<ChatMessage>();
    return c.json({ messages: result.results.reverse() });
  }
});

// Get new messages since a given ID (for polling)
app.get('/api/messages/since/:id', async (c) => {
  const db = c.env.DB;
  const sinceId = parseInt(c.req.param('id'));

  const result = await db.prepare(`
    SELECT id, user_id, user_email, content, created_at
    FROM chat_messages
    WHERE id > ?
    ORDER BY id ASC
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

  return c.json({ message: result });
});

export default app;
