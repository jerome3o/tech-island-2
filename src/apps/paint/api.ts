import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Helper to ensure user has a Bebo profile
async function ensureBeboProfile(db: any, userId: string) {
  const existing = await db
    .prepare('SELECT user_id FROM bebo_profiles WHERE user_id = ?')
    .bind(userId)
    .first();

  if (!existing) {
    await db
      .prepare('INSERT INTO bebo_profiles (user_id) VALUES (?)')
      .bind(userId)
      .run();
  }
}

// Get feed of artworks
app.get('/api/feed', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  await ensureBeboProfile(db, user.id);

  const artworks = await db
    .prepare(`
      SELECT
        a.id,
        a.user_id,
        a.user_name,
        a.created_at,
        bp.profile_pic_key,
        COUNT(ac.id) as comment_count
      FROM artworks a
      LEFT JOIN bebo_profiles bp ON a.user_id = bp.user_id
      LEFT JOIN artwork_comments ac ON a.id = ac.artwork_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `)
    .all();

  return c.json(artworks.results || []);
});

// Get specific artwork with full details and comments
app.get('/api/artwork/:id', async (c) => {
  const db = c.env.DB;
  const artworkId = c.req.param('id');

  // Get artwork
  const artwork = await db
    .prepare(`
      SELECT
        a.id,
        a.user_id,
        a.user_name,
        a.image_data,
        a.created_at,
        bp.profile_pic_key
      FROM artworks a
      LEFT JOIN bebo_profiles bp ON a.user_id = bp.user_id
      WHERE a.id = ?
    `)
    .bind(artworkId)
    .first();

  if (!artwork) {
    return c.json({ error: 'Artwork not found' }, 404);
  }

  // Get comments
  const comments = await db
    .prepare(`
      SELECT
        ac.id,
        ac.user_id,
        ac.user_name,
        ac.comment,
        ac.is_critique,
        ac.created_at,
        bp.profile_pic_key
      FROM artwork_comments ac
      LEFT JOIN bebo_profiles bp ON ac.user_id = bp.user_id
      WHERE ac.artwork_id = ?
      ORDER BY ac.created_at ASC
    `)
    .bind(artworkId)
    .all();

  return c.json({
    ...artwork,
    comments: comments.results || []
  });
});

// Upload new artwork
app.post('/api/artwork', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { image_data } = await c.req.json();

  if (!image_data) {
    return c.json({ error: 'Image data is required' }, 400);
  }

  await ensureBeboProfile(db, user.id);

  const result = await db
    .prepare(`
      INSERT INTO artworks (user_id, user_name, image_data)
      VALUES (?, ?, ?)
    `)
    .bind(user.id, user.name, image_data)
    .run();

  return c.json({
    success: true,
    id: result.meta.last_row_id
  });
});

// Add comment to artwork
app.post('/api/artwork/:id/comment', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const artworkId = c.req.param('id');
  const { comment } = await c.req.json();

  if (!comment || comment.trim().length === 0) {
    return c.json({ error: 'Comment is required' }, 400);
  }

  await ensureBeboProfile(db, user.id);

  // Check if artwork exists
  const artwork = await db
    .prepare('SELECT id FROM artworks WHERE id = ?')
    .bind(artworkId)
    .first();

  if (!artwork) {
    return c.json({ error: 'Artwork not found' }, 404);
  }

  await db
    .prepare(`
      INSERT INTO artwork_comments (artwork_id, user_id, user_name, comment, is_critique)
      VALUES (?, ?, ?, ?, 0)
    `)
    .bind(artworkId, user.id, user.name, comment.trim())
    .run();

  return c.json({ success: true });
});

// Generate Claude critique (creator only)
app.post('/api/artwork/:id/critique', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const artworkId = c.req.param('id');

  // Get artwork
  const artwork = await db
    .prepare('SELECT user_id, image_data FROM artworks WHERE id = ?')
    .bind(artworkId)
    .first();

  if (!artwork) {
    return c.json({ error: 'Artwork not found' }, 404);
  }

  // Check if user is the creator
  if ((artwork as any).user_id !== user.id) {
    return c.json({ error: 'Only the creator can request a critique' }, 403);
  }

  // Use Claude Vision API to critique the artwork
  const claude = c.get('claude');

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: (artwork as any).image_data.replace(/^data:image\/png;base64,/, '')
            }
          },
          {
            type: 'text',
            text: 'You are an art critic. Provide a brief, constructive critique of this artwork. Comment on composition, color use, technique, and overall impression. Keep it friendly but honest, 2-3 sentences.'
          }
        ]
      }]
    });

    const critique = response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate critique';

    // Save critique as a special comment
    await db
      .prepare(`
        INSERT INTO artwork_comments (artwork_id, user_id, user_name, comment, is_critique)
        VALUES (?, ?, ?, ?, 1)
      `)
      .bind(artworkId, 'claude-ai', 'Claude (AI Critic)', critique)
      .run();

    return c.json({ success: true, critique });
  } catch (error) {
    console.error('Error generating critique:', error);
    return c.json({ error: 'Failed to generate critique' }, 500);
  }
});

export default app;
