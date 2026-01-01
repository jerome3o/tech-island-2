import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { sendNtfyNotification } from '../../lib/ntfy';

const app = new Hono<AppContext>();

// Get all hot takes with comment counts
app.get('/api/takes', async (c) => {
  const db = c.env.DB;

  const takes = await db.prepare(`
    SELECT
      ht.id,
      ht.user_id,
      ht.content,
      ht.created_at,
      COUNT(htc.id) as comment_count
    FROM hot_takes ht
    LEFT JOIN hot_take_comments htc ON ht.id = htc.hot_take_id
    GROUP BY ht.id
    ORDER BY ht.created_at DESC
  `).all();

  return c.json(takes.results);
});

// Submit a new hot take (and generate AI comment)
app.post('/api/takes', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const claude = c.get('claude');
  const { content } = await c.req.json();

  if (!content || content.trim().length === 0) {
    return c.json({ error: 'Hot take cannot be empty' }, 400);
  }

  if (content.length > 500) {
    return c.json({ error: 'Hot take too long (max 500 characters)' }, 400);
  }

  // Insert the hot take
  const result = await db.prepare(
    'INSERT INTO hot_takes (user_id, content) VALUES (?, ?) RETURNING id'
  ).bind(user.id, content.trim()).first();

  if (!result) {
    return c.json({ error: 'Failed to create hot take' }, 500);
  }

  const takeId = result.id as number;

  // Generate a provocative AI comment to start the argument
  try {
    const aiResponse = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: 'You are a master debater who loves to play devil\'s advocate. Your job is to generate a provocative, argumentative response to hot takes that will spark heated debate. Be bold, challenging, and slightly inflammatory (but not offensive). Keep it under 200 characters. Don\'t agree - always take the opposing view and poke holes in their argument.',
      messages: [{ role: 'user', content: `Hot take: "${content}"\n\nGenerate a spicy counter-argument that will start an argument:` }]
    });

    const aiComment = aiResponse.content[0].type === 'text'
      ? aiResponse.content[0].text
      : 'Interesting take... but completely wrong.';

    // Insert AI comment
    await db.prepare(
      'INSERT INTO hot_take_comments (hot_take_id, user_id, content, is_ai) VALUES (?, ?, ?, 1)'
    ).bind(takeId, 'claude-ai', aiComment.trim()).run();

    // Send debug notification
    sendNtfyNotification(c.env, {
      title: '🔥 New Hot Take Posted',
      message: `"${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      priority: 'default',
      tags: ['hot-takes', 'new-post'],
      click: `${c.env.APP_URL}/hot-takes/?take=${takeId}`,
    }).catch(err => console.error('Failed to send ntfy notification:', err));

  } catch (error) {
    console.error('Failed to generate AI comment:', error);
    // Continue anyway - the hot take is still posted
  }

  return c.json({ id: takeId });
});

// Get a specific hot take with all comments
app.get('/api/takes/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  // Get the hot take
  const take = await db.prepare(
    'SELECT * FROM hot_takes WHERE id = ?'
  ).bind(id).first();

  if (!take) {
    return c.json({ error: 'Hot take not found' }, 404);
  }

  // Get all comments
  const comments = await db.prepare(`
    SELECT * FROM hot_take_comments
    WHERE hot_take_id = ?
    ORDER BY created_at ASC
  `).bind(id).all();

  return c.json({
    take,
    comments: comments.results
  });
});

// Add a comment to a hot take
app.post('/api/takes/:id/comments', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const { content } = await c.req.json();

  if (!content || content.trim().length === 0) {
    return c.json({ error: 'Comment cannot be empty' }, 400);
  }

  if (content.length > 500) {
    return c.json({ error: 'Comment too long (max 500 characters)' }, 400);
  }

  // Check if hot take exists
  const take = await db.prepare(
    'SELECT id FROM hot_takes WHERE id = ?'
  ).bind(id).first();

  if (!take) {
    return c.json({ error: 'Hot take not found' }, 404);
  }

  // Insert comment
  const result = await db.prepare(
    'INSERT INTO hot_take_comments (hot_take_id, user_id, content, is_ai) VALUES (?, ?, ?, 0) RETURNING id'
  ).bind(id, user.id, content.trim()).first();

  if (!result) {
    return c.json({ error: 'Failed to create comment' }, 500);
  }

  return c.json({ id: result.id });
});

export default app;
