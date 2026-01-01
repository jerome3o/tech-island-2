-- Feature requests table
CREATE TABLE IF NOT EXISTS feature_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Feature request reactions table
CREATE TABLE IF NOT EXISTS feature_request_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_request_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (feature_request_id) REFERENCES feature_requests(id) ON DELETE CASCADE,
  UNIQUE (feature_request_id, user_id, emoji)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON feature_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_request_reactions_request_id ON feature_request_reactions(feature_request_id);
CREATE INDEX IF NOT EXISTS idx_feature_request_reactions_user_id ON feature_request_reactions(user_id);
