CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  parent_id INTEGER,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  edit_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_entry_id ON comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
