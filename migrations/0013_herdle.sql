-- Herdle: 6-letter word guessing game

-- Table to store valid 6-letter words
CREATE TABLE IF NOT EXISTS herdle_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    difficulty INTEGER DEFAULT 1, -- 1 = easy, 2 = medium, 3 = hard
    is_solution INTEGER DEFAULT 1, -- 1 = can be daily word, 0 = valid guess only
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Table to track user games for each day
CREATE TABLE IF NOT EXISTS herdle_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    game_date TEXT NOT NULL, -- YYYY-MM-DD format
    guesses TEXT NOT NULL, -- JSON array of guesses
    completed INTEGER DEFAULT 0, -- 0 = in progress, 1 = won, 2 = lost
    attempts_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    UNIQUE(user_id, game_date)
);

-- Table to track user statistics
CREATE TABLE IF NOT EXISTS herdle_stats (
    user_id TEXT PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    guess_distribution TEXT DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0}', -- JSON object
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_herdle_games_user_date ON herdle_games(user_id, game_date);
CREATE INDEX IF NOT EXISTS idx_herdle_words_solution ON herdle_words(is_solution);
