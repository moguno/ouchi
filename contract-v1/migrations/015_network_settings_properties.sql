-- Migration 015: networks and settings gain a properties map (the
-- network memo and the ouchi memo), joining the device, service and
-- relation memos.
ALTER TABLE networks ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
ALTER TABLE settings ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
