-- Candle Wax Physics Game
-- Stores high scores for the candle wax physics game

CREATE TABLE IF NOT EXISTS candle_wax_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  wax_collected INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_candle_wax_scores_user ON candle_wax_scores(user_id);
CREATE INDEX idx_candle_wax_scores_score ON candle_wax_scores(score DESC);
