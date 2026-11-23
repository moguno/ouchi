-- Add arbitrary string properties to services created before addendum 22.
-- The server checks PRAGMA table_info(services) before applying this migration.
ALTER TABLE services ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
