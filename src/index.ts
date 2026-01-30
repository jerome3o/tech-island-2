import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import type { AppContext, Env } from './types';
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
import hotTakesApp from './apps/hot-takes/api';
import paintApp from './apps/paint/api';
import adminApp from './apps/admin/api';
import partyGamesApp from './apps/party-games/api';
import candleWaxApp from './apps/candle-wax/api';

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
app.route('/hot-takes', hotTakesApp);
app.route('/paint', paintApp);
app.route('/admin', adminApp);
app.route('/party-games', partyGamesApp);
app.route('/candle-wax', candleWaxApp);

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

// ============================================
// Scheduled events (cron jobs)
// ============================================

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Clean up abandoned Boggle games
    const now = Date.now();
    const tenMinutesAgo = now - (10 * 60 * 1000); // 10 minutes in milliseconds

    try {
      // Clean up lobby games older than 10 minutes
      const lobbyCleanup = await env.DB.prepare(`
        DELETE FROM boggle_games
        WHERE state = 'lobby'
          AND created_at < ?
      `).bind(tenMinutesAgo).run();

      // Clean up playing games that are way past their time limit (2x timer duration)
      // This is a safety net in case the state endpoint didn't finish them
      const playingGamesResult = await env.DB.prepare(`
        SELECT id, start_time, timer_seconds
        FROM boggle_games
        WHERE state = 'playing'
          AND start_time IS NOT NULL
      `).all();

      let playingCleanupCount = 0;
      for (const game of playingGamesResult.results as any[]) {
        const elapsed = now - game.start_time;
        const maxTime = game.timer_seconds * 1000 * 2; // 2x the timer

        if (elapsed > maxTime) {
          await env.DB.prepare(`
            UPDATE boggle_games
            SET state = 'finished'
            WHERE id = ?
          `).bind(game.id).run();
          playingCleanupCount++;
        }
      }

      console.log(`[Cron] Cleaned up ${lobbyCleanup.meta.changes} lobby games and ${playingCleanupCount} playing games`);
    } catch (error) {
      console.error('[Cron] Error cleaning up Boggle games:', error);
    }

    // Clean up abandoned Boggle tournaments
    try {
      const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds

      // Clean up lobby tournaments older than 10 minutes
      const tournamentLobbyCleanup = await env.DB.prepare(`
        DELETE FROM boggle_tournaments
        WHERE state = 'lobby'
          AND created_at < ?
      `).bind(tenMinutesAgo).run();

      // Finish active tournaments that have been abandoned (no activity for 1 hour)
      const abandonedTournaments = await env.DB.prepare(`
        SELECT id
        FROM boggle_tournaments
        WHERE state = 'active'
          AND last_activity_at < ?
      `).bind(oneHourAgo).all();

      let tournamentFinishedCount = 0;
      for (const tournament of abandonedTournaments.results as any[]) {
        // Find the leader and declare them winner
        const leader = await env.DB.prepare(`
          SELECT user_id, total_score
          FROM boggle_tournament_players
          WHERE tournament_id = ?
          ORDER BY total_score DESC
          LIMIT 1
        `).bind(tournament.id).first();

        await env.DB.prepare(`
          UPDATE boggle_tournaments
          SET state = 'finished', winner_id = ?, finished_at = ?
          WHERE id = ?
        `).bind(leader?.user_id || null, now, tournament.id).run();
        tournamentFinishedCount++;
      }

      console.log(`[Cron] Cleaned up ${tournamentLobbyCleanup.meta.changes} lobby tournaments and finished ${tournamentFinishedCount} abandoned tournaments`);
    } catch (error) {
      console.error('[Cron] Error cleaning up Boggle tournaments:', error);
    }
  }
};
