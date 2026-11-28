-- Seed data (2026-11-28): inserted only when the ledger is empty
-- (fresh install). The default project starts EMPTY so a new user
-- meets the getting-started tutorial first; the minimal fictional
-- sample ledger lives in its own project (id 2, サンプル) where it
-- can be explored — and deleted — without touching the user's own
-- project. One network, two devices with one interface each, one
-- service per device, and one relation between the two interfaces.
INSERT INTO settings (id, domain) VALUES (1, 'ouchi.local');

INSERT INTO projects (id, name, title) VALUES (2, 'サンプル', 'サンプル');

INSERT INTO networks (id, project_id, name, cidr, accent) VALUES
  (1, 2, 'サンプルネットワーク', '192.168.0.0/24', '#5b9bd6');

INSERT INTO devices
  (id, project_id, hostname, petname, category, meter_enabled, note)
VALUES
  (1, 2, 'sample-device-1', 'サンプルデバイス1', 'physical', 0, NULL),
  (2, 2, 'sample-device-2', 'サンプルデバイス2', 'physical', 0, NULL);

INSERT INTO interfaces (id, project_id, device_id, name, network_id, ip) VALUES
  (1, 2, 1, 'eth0', 1, '192.168.0.1'),
  (2, 2, 2, 'eth0', 1, '192.168.0.2');

INSERT INTO relation_names (id, project_id, name, color) VALUES
  (1, 2, 'サンプル', '#3b82f6');

INSERT INTO relations
  (project_id, from_interface_id, to_interface_id, relation_name_id,
   from_label, to_label)
VALUES
  (2, 1, 2, 1, '始点', '終点');

INSERT INTO services (project_id, interface_id, subdomain, petname, description, port, protocol, scheme, top_path, monitor_path, icon_key, enabled) VALUES
  (2, 1, 'sample-service-1', 'サンプルサービス1', NULL, 80, 'tcp', 'http', '', '/', NULL, 1),
  (2, 2, 'sample-service-2', 'サンプルサービス2', NULL, 80, 'tcp', 'http', '', '/', NULL, 1);
