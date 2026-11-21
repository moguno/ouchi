-- Seed data v0.4 (draft, 2026-11-21) — the real home lab + external SaaS.
-- v0.4 adds category='service' pseudo-devices for external SaaS
-- (notion, pcloud) in the internet network: membership ip is NULL and
-- the service carries its full URL in service_url. Everything else is
-- carried over from v0.3 unchanged:
-- IPs live on device_networks (memberships); services hang off a
-- membership, so the same device can serve different IPs per network.
-- Relations use the generic model: target + tag + degree (colour).
-- The omv -> nanopi-r2s "バックアップ先" relation is a sample carried
-- over from the design discussion; the ホストOS ones are real.
INSERT INTO settings (id, domain, title) VALUES (1, 'ouchi.local', 'あなたのホームラボ');

INSERT INTO networks (id, name, cidr, accent) VALUES
  (1, 'インターネット', NULL, 'violet'),
  (2, 'おうちLAN', '192.168.0.0/24', 'blue'),
  (3, 'OCIネットワーク', '192.168.253.0/24', 'orange');

INSERT INTO devices (id, hostname, category, is_vm, meter_enabled, note) VALUES
  (1,  'nanopi-r2s', 'physical', 0, 1, 'NanoPi R2S'),
  (2,  'acemagic',   'physical', 0, 1, 'proxmox1'),
  (3,  'beelink',    'physical', 0, 1, 'proxmox2'),
  (4,  'omv',        'vm',       1, 1, 'OpenMediaVault'),
  (5,  'omv2',       'vm',       1, 1, NULL),
  (6,  'sandbox',    'vm',       1, 1, 'Codex host'),
  (7,  'ouchi-test', 'vm',       1, 1, 'ouchi.local test VM'),
  (8,  'oci-kuro',   'vm',       1, 1, 'OCI instance'),
  (9,  'oci-shiro',  'vm',       1, 1, 'OCI instance'),
  (10, 'fortigate',  'network',  0, 0, 'FortiGate 50E: no SSH meter'),
  (11, 'wac505',     'network',  0, 0, NULL),
  (12, 'wac540',     'network',  0, 0, NULL),
  (13, 'gs116ev2',   'network',  0, 0, NULL),
  (14, 'gs308ep',    'network',  0, 0, NULL),
  (15, 'notion',     'service',  0, 0, '外部SaaS: no IP, no SSH meter'),
  (16, 'pcloud',     'service',  0, 0, '外部SaaS: no IP, no SSH meter');

-- Memberships: (id, device, network, ip). FortiGate also sits in the
-- internet network with no IP registered yet. The SaaS pseudo-devices
-- sit in the internet network with ip NULL by design.
INSERT INTO device_networks (id, device_id, network_id, ip) VALUES
  (1,  1,  2, '192.168.0.19'),
  (2,  2,  2, '192.168.0.11'),
  (3,  3,  2, '192.168.0.12'),
  (4,  4,  2, '192.168.0.21'),
  (5,  5,  2, '192.168.0.222'),
  (6,  6,  2, '192.168.0.32'),
  (7,  7,  2, '192.168.0.30'),
  (8,  8,  3, '192.168.253.1'),
  (9,  9,  3, '192.168.253.3'),
  (10, 10, 2, '192.168.0.1'),
  (11, 10, 1, NULL),
  (12, 11, 2, '192.168.0.2'),
  (13, 12, 2, '192.168.0.6'),
  (14, 13, 2, '192.168.0.8'),
  (15, 14, 2, '192.168.0.9'),
  (16, 15, 1, NULL),
  (17, 16, 1, NULL);

INSERT INTO relations (from_device_id, to_device_id, tag, color) VALUES
  (4, 2, 'ホストOS', 'yellow'),
  (5, 2, 'ホストOS', 'yellow'),
  (6, 3, 'ホストOS', 'yellow'),
  (7, 3, 'ホストOS', 'yellow'),
  (4, 1, 'バックアップ先', 'blue');

-- Services hang off memberships. Proxmox VE's UI is https on 8006
-- (the v0.2 draft left this unseeded pending confirmation; seeded as
-- https here because that is Proxmox's actual scheme).
INSERT INTO services (device_network_id, subdomain, petname, description, port, protocol, scheme, top_path, monitor_path, icon_key, enabled) VALUES
  (1, 'gitea',     'おうちGit', 'Gitサーバ。人間とAIの共有リポジトリ置き場', 3000, 'tcp', 'http',  '', '/api/v1/version', 'gitea',    1),
  (1, 'gatus',     '見守り番',   '稼働監視',                                 8080, 'tcp', 'http',  '', '/',               'gatus',    1),
  (1, 'homepage',  'ホームページ', 'ダッシュボード',                          80,   'tcp', 'http',  '', '/',               'homepage', 1),
  (2, 'proxmox',   '土台',       'Proxmox VE（proxmox1）',                   8006, 'tcp', 'https', '', '/',               'proxmox',  1),
  (4, 'omv',       'データ倉庫', 'OpenMediaVault',                           80,   'tcp', 'http',  '', '/',               'omv',      1),
  (10, 'fortigate', '境界ルーター', 'FortiGate 50E 管理画面',                443,  'tcp', 'https', '', '/',               'fortigate', 1),
  (8, 'gatus-oci', 'OCI監視',    'Gatus（OCI）',                             8080, 'tcp', 'http',  '', '/',               'gatus',    1);

-- External SaaS: the full URL lives in service_url (port/scheme are
-- nominal https/443; the override wins in URL assembly).
INSERT INTO services (device_network_id, subdomain, petname, description, port, protocol, scheme, service_url, top_path, monitor_path, icon_key, enabled) VALUES
  (16, 'notion', 'Notion', '外部SaaS（メモ・ドキュメント）',   443, 'tcp', 'https', 'https://www.notion.so/', '', '/', 'notion', 1),
  (17, 'pcloud', 'pCloud', '外部SaaS（オンラインストレージ）', 443, 'tcp', 'https', 'https://my.pcloud.com/', '', '/', 'pcloud', 1);
