-- Migration 007 (2026-11-23): memberships become interfaces.
--
-- device_networks is absorbed into a new interfaces table: each
-- membership becomes one interface of its device, keeping the same row
-- id (so services keep pointing at the same numeric id through their
-- rebuild). Generated interface names are eth0, eth1, ... per device in
-- membership id order. Devices without any membership gain one bare
-- eth0 (no network, no IP) so their relations can be re-pointed.
--
-- Relations are rebuilt with interface endpoints: for each endpoint
-- device, prefer an interface on a network the other endpoint also
-- sits on (the shared-segment heuristic); otherwise the device's first
-- interface. Services are rebuilt renaming device_network_id to
-- interface_id. Runs only where device_networks still exists.
--
-- The current schema.sql may already have created an (empty) interfaces
-- table in a newer shape before this migration runs; drop it and create
-- the 007-era shape (with label; migrations 008/009 adjust it after).

DROP TABLE IF EXISTS interfaces;
CREATE TABLE interfaces (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  name TEXT NOT NULL,
  network_id INTEGER REFERENCES networks(id),
  ip TEXT,
  label TEXT,
  UNIQUE (device_id, name)
);

INSERT INTO interfaces (id, device_id, name, network_id, ip, label)
SELECT dn.id,
       dn.device_id,
       'eth' || (
         SELECT COUNT(*) FROM device_networks earlier
         WHERE earlier.device_id = dn.device_id AND earlier.id < dn.id
       ),
       dn.network_id,
       dn.ip,
       dn.label
FROM device_networks dn;

INSERT INTO interfaces (device_id, name, network_id, ip, label)
SELECT d.id, 'eth0', NULL, NULL, NULL
FROM devices d
WHERE NOT EXISTS (SELECT 1 FROM interfaces i WHERE i.device_id = d.id);

ALTER TABLE relations RENAME TO relations_old;

CREATE TABLE relations (
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

INSERT INTO relations
  (id, relation_name_id, from_interface_id, to_interface_id,
   from_label, to_label)
SELECT r.id,
       r.relation_name_id,
       COALESCE(
         (SELECT i.id FROM interfaces i
           WHERE i.device_id = r.from_device_id
             AND i.network_id IS NOT NULL
             AND i.network_id IN (
               SELECT network_id FROM interfaces
               WHERE device_id = r.to_device_id
                 AND network_id IS NOT NULL)
           ORDER BY i.id LIMIT 1),
         (SELECT i.id FROM interfaces i
           WHERE i.device_id = r.from_device_id
           ORDER BY i.id LIMIT 1)),
       COALESCE(
         (SELECT i.id FROM interfaces i
           WHERE i.device_id = r.to_device_id
             AND i.network_id IS NOT NULL
             AND i.network_id IN (
               SELECT network_id FROM interfaces
               WHERE device_id = r.from_device_id
                 AND network_id IS NOT NULL)
           ORDER BY i.id LIMIT 1),
         (SELECT i.id FROM interfaces i
           WHERE i.device_id = r.to_device_id
           ORDER BY i.id LIMIT 1)),
       r.from_label,
       r.to_label
FROM relations_old r;

DROP TABLE relations_old;

ALTER TABLE services RENAME TO services_old;

CREATE TABLE services (
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
  icon_key TEXT,
  favicon_url TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1
);

INSERT INTO services
  (id, interface_id, subdomain, petname, description, port, protocol,
   scheme, service_url, top_path, monitor_path, icon_key, favicon_url,
   properties, enabled)
SELECT id, device_network_id, subdomain, petname, description, port,
       protocol, scheme, service_url, top_path, monitor_path, icon_key,
       favicon_url, properties, enabled
FROM services_old;

DROP TABLE services_old;

DROP TABLE device_networks;
