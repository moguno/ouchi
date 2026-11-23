-- Add arbitrary string properties to devices created before addendum 22.
-- The server checks PRAGMA table_info(devices) before applying this migration.
ALTER TABLE devices ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
