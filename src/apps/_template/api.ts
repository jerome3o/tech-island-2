/**
 * App Template
 *
 * Copy this folder to create a new app:
 *   cp -r src/apps/_template src/apps/your-app-name
 *
 * Then:
 * 1. Implement your API routes in this file
 * 2. Create UI in ui/index.html
 * 3. Register the app in src/index.ts
 * 4. Add any needed database migrations
 */

import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Example: Get items for the current user
app.get('/api/items', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  // Replace 'items' with your table name
  const result = await db.prepare(`
    SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC
  `).bind(user.id).all();

  return c.json({ items: result.results });
});

// Example: Create a new item
app.post('/api/items', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const body = await c.req.json();

  const result = await db.prepare(`
    INSERT INTO items (user_id, content, created_at)
    VALUES (?, ?, datetime('now'))
    RETURNING *
  `).bind(user.id, body.content).first();

  return c.json({ item: result }, 201);
});

// Example: Use Claude API
app.post('/api/generate', async (c) => {
  const claude = c.get('claude');
  const { prompt } = await c.req.json();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return c.json({ response: textBlock?.text ?? '' });
});

export default app;
