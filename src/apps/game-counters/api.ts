import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// List sessions for the current user
app.get('/api/sessions', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const status = c.req.query('status') || 'active';

  const sessions = await db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM game_counter_players WHERE session_id = s.id) as player_count
    FROM game_counter_sessions s
    WHERE s.created_by = ?
      AND s.status = ?
    ORDER BY s.created_at DESC
    LIMIT 50
  `).bind(user.id, status).all();

  return c.json({ sessions: sessions.results });
});

// Get a single session with players and scores
app.get('/api/sessions/:id', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');

  const session = await db.prepare(
    'SELECT * FROM game_counter_sessions WHERE id = ?'
  ).bind(sessionId).first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const players = await db.prepare(
    'SELECT * FROM game_counter_players WHERE session_id = ? ORDER BY player_order'
  ).bind(sessionId).all();

  const scores = await db.prepare(
    'SELECT * FROM game_counter_scores WHERE session_id = ? ORDER BY round, created_at'
  ).bind(sessionId).all();

  return c.json({
    session,
    players: players.results,
    scores: scores.results,
  });
});

// Create a new session
app.post('/api/sessions', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const { gameType, name, players, settings } = await c.req.json();

  if (!gameType || !players || !Array.isArray(players) || players.length < 1) {
    return c.json({ error: 'gameType and at least 1 player required' }, 400);
  }

  const sessionId = generateId();
  const playerIds: string[] = [];

  const statements = [
    db.prepare(`
      INSERT INTO game_counter_sessions (id, game_type, name, created_by, settings)
      VALUES (?, ?, ?, ?, ?)
    `).bind(sessionId, gameType, name || null, user.id, JSON.stringify(settings || {})),
  ];

  for (let i = 0; i < players.length; i++) {
    const playerId = generateId();
    playerIds.push(playerId);
    statements.push(
      db.prepare(`
        INSERT INTO game_counter_players (id, session_id, player_name, player_order)
        VALUES (?, ?, ?, ?)
      `).bind(playerId, sessionId, players[i], i)
    );
  }

  await db.batch(statements);

  return c.json({ sessionId, playerIds }, 201);
});

// Add a score entry
app.post('/api/sessions/:id/scores', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const { playerId, round, score, note } = await c.req.json();

  if (!playerId || round === undefined || score === undefined) {
    return c.json({ error: 'playerId, round, and score are required' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO game_counter_scores (session_id, player_id, round, score, note)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `).bind(sessionId, playerId, round, score, note || null).first();

  return c.json({ score: result }, 201);
});

// Delete a score entry (undo)
app.delete('/api/sessions/:id/scores/:scoreId', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const scoreId = c.req.param('scoreId');

  await db.prepare(
    'DELETE FROM game_counter_scores WHERE id = ? AND session_id = ?'
  ).bind(scoreId, sessionId).run();

  return c.json({ success: true });
});

// Update session status
app.put('/api/sessions/:id/status', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const { status } = await c.req.json();

  if (!['active', 'completed'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  await db.prepare(
    'UPDATE game_counter_sessions SET status = ? WHERE id = ?'
  ).bind(status, sessionId).run();

  return c.json({ success: true });
});

// Delete a session
app.delete('/api/sessions/:id', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const user = c.get('user');

  // Only the creator can delete
  const session = await db.prepare(
    'SELECT created_by FROM game_counter_sessions WHERE id = ?'
  ).bind(sessionId).first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  if (session.created_by !== user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Delete in order: scores -> players -> session
  await db.batch([
    db.prepare('DELETE FROM game_counter_scores WHERE session_id = ?').bind(sessionId),
    db.prepare('DELETE FROM game_counter_players WHERE session_id = ?').bind(sessionId),
    db.prepare('DELETE FROM game_counter_sessions WHERE id = ?').bind(sessionId),
  ]);

  return c.json({ success: true });
});

export default app;
