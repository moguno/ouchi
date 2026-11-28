-- Add arbitrary string properties to interfaces (the device/service
-- properties pattern, extended to interfaces at the user's request).
-- The server checks PRAGMA table_info(interfaces) before applying this migration.
ALTER TABLE interfaces ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
