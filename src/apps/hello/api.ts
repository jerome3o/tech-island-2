import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { generateText } from '../../lib/claude';

const app = new Hono<AppContext>();

// Simple greeting endpoint
app.get('/api/greet', (c) => {
  const user = c.get('user');
  return c.json({
    message: `Hello, ${user.name || user.email}!`,
    timestamp: new Date().toISOString()
  });
});

// Example using Claude to generate a greeting
app.post('/api/greet-ai', async (c) => {
  const user = c.get('user');
  const claude = c.get('claude');
  const { mood } = await c.req.json<{ mood?: string }>();

  const prompt = mood
    ? `Generate a short, friendly greeting for ${user.name || 'a friend'} who is feeling ${mood}. Keep it to one sentence.`
    : `Generate a short, friendly greeting for ${user.name || 'a friend'}. Keep it to one sentence.`;

  const greeting = await generateText(claude, prompt, {
    maxTokens: 100
  });

  return c.json({ greeting });
});

// Example database operation
app.get('/api/visits', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  // Record this visit
  await db.prepare(`
    INSERT INTO hello_visits (user_id, visited_at)
    VALUES (?, datetime('now'))
  `).bind(user.id).run();

  // Get visit count
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM hello_visits WHERE user_id = ?
  `).bind(user.id).first<{ count: number }>();

  return c.json({
    visits: result?.count ?? 1,
    message: `You've visited ${result?.count ?? 1} time(s)!`
  });
});

export default app;
