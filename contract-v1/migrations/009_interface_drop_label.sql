-- Drop the interface label (schema v0.10): it was displayed nowhere, and
-- endpoint notes belong to relation labels.
-- The server checks PRAGMA table_info(interfaces) before applying this migration.
ALTER TABLE interfaces DROP COLUMN label;
