import type { D1Database, D1Result } from '@cloudflare/workers-types';

/**
 * Helper functions for working with D1.
 *
 * D1 is Cloudflare's serverless SQLite database.
 * Access it via c.env.DB in your route handlers.
 */

/**
 * Ensure a user exists in the database, creating them if necessary.
 */
export async function ensureUser(db: D1Database, userId: string, email: string): Promise<void> {
  await db.prepare(`
    INSERT INTO users (id, email, created_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT (id) DO UPDATE SET email = excluded.email
  `).bind(userId, email).run();
}

/**
 * Get a user by ID.
 */
export async function getUser(db: D1Database, userId: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
}

/**
 * Generic pagination helper.
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Execute a paginated query.
 */
export async function paginatedQuery<T>(
  db: D1Database,
  baseQuery: string,
  countQuery: string,
  params: unknown[],
  pagination: PaginationParams = {}
): Promise<PaginatedResult<T>> {
  const limit = Math.min(pagination.limit ?? 20, 100);
  const offset = pagination.offset ?? 0;

  const [items, countResult] = await Promise.all([
    db.prepare(`${baseQuery} LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all<T>(),
    db.prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>()
  ]);

  return {
    items: items.results,
    total: countResult?.count ?? 0,
    limit,
    offset
  };
}
