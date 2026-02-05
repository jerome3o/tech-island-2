-- Track which game's scores have been tallied to prevent double-counting
ALTER TABLE boggle_tournaments ADD COLUMN last_scored_game_id TEXT;
