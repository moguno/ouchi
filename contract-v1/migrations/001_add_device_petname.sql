-- Add the optional device petname to databases created before addendum 18.
-- The server checks PRAGMA table_info(devices) before applying this migration,
-- so this ALTER TABLE is idempotent at the application level.
ALTER TABLE devices ADD COLUMN petname TEXT;
