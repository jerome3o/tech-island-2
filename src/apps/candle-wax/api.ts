import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Get high scores
app.get('/api/scores', async (c) => {
  const db = c.env.DB;
  const scores = await db
    .prepare(`
      SELECT u.email, cw.score, cw.wax_collected, cw.created_at
      FROM candle_wax_scores cw
      JOIN users u ON u.id = cw.user_id
      ORDER BY cw.score DESC
      LIMIT 10
    `)
    .all();
  return c.json(scores.results || []);
});

// Save score
app.post('/api/scores', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { score, waxCollected } = await c.req.json();

  await db
    .prepare(`
      INSERT INTO candle_wax_scores (user_id, score, wax_collected)
      VALUES (?, ?, ?)
    `)
    .bind(user.id, score, waxCollected)
    .run();

  return c.json({ success: true });
});

export default app;
