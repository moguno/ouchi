-- Add arbitrary string properties to relations (the device/service
-- properties pattern, extended to relations at the user's request).
-- The server checks PRAGMA table_info(relations) before applying this migration.
ALTER TABLE relations ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
