import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Get all feature requests with reaction counts
app.get('/api/requests', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  // Get all feature requests with reaction counts and user's reactions
  const requests = await db.prepare(`
    SELECT
      fr.id,
      fr.user_id,
      fr.title,
      fr.icon,
      fr.description,
      fr.created_at,
      u.alias as creator_alias,
      u.email as creator_email,
      GROUP_CONCAT(DISTINCT frr.emoji) as all_reactions,
      GROUP_CONCAT(DISTINCT CASE WHEN frr.user_id = ? THEN frr.emoji END) as user_reactions
    FROM feature_requests fr
    LEFT JOIN users u ON fr.user_id = u.id
    LEFT JOIN feature_request_reactions frr ON fr.id = frr.feature_request_id
    GROUP BY fr.id
    ORDER BY fr.created_at DESC
  `).bind(user.id).all();

  // Process the results to count reactions
  const processedRequests = requests.results.map((req: any) => {
    const allReactions = req.all_reactions ? req.all_reactions.split(',') : [];
    const userReactions = req.user_reactions ? req.user_reactions.split(',') : [];

    // Count each emoji
    const reactionCounts: Record<string, number> = {};
    allReactions.forEach((emoji: string) => {
      if (emoji) {
        reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
      }
    });

    // Get creator name - prefer alias, fallback to email local part
    const creatorName = req.creator_alias || (req.creator_email ? req.creator_email.split('@')[0] : 'Unknown');

    return {
      id: req.id,
      user_id: req.user_id,
      creator_name: creatorName,
      title: req.title,
      icon: req.icon,
      description: req.description,
      created_at: req.created_at,
      reactions: reactionCounts,
      user_reactions: userReactions.filter((e: string) => e)
    };
  });

  return c.json(processedRequests);
});

// Create a new feature request
app.post('/api/requests', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { title, icon, description } = await c.req.json();

  if (!title || !icon || !description) {
    return c.json({ error: 'Title, icon, and description are required' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO feature_requests (user_id, title, icon, description)
    VALUES (?, ?, ?, ?)
  `).bind(user.id, title, icon, description).run();

  return c.json({
    id: result.meta.last_row_id,
    message: 'Feature request created successfully'
  });
});

// Toggle a reaction on a feature request
app.post('/api/requests/:id/react', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const requestId = c.req.param('id');
  const { emoji } = await c.req.json();

  if (!emoji) {
    return c.json({ error: 'Emoji is required' }, 400);
  }

  // Check if the reaction already exists
  const existing = await db.prepare(`
    SELECT id FROM feature_request_reactions
    WHERE feature_request_id = ? AND user_id = ? AND emoji = ?
  `).bind(requestId, user.id, emoji).first();

  if (existing) {
    // Remove the reaction
    await db.prepare(`
      DELETE FROM feature_request_reactions
      WHERE feature_request_id = ? AND user_id = ? AND emoji = ?
    `).bind(requestId, user.id, emoji).run();

    return c.json({ action: 'removed', emoji });
  } else {
    // Add the reaction
    await db.prepare(`
      INSERT INTO feature_request_reactions (feature_request_id, user_id, emoji)
      VALUES (?, ?, ?)
    `).bind(requestId, user.id, emoji).run();

    return c.json({ action: 'added', emoji });
  }
});

export default app;
