-- ouchi.local ledger schema v0.4 (draft, 2026-11-21)
-- From DB_SCHEMA_DRAFT.md v0.4. Changes from v0.3:
--  * devices.petname stores an optional display nickname. It is trimmed by the
--    API and an empty value is stored as NULL.
--  * devices.category gains 'service' for external SaaS (user decision
--    2026-11-21). A category='service' device is a pseudo-device that
--    represents an external service (Notion, pCloud, ...): it belongs to
--    a network (typically the internet network) through a membership
--    whose ip is NULL, has SSH/meters off, and carries services whose
--    service_url holds the full URL. The internet network itself is NOT
--    special-cased: services still always hang off a membership, and
--    relations to on-prem devices work like any other device.
-- v0.3 history:
--  * relations table added (generic model: target + tag + degree/colour);
--    devices.parent_device_id is gone.
--  * IPs live on memberships (device_networks.ip), not on devices;
--    services reference a membership (device_network_id), matching the
--    Codex mock's PortalDataV2 shape so the GUI can escape the mock.
--  * devices.category (network/physical/vm); is_vm kept consistent by CHECK.
-- This file is a DRAFT: app/schema.sql (v0.1) stays the live vertical
-- slice until this is reviewed and deployed.
CREATE TABLE IF NOT EXISTS networks (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  cidr TEXT,
  accent TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY,
  hostname TEXT UNIQUE NOT NULL,
  petname TEXT,
  category TEXT NOT NULL DEFAULT 'physical'
    CHECK (category IN ('network', 'physical', 'vm', 'service')),
  is_vm INTEGER NOT NULL DEFAULT 0 CHECK (is_vm IN (0, 1)),
  ssh_user TEXT,
  ssh_port INTEGER CHECK (ssh_port BETWEEN 1 AND 65535),
  meter_enabled INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  CHECK (is_vm = (category = 'vm'))
);
CREATE TABLE IF NOT EXISTS device_networks (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  network_id INTEGER NOT NULL REFERENCES networks(id),
  ip TEXT,
  label TEXT,
  UNIQUE (device_id, network_id)
);
CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY,
  from_device_id INTEGER NOT NULL REFERENCES devices(id),
  to_device_id INTEGER NOT NULL REFERENCES devices(id),
  tag TEXT,
  from_label TEXT,
  to_label TEXT,
  color TEXT NOT NULL,
  CHECK (from_device_id <> to_device_id)
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  device_network_id INTEGER NOT NULL REFERENCES device_networks(id),
  subdomain TEXT UNIQUE NOT NULL,
  petname TEXT,
  description TEXT,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  protocol TEXT NOT NULL CHECK (protocol IN ('tcp', 'udp')),
  scheme TEXT NOT NULL DEFAULT 'http' CHECK (scheme IN ('http', 'https')),
  service_url TEXT,
  top_path TEXT,
  monitor_path TEXT,
  -- Canonical values: generic:<key>, favicon, url:<http(s)-image-url>.
  -- favicon_url remains only as a legacy import/read compatibility column.
  icon_key TEXT,
  favicon_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  domain TEXT NOT NULL DEFAULT 'ouchi.local',
  title TEXT NOT NULL DEFAULT 'あなたのホームラボ'
);
-- Key-pair management (May proposal, 2026-11-19; priority undecided).
-- Ledger only: public keys here, private keys stay in SOPS, never in DB.
CREATE TABLE IF NOT EXISTS ssh_keys (
  id INTEGER PRIMARY KEY,
  owner TEXT NOT NULL,
  purpose TEXT NOT NULL,
  key_type TEXT NOT NULL,
  public_key TEXT UNIQUE NOT NULL,
  fingerprint TEXT,
  expires_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  note TEXT
);
CREATE TABLE IF NOT EXISTS device_keys (
  device_id INTEGER NOT NULL REFERENCES devices(id),
  key_id INTEGER NOT NULL REFERENCES ssh_keys(id),
  PRIMARY KEY (device_id, key_id)
);
