-- Flashcard decks (collections of related cards)
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Individual flashcards
CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,

  -- Card content
  chinese TEXT NOT NULL,
  english TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  breakdown TEXT, -- JSON: character-by-character breakdown with meanings
  example_sentences TEXT, -- JSON: array of example sentences

  -- Audio
  audio_key TEXT, -- R2 object key for TTS audio

  -- SM-2 algorithm fields
  easiness_factor REAL NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 0, -- days until next review
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL DEFAULT (datetime('now')), -- when card is due for review

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_reviewed_at TEXT,

  FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
);

-- Card generation sessions (for the preview/approval flow)
CREATE TABLE IF NOT EXISTS flashcard_generation_sessions (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  deck_id INTEGER NOT NULL,
  input_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL, -- 30 minutes from creation
  FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
);

-- Temporary generated cards (before user approval)
CREATE TABLE IF NOT EXISTS flashcard_generated_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,

  -- Same fields as flashcards
  chinese TEXT NOT NULL,
  english TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  breakdown TEXT,
  example_sentences TEXT,

  FOREIGN KEY (session_id) REFERENCES flashcard_generation_sessions(id) ON DELETE CASCADE
);

-- Review history for statistics and analytics
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,

  -- Review outcome
  quality INTEGER NOT NULL, -- 0=Again, 1=Hard, 2=Good, 3=Easy
  time_taken_ms INTEGER, -- how long user took to review

  -- SM-2 state after this review
  easiness_factor REAL NOT NULL,
  interval INTEGER NOT NULL,
  repetitions INTEGER NOT NULL,

  reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due_date ON flashcards(due_date);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user ON flashcard_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_card ON flashcard_reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_generation_sessions_user ON flashcard_generation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_generated_cards_session ON flashcard_generated_cards(session_id);
