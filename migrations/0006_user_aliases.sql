-- Add user aliases
ALTER TABLE users ADD COLUMN alias TEXT;
CREATE INDEX IF NOT EXISTS idx_users_alias ON users(alias);
