-- Add status and admin approval fields to feature_requests
ALTER TABLE feature_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE feature_requests ADD COLUMN admin_response TEXT;
ALTER TABLE feature_requests ADD COLUMN responded_at INTEGER;
ALTER TABLE feature_requests ADD COLUMN type TEXT NOT NULL DEFAULT 'feature';

-- Feature request comments table
CREATE TABLE IF NOT EXISTS feature_request_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_request_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (feature_request_id) REFERENCES feature_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feature_request_comments_request_id ON feature_request_comments(feature_request_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
