import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

function isAdmin(c: any): boolean {
  const user = c.get('user');
  return user.email === c.env.ADMIN_EMAIL;
}

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
      fr.status,
      fr.type,
      fr.admin_response,
      fr.responded_at,
      fr.created_at,
      u.alias as creator_alias,
      u.email as creator_email,
      (SELECT COUNT(*) FROM feature_request_comments WHERE feature_request_id = fr.id) as comment_count
    FROM feature_requests fr
    LEFT JOIN users u ON fr.user_id = u.id
    ORDER BY fr.created_at DESC
  `).all();

  // Get reactions separately for accuracy (GROUP_CONCAT can lose duplicates)
  const processedRequests = await Promise.all(requests.results.map(async (req: any) => {
    const reactions = await db.prepare(`
      SELECT emoji, COUNT(*) as count FROM feature_request_reactions
      WHERE feature_request_id = ? GROUP BY emoji
    `).bind(req.id).all();

    const userReactions = await db.prepare(`
      SELECT emoji FROM feature_request_reactions
      WHERE feature_request_id = ? AND user_id = ?
    `).bind(req.id, user.id).all();

    const reactionCounts: Record<string, number> = {};
    for (const r of reactions.results as any[]) {
      reactionCounts[r.emoji] = r.count;
    }

    const creatorName = req.creator_alias || (req.creator_email ? req.creator_email.split('@')[0] : 'Unknown');

    return {
      id: req.id,
      user_id: req.user_id,
      creator_name: creatorName,
      title: req.title,
      icon: req.icon,
      description: req.description,
      status: req.status || 'pending',
      type: req.type || 'feature',
      admin_response: req.admin_response,
      responded_at: req.responded_at,
      created_at: req.created_at,
      comment_count: req.comment_count || 0,
      reactions: reactionCounts,
      user_reactions: (userReactions.results as any[]).map((r: any) => r.emoji)
    };
  }));

  return c.json(processedRequests);
});

// Get pending request count (for FAB badge)
app.get('/api/requests/pending-count', async (c) => {
  const db = c.env.DB;
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM feature_requests WHERE status = 'pending'
  `).first();
  return c.json({ count: result?.count || 0 });
});

// Create a new feature request
app.post('/api/requests', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { title, icon, description, type } = await c.req.json();

  if (!title || !icon || !description) {
    return c.json({ error: 'Title, icon, and description are required' }, 400);
  }

  const requestType = type === 'bug' ? 'bug' : 'feature';

  const result = await db.prepare(`
    INSERT INTO feature_requests (user_id, title, icon, description, type, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).bind(user.id, title, icon, description, requestType).run();

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
    await db.prepare(`
      DELETE FROM feature_request_reactions
      WHERE feature_request_id = ? AND user_id = ? AND emoji = ?
    `).bind(requestId, user.id, emoji).run();
    return c.json({ action: 'removed', emoji });
  } else {
    await db.prepare(`
      INSERT INTO feature_request_reactions (feature_request_id, user_id, emoji)
      VALUES (?, ?, ?)
    `).bind(requestId, user.id, emoji).run();
    return c.json({ action: 'added', emoji });
  }
});

// Get comments for a feature request
app.get('/api/requests/:id/comments', async (c) => {
  const db = c.env.DB;
  const requestId = c.req.param('id');

  const comments = await db.prepare(`
    SELECT
      frc.id,
      frc.user_id,
      frc.content,
      frc.created_at,
      u.alias as author_alias,
      u.email as author_email
    FROM feature_request_comments frc
    LEFT JOIN users u ON frc.user_id = u.id
    WHERE frc.feature_request_id = ?
    ORDER BY frc.created_at ASC
  `).bind(requestId).all();

  const processedComments = (comments.results as any[]).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author_name: c.author_alias || (c.author_email ? c.author_email.split('@')[0] : 'Unknown')
  }));

  return c.json(processedComments);
});

// Add a comment to a feature request
app.post('/api/requests/:id/comments', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const requestId = c.req.param('id');
  const { content } = await c.req.json();

  if (!content || !content.trim()) {
    return c.json({ error: 'Content is required' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO feature_request_comments (feature_request_id, user_id, content)
    VALUES (?, ?, ?)
  `).bind(requestId, user.id, content.trim()).run();

  return c.json({
    id: result.meta.last_row_id,
    message: 'Comment added'
  });
});

// Admin: Update feature request status
app.put('/api/requests/:id/status', async (c) => {
  if (!isAdmin(c)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const db = c.env.DB;
  const requestId = c.req.param('id');
  const { status, admin_response } = await c.req.json();

  const validStatuses = ['pending', 'approved', 'rejected', 'in_progress', 'completed'];
  if (!validStatuses.includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  await db.prepare(`
    UPDATE feature_requests
    SET status = ?, admin_response = ?, responded_at = unixepoch()
    WHERE id = ?
  `).bind(status, admin_response || null, requestId).run();

  return c.json({ success: true });
});

// Admin: Delete a feature request
app.delete('/api/requests/:id', async (c) => {
  if (!isAdmin(c)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const db = c.env.DB;
  const requestId = c.req.param('id');

  await db.batch([
    db.prepare('DELETE FROM feature_request_reactions WHERE feature_request_id = ?').bind(requestId),
    db.prepare('DELETE FROM feature_request_comments WHERE feature_request_id = ?').bind(requestId),
    db.prepare('DELETE FROM feature_requests WHERE id = ?').bind(requestId),
  ]);

  return c.json({ success: true });
});

export default app;
