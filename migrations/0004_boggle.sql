-- Boggle multiplayer game

-- Dictionary of valid words (Scrabble SOWPODS)
CREATE TABLE IF NOT EXISTS boggle_dictionary (
  word TEXT PRIMARY KEY
);

-- Game instances
CREATE TABLE IF NOT EXISTS boggle_games (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('lobby', 'playing', 'finished')),
  board TEXT NOT NULL, -- JSON array of 16 letters
  timer_seconds INTEGER NOT NULL DEFAULT 120,
  start_time INTEGER, -- Unix timestamp when game started
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

-- Players in games
CREATE TABLE IF NOT EXISTS boggle_players (
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, user_id),
  FOREIGN KEY (game_id) REFERENCES boggle_games(id) ON DELETE CASCADE
);

-- Words found by players
CREATE TABLE IF NOT EXISTS boggle_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  points INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES boggle_games(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boggle_games_state ON boggle_games(state);
CREATE INDEX IF NOT EXISTS idx_boggle_words_game ON boggle_words(game_id);
CREATE INDEX IF NOT EXISTS idx_boggle_words_game_user ON boggle_words(game_id, user_id);
