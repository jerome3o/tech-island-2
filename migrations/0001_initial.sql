-- Initial schema for Towerhouse Apps

-- Users table (synced from Cloudflare Access)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Hello app: visit tracking
CREATE TABLE IF NOT EXISTS hello_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hello_visits_user_id ON hello_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
