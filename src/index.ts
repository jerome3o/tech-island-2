import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import type { AppContext } from './types';
import { authMiddleware } from './lib/auth';
import { claudeMiddleware } from './lib/claude';
import { ensureUser } from './lib/db';
import { saveSubscription, deleteSubscription } from './lib/push';
import { isValidDisplayName } from './lib/displayNames';

// Import apps
import homeApp from './apps/home/api';
import helloApp from './apps/hello/api';
import chatApp from './apps/chat/api';
import splitsApp from './apps/splits/api';
import boggleApp from './apps/boggle/api';
import beboApp from './apps/bebo/api';
import featureRequestsApp from './apps/feature-requests/api';
import flashcardsApp from './apps/flashcards/api';

const app = new Hono<AppContext>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin) => origin, // Allow same-origin and development
  credentials: true
}));

// Auth middleware for all API routes (including app-specific ones like /hello/api/*)
app.use('/api/*', authMiddleware);
app.use('/api/*', claudeMiddleware);
app.use('/*/api/*', authMiddleware);
app.use('/*/api/*', claudeMiddleware);

// Ensure user exists in DB on first request
app.use('/api/*', async (c, next) => {
  const user = c.get('user');
  if (user) {
    await ensureUser(c.env.DB, user.id, user.email);
  }
  return next();
});

app.use('/*/api/*', async (c, next) => {
  const user = c.get('user');
  if (user) {
    await ensureUser(c.env.DB, user.id, user.email);
  }
  return next();
});

// ============================================
// Core API routes
// ============================================

// Get current user info
app.get('/api/me', async (c) => {
  const user = c.get('user');
  return c.json(user);
});

// Update user display name
app.put('/api/me/displayname', async (c) => {
  const user = c.get('user');
  const { displayName } = await c.req.json();

  if (!isValidDisplayName(displayName)) {
    return c.json({
      error: 'Display name must be 3-30 characters and contain only letters, numbers, spaces, hyphens, and underscores'
    }, 400);
  }

  const trimmed = displayName.trim();

  // Update display name (alias column)
  await c.env.DB.prepare(
    'UPDATE users SET alias = ? WHERE id = ?'
  ).bind(trimmed, user.id).run();

  return c.json({ success: true, displayName: trimmed });
});

// Push notification subscription management
app.post('/api/push/subscribe', async (c) => {
  const user = c.get('user');
  const subscription = await c.req.json();
  await saveSubscription(c.env.DB, user.id, subscription);
  return c.json({ success: true });
});

app.delete('/api/push/subscribe', async (c) => {
  const user = c.get('user');
  await deleteSubscription(c.env.DB, user.id);
  return c.json({ success: true });
});

// Get VAPID public key for push subscription
app.get('/api/push/vapid-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});

// Test push notification
app.post('/api/push/test', async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    message: `Test notification would be sent to ${user.email}`,
    note: 'Full push implementation requires web-push library'
  });
});

// ============================================
// App routes
// ============================================

// Mount apps at their paths
app.route('/', homeApp);
app.route('/hello', helloApp);
app.route('/chat', chatApp);
app.route('/splits', splitsApp);
app.route('/boggle', boggleApp);
app.route('/bebo', beboApp);
app.route('/feature-requests', featureRequestsApp);
app.route('/flashcards', flashcardsApp);

// ============================================
// Static file serving
// ============================================

// Serve app-specific UI files
// Note: This is handled by the assets binding in wrangler.toml
// Files in public/ are automatically served

// Catch-all for app UIs - serve index.html for SPA routing
app.get('/:app/*', async (c) => {
  // This would serve the app's index.html for client-side routing
  // The actual implementation depends on how we structure the UI files
  return c.notFound();
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
