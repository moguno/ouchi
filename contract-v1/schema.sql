-- ouchi.local ledger schema v0.14 (2026-11-25)
-- v0.14 shrinks service icons to three choices (migration 013): the
-- service's favicon, an explicit image URL, or unset (NULL). Stored
-- generic / preset references become unset; dashboard references
-- become their CDN image URL.
-- v0.13 gives relation names endpoint shapes (migration 012): each end
-- of a relation line is one of none / arrow / circle / square / diamond,
-- defaulting to the circle dots the portal has always drawn.
-- v0.11 turns the network accent into a free CSS color (migration 010):
-- the five tone names become their palette hex values, and the portal
-- derives its accent shades from the stored color. v0.10 drops the
-- interface label (migration 009): it was displayed
-- nowhere, and endpoint notes belong to relation labels. v0.9 added a
-- nullable MAC address to interfaces (migration 008), so a switch port
-- or NIC can carry its L2 address alongside the optional IP.
-- v0.8 introduces interfaces: the membership (device_networks) is absorbed
-- into a per-device interface. An interface has a name (eth0, wan1,
-- ポート1, ...), belongs to at most one network, and carries at most one
-- IP (nullable: switch ports have no IP). Relations connect interfaces,
-- not devices, so a link lands on the exact interface it uses; services
-- hang off an interface and take its IP. Trunk ports are modelled as
-- logical interfaces (ポート1-1, ポート1-2), one network context each.
-- Migration 007 converts existing ledgers.
-- Addendum 24 separates reusable relation definitions from relation edges.
--  * relation_names is a pure category: natural key, colour, and the
--    endpoint shapes of its lines (line_start / line_end).
--  * relations stores the relation-name reference, both devices and both
--    endpoint labels as free text.
--  * the same device pair may have multiple relation names, while
--    the relation name, devices and both labels stay unique together.
-- The 2026-11-23 label move retired the supplement-1 templates: labels used
-- to live on relation_names as {} templates with per-relation placeholder
-- values; migration 006 expands them into per-relation free-text labels.
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
--  * devices.category (network/physical/vm/service). v0.12 dropped the
--    derived is_vm flag; the category alone says whether a device is a VM.
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
  ssh_user TEXT,
  ssh_port INTEGER CHECK (ssh_port BETWEEN 1 AND 65535),
  meter_enabled INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  properties TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS interfaces (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  name TEXT NOT NULL,
  network_id INTEGER REFERENCES networks(id),
  ip TEXT,
  mac TEXT,
  UNIQUE (device_id, name)
);
CREATE TABLE IF NOT EXISTS relation_names (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL,
  line_start TEXT NOT NULL DEFAULT 'circle'
    CHECK (line_start IN ('none', 'arrow', 'circle', 'square', 'diamond')),
  line_end TEXT NOT NULL DEFAULT 'circle'
    CHECK (line_end IN ('none', 'arrow', 'circle', 'square', 'diamond'))
);
CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY,
  relation_name_id INTEGER NOT NULL REFERENCES relation_names(id),
  from_interface_id INTEGER NOT NULL REFERENCES interfaces(id),
  to_interface_id INTEGER NOT NULL REFERENCES interfaces(id),
  from_label TEXT NOT NULL DEFAULT '',
  to_label TEXT NOT NULL DEFAULT '',
  CHECK (from_interface_id <> to_interface_id),
  UNIQUE (
    relation_name_id,
    from_interface_id,
    to_interface_id,
    from_label,
    to_label
  )
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES interfaces(id),
  subdomain TEXT UNIQUE NOT NULL,
  petname TEXT,
  description TEXT,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  protocol TEXT NOT NULL CHECK (protocol IN ('tcp', 'udp')),
  scheme TEXT NOT NULL DEFAULT 'http' CHECK (scheme IN ('http', 'https')),
  service_url TEXT,
  top_path TEXT,
  monitor_path TEXT,
  -- Canonical values: NULL (unset), favicon, url:<http(s)-image-url>.
  -- favicon_url remains only as a legacy import/read compatibility column.
  icon_key TEXT,
  favicon_url TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
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
