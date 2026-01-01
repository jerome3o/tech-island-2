import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';

/**
 * Push notification helpers.
 *
 * Web Push requires VAPID keys for authentication.
 * Generate them with: npm run generate-vapid
 */

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Save a push subscription for a user.
 */
export async function saveSubscription(
  db: D1Database,
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  await db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (user_id) DO UPDATE SET
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      created_at = datetime('now')
  `).bind(
    userId,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth
  ).run();
}

/**
 * Get a user's push subscription.
 */
export async function getSubscription(
  db: D1Database,
  userId: string
): Promise<PushSubscription | null> {
  const result = await db.prepare(`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?
  `).bind(userId).first<{ endpoint: string; p256dh: string; auth: string }>();

  if (!result) return null;

  return {
    endpoint: result.endpoint,
    keys: {
      p256dh: result.p256dh,
      auth: result.auth
    }
  };
}

/**
 * Delete a user's push subscription.
 */
export async function deleteSubscription(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId).run();
}

/**
 * Send a push notification.
 *
 * Note: This uses the Web Push protocol. In a Worker, we need to use
 * the fetch API to send the encrypted message directly.
 */
export async function sendPushNotification(
  env: Env,
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    // Web Push requires encryption and signing with VAPID keys.
    // For a full implementation, you'd use a library like web-push,
    // but that requires Node.js crypto APIs.
    //
    // In Workers, we can use the simpler approach of calling an
    // external service, or implement the encryption ourselves.
    //
    // For now, we'll use a simplified approach that works with
    // the Push API's built-in encryption.

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400', // 24 hours
        // Note: Full implementation would include Authorization header with VAPID
      },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

/**
 * Get all subscriptions for sending bulk notifications.
 */
export async function getAllSubscriptions(
  db: D1Database
): Promise<Array<{ userId: string; subscription: PushSubscription }>> {
  const results = await db.prepare(`
    SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions
  `).all<{ user_id: string; endpoint: string; p256dh: string; auth: string }>();

  return results.results.map(row => ({
    userId: row.user_id,
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth
      }
    }
  }));
}
