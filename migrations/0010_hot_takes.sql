-- Hot Takes App
-- Users can submit hot takes and argue about them in comment threads

CREATE TABLE IF NOT EXISTS hot_takes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS hot_take_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hot_take_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (hot_take_id) REFERENCES hot_takes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hot_takes_created_at ON hot_takes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hot_take_comments_hot_take_id ON hot_take_comments(hot_take_id);
CREATE INDEX IF NOT EXISTS idx_hot_take_comments_created_at ON hot_take_comments(created_at);
