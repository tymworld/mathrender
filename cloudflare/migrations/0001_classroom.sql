CREATE TABLE IF NOT EXISTS classroom_photos (
  serial INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  digest TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  reviewed_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS classroom_visible ON classroom_photos(deleted_at, serial DESC);
CREATE TABLE IF NOT EXISTS classroom_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
