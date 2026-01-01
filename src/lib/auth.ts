import type { Context, Next } from 'hono';
import type { AppContext, User } from '../types';

/**
 * Middleware to extract user information from Cloudflare Access JWT.
 *
 * Cloudflare Access adds headers to authenticated requests:
 * - CF-Access-Authenticated-User-Email: The user's email
 * - CF-Access-JWT-Assertion: The full JWT (can be decoded for more claims)
 */
export async function authMiddleware(c: Context<AppContext>, next: Next) {
  const email = c.req.header('CF-Access-Authenticated-User-Email');

  if (!email) {
    // In development without Cloudflare Access, use a default user
    if (c.env.APP_URL?.includes('localhost') || c.req.header('Host')?.includes('localhost')) {
      c.set('user', {
        id: 'dev-user',
        email: 'dev@localhost',
        name: 'Dev User'
      });
      return next();
    }

    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Create a stable user ID from the email
  const id = await hashEmail(email);

  const user: User = {
    id,
    email,
    name: email.split('@')[0]
  };

  c.set('user', user);
  return next();
}

/**
 * Create a stable hash of an email for use as a user ID.
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the current user from context.
 */
export function getUser(c: Context<AppContext>): User {
  return c.get('user');
}
