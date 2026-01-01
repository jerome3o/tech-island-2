import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { generateText } from '../../lib/claude';
import { getSubscription, saveSubscription, deleteSubscription, sendPushNotification } from '../../lib/push';

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

// ============================================
// Notification Debugging Endpoints
// ============================================

// Get current notification subscription status
app.get('/api/notifications/status', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const subscription = await getSubscription(db, user.id);

  return c.json({
    hasSubscription: !!subscription,
    subscription: subscription ? {
      endpoint: subscription.endpoint,
      // Don't expose the full keys for security
      hasKeys: !!(subscription.keys.p256dh && subscription.keys.auth)
    } : null,
    vapidPublicKey: c.env.VAPID_PUBLIC_KEY
  });
});

// Send a test push notification
app.post('/api/notifications/test', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const subscription = await getSubscription(db, user.id);

  if (!subscription) {
    return c.json({
      success: false,
      error: 'No push subscription found. Please subscribe to notifications first.'
    }, 400);
  }

  const success = await sendPushNotification(c.env, subscription, {
    title: 'Test Notification from Hello App',
    body: `This is a test push notification sent at ${new Date().toLocaleTimeString()}`,
    icon: '/icons/icon-192.png',
    url: '/hello/',
    tag: 'test-notification'
  });

  return c.json({
    success,
    message: success
      ? 'Push notification sent successfully!'
      : 'Failed to send push notification. Check console for details.'
  });
});

// Subscribe to notifications (same as global endpoint but app-specific)
app.post('/api/notifications/subscribe', async (c) => {
  const user = c.get('user');
  const subscription = await c.req.json();

  await saveSubscription(c.env.DB, user.id, subscription);

  return c.json({
    success: true,
    message: 'Successfully subscribed to push notifications'
  });
});

// Unsubscribe from notifications
app.delete('/api/notifications/subscribe', async (c) => {
  const user = c.get('user');

  await deleteSubscription(c.env.DB, user.id);

  return c.json({
    success: true,
    message: 'Successfully unsubscribed from push notifications'
  });
});

export default app;
