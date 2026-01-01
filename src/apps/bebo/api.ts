/**
 * Bebo - Social Network Profile System
 *
 * Bebo is the canonical profile system for Tech Island. It provides user profiles,
 * social features, and serves as the de facto identity system across all apps.
 *
 * ## Key Concepts
 *
 * ### Profile System
 * - **Profile Pictures & Cover Photos**: Stored in Cloudflare R2 (`tech-island-2-images` bucket)
 * - **Profile Visibility**: Profiles are hidden by default (`hidden = 1`)
 *   - Automatically shown when user adds bio, profile pic, or cover photo
 *   - Users can manually toggle visibility
 * - **Luvs**: Daily social currency (users can give 3 luvs per day to different people)
 * - **Wall Posts**: Users can post messages on each other's walls
 *
 * ### Database Schema
 *
 * **bebo_profiles**
 * - `user_id` (PK): References users.id
 * - `bio`: User biography text
 * - `profile_pic_key`: R2 key for profile picture
 * - `cover_photo_key`: R2 key for cover photo
 * - `luv_count`: Total luvs received (incremented when receiving luvs)
 * - `hidden`: 0 = visible in directory, 1 = hidden
 * - `created_at`, `updated_at`: Timestamps
 *
 * **bebo_wall_posts**
 * - `id` (PK): UUID
 * - `wall_owner_id`: User whose wall this is posted on
 * - `author_id`: User who wrote the post
 * - `content`: Post text content
 * - `created_at`: Timestamp
 *
 * **bebo_luvs**
 * - `id` (PK): UUID
 * - `from_user_id`: User giving the luv
 * - `to_user_id`: User receiving the luv
 * - `given_at`: Timestamp
 * - `day`: Date string (YYYY-MM-DD) for daily limit tracking
 * - UNIQUE constraint on (from_user_id, to_user_id, day) - prevents duplicate luvs
 *
 * ### Image Storage (R2)
 *
 * Images are stored in Cloudflare R2 with keys like: `{user_id}/{timestamp}.{extension}`
 * - Served through authenticated routes at `/bebo/images/:key`
 * - Private by default (not publicly accessible)
 * - Only visible to authenticated users
 *
 * ### API Routes
 *
 * **Public (within app):**
 * - `GET /api/users` - Get all visible profiles (directory)
 * - `GET /api/profile/:userId` - Get specific user's profile
 * - `GET /api/wall/:userId` - Get wall posts for a user
 * - `GET /api/luv/remaining` - Check how many luvs you have left today
 * - `GET /api/luv/received` - Get luvs you've received
 *
 * **Authenticated (current user only):**
 * - `PUT /api/profile` - Update your own profile
 * - `POST /api/upload` - Upload profile/cover image to R2
 * - `POST /api/wall/:userId` - Post on someone's wall
 * - `POST /api/luv/:userId` - Give luv to a user (3 per day limit)
 *
 * **Image Serving:**
 * - `GET /images/:key` - Serve images from R2 (authenticated)
 *
 * ### Integration with Other Apps
 *
 * Other apps should use Bebo for:
 * 1. **User avatars**: Query `bebo_profiles.profile_pic_key` and display at `/bebo/images/${key}`
 * 2. **Display names**: Use `users.alias` (or fallback to email)
 * 3. **Profile links**: Link to `/bebo` for user profiles
 *
 * Example:
 * ```typescript
 * // In your app, fetch user's profile picture
 * const profile = await db.prepare('SELECT profile_pic_key FROM bebo_profiles WHERE user_id = ?').bind(userId).first();
 * const avatarUrl = profile?.profile_pic_key ? `/bebo/images/${profile.profile_pic_key}` : null;
 * ```
 *
 * See CLAUDE.md section "User Profiles: Bebo as Canonical Profile System" for full details.
 */

import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Helper to ensure user profile exists
async function ensureProfile(db: any, userId: string) {
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

// Get all users (directory)
app.get('/api/users', async (c) => {
  const db = c.env.DB;
  const currentUser = c.get('user');

  // Ensure current user has a profile
  await ensureProfile(db, currentUser.id);

  // Get all users with visible profiles
  const users = await db
    .prepare(`
      SELECT
        u.id as user_id,
        u.email,
        COALESCE(u.alias, u.email) as user_alias,
        bp.bio,
        bp.profile_pic_key,
        bp.cover_photo_key,
        bp.luv_count
      FROM users u
      INNER JOIN bebo_profiles bp ON u.id = bp.user_id
      WHERE bp.hidden = 0
      ORDER BY user_alias
    `)
    .all();

  const enriched = users.results?.map((u: any) => ({
    user_id: u.user_id,
    name: u.user_alias,
    email: u.email,
    bio: u.bio,
    profile_pic_key: u.profile_pic_key,
    cover_photo_key: u.cover_photo_key,
    luv_count: u.luv_count || 0
  })) || [];

  return c.json(enriched);
});

// Get a user's profile
app.get('/api/profile/:userId', async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('userId');

  await ensureProfile(db, userId);

  // Get user info
  const user = await db
    .prepare('SELECT id as user_id, COALESCE(alias, email) as user_alias, email FROM users WHERE id = ?')
    .bind(userId)
    .first();

  // Get profile
  const profile = await db
    .prepare('SELECT * FROM bebo_profiles WHERE user_id = ?')
    .bind(userId)
    .first();

  if (!user || !profile) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    user_id: user.user_id,
    name: user.user_alias,
    email: user.email,
    bio: profile.bio,
    profile_pic_key: profile.profile_pic_key,
    cover_photo_key: profile.cover_photo_key,
    luv_count: profile.luv_count,
    hidden: profile.hidden
  });
});

