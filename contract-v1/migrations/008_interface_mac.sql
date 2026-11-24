-- Add a nullable MAC address to interfaces (schema v0.9).
-- The server checks PRAGMA table_info(interfaces) before applying this migration.
ALTER TABLE interfaces ADD COLUMN mac TEXT;
