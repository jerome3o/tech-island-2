-- Boggle Tournament Mode

-- Tournament instances
CREATE TABLE IF NOT EXISTS boggle_tournaments (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('lobby', 'active', 'finished')),
  target_score INTEGER NOT NULL DEFAULT 100,
  timer_seconds INTEGER NOT NULL DEFAULT 120, -- Timer for each game in tournament
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  winner_id TEXT, -- Set when tournament finishes
  finished_at INTEGER, -- Timestamp when tournament finished
  current_game_id TEXT, -- Currently active game (if any)
  last_activity_at INTEGER NOT NULL -- For abandonment detection
);

-- Players in tournaments
CREATE TABLE IF NOT EXISTS boggle_tournament_players (
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  ready INTEGER NOT NULL DEFAULT 0, -- Boolean: ready for next game
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, user_id),
  FOREIGN KEY (tournament_id) REFERENCES boggle_tournaments(id) ON DELETE CASCADE
);

-- Games in tournaments (links boggle_games to tournaments)
CREATE TABLE IF NOT EXISTS boggle_tournament_games (
  tournament_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_number INTEGER NOT NULL, -- Sequence: 1, 2, 3...
  PRIMARY KEY (tournament_id, game_id),
  FOREIGN KEY (tournament_id) REFERENCES boggle_tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES boggle_games(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boggle_tournaments_state ON boggle_tournaments(state);
CREATE INDEX IF NOT EXISTS idx_boggle_tournament_players_user ON boggle_tournament_players(user_id);
CREATE INDEX IF NOT EXISTS idx_boggle_tournament_games_tournament ON boggle_tournament_games(tournament_id);
