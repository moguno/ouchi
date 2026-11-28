-- Seed data v0.4 (draft, 2026-11-21) — the real home lab + external SaaS.
-- v0.4 adds category='service' pseudo-devices for external SaaS
-- (notion, pcloud) in the internet network: membership ip is NULL and
-- the service carries its full URL in service_url. Everything else is
-- carried over from v0.3 unchanged:
-- IPs live on interfaces (one IP per interface); services hang off an
-- interface, so the same device can serve different IPs per network.
-- Relations reference relation-name categories (name + colour). The two
-- endpoint labels live on each relation row as free text.
-- The omv -> nanopi-r2s "バックアップ先" relation is a sample carried
-- over from the design discussion; the ホストOS ones are real.
INSERT INTO settings (id, domain) VALUES (1, 'ouchi.local');

INSERT INTO networks (id, name, cidr, accent) VALUES
  (1, 'インターネット', NULL, '#7467a8'),
  (2, 'おうちLAN', '192.168.0.0/24', '#5b9bd6'),
  (3, 'OCIネットワーク', '192.168.253.0/24', '#d69132');

INSERT INTO devices
  (id, hostname, petname, category, meter_enabled, note)
VALUES
  (1,  'nanopi-r2s', '門番',       'physical', 1, 'NanoPi R2S'),
  (2,  'acemagic',   '親機壱',     'physical', 1, 'proxmox1'),
  (3,  'beelink',    '親機弐',     'physical', 1, 'proxmox2'),
  (4,  'omv',        '蔵',         'vm', 1, 'OpenMediaVault'),
  (5,  'omv2',       '蔵弐',       'vm', 1, NULL),
  (6,  'sandbox',    '砂箱',       'vm', 1, 'Codex host'),
  (7,  'ouchi-test', '試し部屋',   'vm', 1, 'ouchi.local test VM'),
  (8,  'oci-kuro',   '黒雲',       'vm', 1, 'OCI instance'),
  (9,  'oci-shiro',  '白雲',       'vm', 1, 'OCI instance'),
  (10, 'fortigate',  '関所',       'network', 0, 'FortiGate 50E: no SSH meter'),
  (11, 'wac505',     '無線番',     'network', 0, NULL),
  (12, 'wac540',     '無線番弐',   'network', 0, NULL),
  (13, 'gs116ev2',   '線路盤',     'network', 0, NULL),
  (14, 'gs308ep',    '線路端',     'network', 0, NULL),
  (15, 'notion',     '思索帖',     'service', 0, '外部SaaS: no IP, no SSH meter'),
  (16, 'pcloud',     '雲庫',       'service', 0, '外部SaaS: no IP, no SSH meter');

-- Interfaces: (id, device, name, network, ip). One interface carries at
-- most one IP; switch-style ports would be interfaces with ip NULL.
-- FortiGate has two: lan (with the LAN IP) and wan1 (internet network,
-- no IP registered yet). The SaaS pseudo-devices sit in the internet
-- network with ip NULL by design.
INSERT INTO interfaces (id, device_id, name, network_id, ip) VALUES
  (1,  1,  'eth0', 2, '192.168.0.19'),
  (2,  2,  'eth0', 2, '192.168.0.11'),
  (3,  3,  'eth0', 2, '192.168.0.12'),
  (4,  4,  'eth0', 2, '192.168.0.21'),
  (5,  5,  'eth0', 2, '192.168.0.222'),
  (6,  6,  'eth0', 2, '192.168.0.32'),
  (7,  7,  'eth0', 2, '192.168.0.30'),
  (8,  8,  'eth0', 3, '192.168.253.1'),
  (9,  9,  'eth0', 3, '192.168.253.3'),
  (10, 10, 'lan',  2, '192.168.0.1'),
  (11, 10, 'wan1', 1, NULL),
  (12, 11, 'eth0', 2, '192.168.0.2'),
  (13, 12, 'eth0', 2, '192.168.0.6'),
  (14, 13, 'eth0', 2, '192.168.0.8'),
  (15, 14, 'eth0', 2, '192.168.0.9'),
  (16, 15, 'eth0', 1, NULL),
  (17, 16, 'eth0', 1, NULL);

INSERT INTO relation_names (id, name, color) VALUES
  (1, 'ホストOS', '#d5a22b'),
  (2, 'バックアップ先', '#3b82f6');

INSERT INTO relations
  (from_interface_id, to_interface_id, relation_name_id,
   from_label, to_label)
VALUES
  (4, 2, 1, '', ''),
  (5, 2, 1, '', ''),
  (6, 3, 1, '', ''),
  (7, 3, 1, '', ''),
  (4, 1, 2, '', '');

-- Services hang off interfaces. Proxmox VE's UI is https on 8006
-- (the v0.2 draft left this unseeded pending confirmation; seeded as
-- https here because that is Proxmox's actual scheme).
INSERT INTO services (interface_id, subdomain, petname, description, port, protocol, scheme, top_path, monitor_path, icon_key, enabled) VALUES
  (1, 'gitea',     'おうちGit', 'Gitサーバ。人間とAIの共有リポジトリ置き場', 3000, 'tcp', 'http',  '', '/api/v1/version', 'generic:gitea',    1),
  (1, 'gatus',     '見守り番',   '稼働監視',                                 8080, 'tcp', 'http',  '', '/',               'generic:gatus',    1),
  (1, 'homepage',  'ホームページ', 'ダッシュボード',                          80,   'tcp', 'http',  '', '/',               'generic:server',   1),
  (2, 'proxmox',   '土台',       'Proxmox VE（proxmox1）',                   8006, 'tcp', 'https', '', '/',               'generic:proxmox',  1),
  (4, 'omv',       'データ倉庫', 'OpenMediaVault',                           80,   'tcp', 'http',  '', '/',               'generic:omv',      1),
  (10, 'fortigate', '境界ルーター', 'FortiGate 50E 管理画面',                443,  'tcp', 'https', '', '/',               'generic:shield',   1),
  (8, 'gatus-oci', 'OCI監視',    'Gatus（OCI）',                             8080, 'tcp', 'http',  '', '/',               'generic:gatus',    1);

-- External SaaS: the full URL lives in service_url (port/scheme are
-- nominal https/443; the override wins in URL assembly).
INSERT INTO services (interface_id, subdomain, petname, description, port, protocol, scheme, service_url, top_path, monitor_path, icon_key, enabled) VALUES
  (16, 'notion', 'Notion', '外部SaaS（メモ・ドキュメント）',   443, 'tcp', 'https', 'https://www.notion.so/', '', '/', 'generic:cloud', 1),
  (17, 'pcloud', 'pCloud', '外部SaaS（オンラインストレージ）', 443, 'tcp', 'https', 'https://my.pcloud.com/', '', '/', 'generic:cloud', 1);
