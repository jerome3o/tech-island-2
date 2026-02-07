-- Game Counters: track scores for various games
CREATE TABLE IF NOT EXISTS game_counter_sessions (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL,
  name TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active',
  settings TEXT DEFAULT '{}',
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS game_counter_players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES game_counter_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_counter_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  score INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES game_counter_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES game_counter_players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gc_sessions_created_by ON game_counter_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_gc_players_session ON game_counter_players(session_id);
CREATE INDEX IF NOT EXISTS idx_gc_scores_session ON game_counter_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_gc_scores_player ON game_counter_scores(player_id);
