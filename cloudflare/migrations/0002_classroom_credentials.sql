CREATE TABLE IF NOT EXISTS classroom_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  version TEXT NOT NULL,
  key_file TEXT NOT NULL
);
