-- Migration 011 (2026-11-25): drop devices.is_vm.
--
-- is_vm was a derived flag kept consistent with category by a CHECK
-- constraint (is_vm = (category = 'vm')). The category alone carries
-- the information, so the column goes away. DROP COLUMN cannot be
-- used: the table-level CHECK references is_vm and SQLite refuses to
-- drop it. Rebuild the table instead, following the documented
-- procedure (foreign keys off, copy, drop, rename, foreign keys on).
-- Device ids are preserved, so interfaces keep pointing at the same
-- devices. The server checks PRAGMA table_info(devices) before
-- applying this migration, so it runs only where is_vm still exists.

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

CREATE TABLE devices_new (
  id INTEGER PRIMARY KEY,
  hostname TEXT UNIQUE NOT NULL,
  petname TEXT,
  category TEXT NOT NULL DEFAULT 'physical'
    CHECK (category IN ('network', 'physical', 'vm', 'service')),
  ssh_user TEXT,
  ssh_port INTEGER CHECK (ssh_port BETWEEN 1 AND 65535),
  meter_enabled INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  properties TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO devices_new
  (id, hostname, petname, category, ssh_user, ssh_port,
   meter_enabled, note, properties)
SELECT id, hostname, petname, category, ssh_user, ssh_port,
       meter_enabled, note, properties
FROM devices;

DROP TABLE devices;
ALTER TABLE devices_new RENAME TO devices;

COMMIT;

PRAGMA foreign_keys = ON;
