ALTER TABLE classroom_reviews ADD COLUMN photo_key TEXT NOT NULL DEFAULT '';
CREATE INDEX classroom_reviews_photo_groups ON classroom_reviews(deleted_at, photo_key, created_at DESC);
