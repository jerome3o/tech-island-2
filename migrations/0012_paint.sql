-- Paint app: artworks table
CREATE TABLE IF NOT EXISTS artworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  image_data TEXT NOT NULL, -- Base64 encoded PNG
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_user_id ON artworks(user_id);

-- Artwork comments
CREATE TABLE IF NOT EXISTS artwork_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artwork_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  is_critique INTEGER DEFAULT 0, -- 1 if this is a Claude-generated critique
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artwork_comments_artwork ON artwork_comments(artwork_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artwork_comments_user ON artwork_comments(user_id);