// Update your own profile
app.put('/api/profile', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { bio, profile_pic_key, cover_photo_key, hidden } = await c.req.json();

  await ensureProfile(db, user.id);

  // Automatically make profile visible if any content is set
  const hasContent = bio || profile_pic_key || cover_photo_key;
  const shouldBeHidden = hidden === true && !hasContent;

  await db
    .prepare(`
      UPDATE bebo_profiles
      SET bio = ?, profile_pic_key = ?, cover_photo_key = ?, hidden = ?, updated_at = strftime('%s', 'now')
      WHERE user_id = ?
    `)
    .bind(bio || null, profile_pic_key || null, cover_photo_key || null, shouldBeHidden ? 1 : 0, user.id)
    .run();

  return c.json({ success: true });
});

// Upload an image to R2
app.post('/api/upload', async (c) => {
  const formData = await c.req.formData();
  const fileEntry = formData.get('file');

  if (!fileEntry || typeof fileEntry === 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }

  const file = fileEntry as File;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'File must be an image' }, 400);
  }

  // Generate unique key
  const user = c.get('user');
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'jpg';
  const key = `${user.id}/${timestamp}.${extension}`;

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await c.env.IMAGES.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type
    }
  });

  return c.json({ key });
});

// Serve an image from R2 (authenticated)
app.get('/images/:key{.*}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.IMAGES.get(key);

  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

  return new Response(object.body, { headers });
});

// Get wall posts for a user
app.get('/api/wall/:userId', async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('userId');

  const posts = await db
    .prepare(`
      SELECT
        wp.id, wp.content, wp.created_at,
        u.id as author_id, COALESCE(u.alias, u.email) as author_name,
        bp.profile_pic_key as author_pic
      FROM bebo_wall_posts wp
      JOIN users u ON wp.author_id = u.id
      LEFT JOIN bebo_profiles bp ON wp.author_id = bp.user_id
      WHERE wp.wall_owner_id = ?
      ORDER BY wp.created_at DESC
      LIMIT 50
    `)
    .bind(userId)
    .all();

  return c.json(posts.results || []);
});

// Post on a user's wall
app.post('/api/wall/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const wallOwnerId = c.req.param('userId');
  const { content } = await c.req.json();

  if (!content || content.trim().length === 0) {
    return c.json({ error: 'Content is required' }, 400);
  }

  await ensureProfile(db, user.id);
  await ensureProfile(db, wallOwnerId);

  const id = crypto.randomUUID();

  await db
    .prepare(`
      INSERT INTO bebo_wall_posts (id, wall_owner_id, author_id, content)
      VALUES (?, ?, ?, ?)
    `)
    .bind(id, wallOwnerId, user.id, content.trim())
    .run();

  return c.json({ success: true, id });
});

// Give a luv to a user
app.post('/api/luv/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const toUserId = c.req.param('userId');

  if (user.id === toUserId) {
    return c.json({ error: 'Cannot give luv to yourself' }, 400);
  }

  await ensureProfile(db, user.id);
  await ensureProfile(db, toUserId);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check how many luvs given today
  const count = await db
    .prepare('SELECT COUNT(*) as count FROM bebo_luvs WHERE from_user_id = ? AND day = ?')
    .bind(user.id, today)
    .first();

  if (count && (count as any).count >= 3) {
    return c.json({ error: 'You can only give 3 luvs per day' }, 400);
  }

  // Check if already gave luv to this person today
  const existing = await db
    .prepare('SELECT id FROM bebo_luvs WHERE from_user_id = ? AND to_user_id = ? AND day = ?')
    .bind(user.id, toUserId, today)
    .first();

  if (existing) {
    return c.json({ error: 'You already gave luv to this person today' }, 400);
  }

  const id = crypto.randomUUID();

  // Insert luv and update count in transaction
  await db.batch([
    db.prepare('INSERT INTO bebo_luvs (id, from_user_id, to_user_id, day) VALUES (?, ?, ?, ?)')
      .bind(id, user.id, toUserId, today),
    db.prepare('UPDATE bebo_profiles SET luv_count = luv_count + 1 WHERE user_id = ?')
      .bind(toUserId)
  ]);

  return c.json({ success: true });
});

// Check how many luvs remaining today
app.get('/api/luv/remaining', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = new Date().toISOString().split('T')[0];

  const count = await db
    .prepare('SELECT COUNT(*) as count FROM bebo_luvs WHERE from_user_id = ? AND day = ?')
    .bind(user.id, today)
    .first();

  const used = (count as any)?.count || 0;
  const remaining = 3 - used;

  // Also get who they gave luvs to today
  const given = await db
    .prepare(`
      SELECT l.to_user_id, COALESCE(u.alias, u.email) as to_name
      FROM bebo_luvs l
      JOIN users u ON l.to_user_id = u.id
      WHERE l.from_user_id = ? AND l.day = ?
    `)
    .bind(user.id, today)
    .all();

  return c.json({
    remaining,
    used,
    given: given.results || []
  });
});

// Get luvs received (with giver info)
app.get('/api/luv/received', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  const luvs = await db
    .prepare(`
      SELECT
        l.given_at, l.day,
        u.id as from_user_id, COALESCE(u.alias, u.email) as from_name,
        bp.profile_pic_key as from_pic
      FROM bebo_luvs l
      JOIN users u ON l.from_user_id = u.id
      LEFT JOIN bebo_profiles bp ON l.from_user_id = bp.user_id
      WHERE l.to_user_id = ?
      ORDER BY l.given_at DESC
      LIMIT 100
    `)
    .bind(user.id)
    .all();

  return c.json(luvs.results || []);
});

export default app;
