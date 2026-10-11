CREATE TABLE IF NOT EXISTS classroom_reviews (
  serial INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  digest TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS classroom_reviews_visible ON classroom_reviews(deleted_at, created_at DESC, serial DESC);
