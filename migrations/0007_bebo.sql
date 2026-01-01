-- Bebo profiles
CREATE TABLE IF NOT EXISTS bebo_profiles (
  user_id TEXT PRIMARY KEY,
  bio TEXT,
  profile_pic_key TEXT,
  cover_photo_key TEXT,
  luv_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Wall posts
CREATE TABLE IF NOT EXISTS bebo_wall_posts (
  id TEXT PRIMARY KEY,
  wall_owner_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (wall_owner_id) REFERENCES bebo_profiles(user_id),
  FOREIGN KEY (author_id) REFERENCES bebo_profiles(user_id)
);

CREATE INDEX IF NOT EXISTS idx_wall_posts_owner ON bebo_wall_posts(wall_owner_id, created_at DESC);

-- Luvs (3 per day limit)
CREATE TABLE IF NOT EXISTS bebo_luvs (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  given_at INTEGER DEFAULT (strftime('%s', 'now')),
  day TEXT NOT NULL, -- Format: YYYY-MM-DD for daily limit tracking
  FOREIGN KEY (from_user_id) REFERENCES bebo_profiles(user_id),
  FOREIGN KEY (to_user_id) REFERENCES bebo_profiles(user_id),
  UNIQUE(from_user_id, to_user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_luvs_from_day ON bebo_luvs(from_user_id, day);
CREATE INDEX IF NOT EXISTS idx_luvs_to ON bebo_luvs(to_user_id);
