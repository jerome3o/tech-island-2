-- Splitwise clone: expense sharing app

-- Groups for sharing expenses
CREATE TABLE IF NOT EXISTS sw_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Group members
CREATE TABLE IF NOT EXISTS sw_group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  nickname TEXT,  -- Optional display name within group
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES sw_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(group_id, user_id)
);

-- Expense categories
CREATE TABLE IF NOT EXISTS sw_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL
);

-- Insert default categories
INSERT INTO sw_categories (name, icon, color) VALUES
  ('General', '📦', '#6B7280'),
  ('Food & Drink', '🍕', '#EF4444'),
  ('Groceries', '🛒', '#22C55E'),
  ('Transport', '🚗', '#3B82F6'),
  ('Entertainment', '🎬', '#A855F7'),
  ('Utilities', '💡', '#F59E0B'),
  ('Rent', '🏠', '#EC4899'),
  ('Travel', '✈️', '#14B8A6'),
  ('Shopping', '🛍️', '#8B5CF6'),
  ('Other', '📝', '#64748B');

-- Expenses
CREATE TABLE IF NOT EXISTS sw_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,  -- Total amount in cents
  currency TEXT NOT NULL DEFAULT 'NZD',
  category_id INTEGER NOT NULL DEFAULT 1,
  paid_by TEXT NOT NULL,  -- User who paid
  split_type TEXT NOT NULL DEFAULT 'equal',  -- 'equal', 'exact', 'percentage'
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,  -- Soft delete
  FOREIGN KEY (group_id) REFERENCES sw_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES sw_categories(id),
  FOREIGN KEY (paid_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Expense splits - who owes what for each expense
CREATE TABLE IF NOT EXISTS sw_expense_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,  -- Amount this user owes (in cents)
  FOREIGN KEY (expense_id) REFERENCES sw_expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(expense_id, user_id)
);

-- Settlements - payments between users
CREATE TABLE IF NOT EXISTS sw_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  from_user TEXT NOT NULL,  -- Who paid
  to_user TEXT NOT NULL,    -- Who received
  amount REAL NOT NULL,     -- Amount in cents
  currency TEXT NOT NULL DEFAULT 'NZD',
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,  -- Soft delete
  FOREIGN KEY (group_id) REFERENCES sw_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user) REFERENCES users(id),
  FOREIGN KEY (to_user) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Activity log for groups
CREATE TABLE IF NOT EXISTS sw_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'expense_added', 'expense_updated', 'expense_deleted', 'settlement_added', 'member_added', etc.
  target_type TEXT,      -- 'expense', 'settlement', 'member'
  target_id INTEGER,
  details TEXT,          -- JSON with additional details
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES sw_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sw_group_members_group ON sw_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sw_group_members_user ON sw_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_expenses_group ON sw_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_sw_expenses_paid_by ON sw_expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_sw_expense_splits_expense ON sw_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_sw_expense_splits_user ON sw_expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_settlements_group ON sw_settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_sw_activity_group ON sw_activity(group_id);
