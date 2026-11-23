#!/usr/bin/env python3
"""Build the v0.6 ledger in memory and verify the design end to end.

Checks:
  1. schema + seed load with foreign keys on; foreign_key_check is clean
  2. row counts match the seed's intent
  3. category / is_vm consistency holds
  4. relation traversal for omv works both directions, with relation-name
     templates resolving placeholders back to display labels
  5. redirect and monitor URLs assemble from scheme + membership IP +
     port + paths for every enabled service
  6. category='service' pseudo-devices (external SaaS): is_vm=0,
     meter_enabled=0, membership ip is NULL, and their services
     resolve to the service_url override
"""
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).parent

con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys = ON")
con.executescript((HERE / "schema.sql").read_text())
con.executescript((HERE / "seed.sql").read_text())
cur = con.cursor()

failures = []

def check(name, ok, detail=""):
    print(f"{'OK ' if ok else 'NG '}{name} {detail}")
    if not ok:
        failures.append(name)

fk = cur.execute("PRAGMA foreign_key_check").fetchall()
check("foreign_key_check", fk == [], f"violations={fk}")

counts = {t: cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
          for t in ("networks", "devices", "device_networks", "relation_names",
                    "relations", "services")}
check("row counts", counts == {"networks": 3, "devices": 16,
                               "device_networks": 17, "relation_names": 2,
                               "relations": 5,
                               "services": 9}, str(counts))

bad = cur.execute(
    "SELECT COUNT(*) FROM devices WHERE is_vm <> (category = 'vm')").fetchone()[0]
check("category/is_vm consistency", bad == 0, f"mismatch={bad}")

relation_columns = [row[1] for row in cur.execute(
    "PRAGMA table_info(relations)").fetchall()]
check("relation placeholder columns",
      "from_placeholder" in relation_columns
      and "to_placeholder" in relation_columns,
      str(relation_columns))

# --- relation traversal for omv (both directions, labels resolved) ---
def relation_label(template, placeholder, name):
    if not template or not template.strip():
        return name
    return template.replace("{}", placeholder if placeholder else "-")

def traverse(hostname):
    did = cur.execute("SELECT id FROM devices WHERE hostname = ?",
                      (hostname,)).fetchone()[0]
    out = cur.execute(
        """SELECT d.hostname, n.from_label, r.from_placeholder, n.name, n.color
           FROM relations r
           JOIN relation_names n ON n.id = r.relation_name_id
           JOIN devices d ON d.id = r.to_device_id
           WHERE r.from_device_id = ?""", (did,)).fetchall()
    inc = cur.execute(
        """SELECT d.hostname, n.to_label, r.to_placeholder, n.name, n.color
           FROM relations r
           JOIN relation_names n ON n.id = r.relation_name_id
           JOIN devices d ON d.id = r.from_device_id
           WHERE r.to_device_id = ?""", (did,)).fetchall()
    return (
        [(hostname, relation_label(template, placeholder, name), color)
         for hostname, template, placeholder, name, color in out],
        [(hostname, relation_label(template, placeholder, name), color)
         for hostname, template, placeholder, name, color in inc],
    )

out, inc = traverse("omv")
print("omv ->", out)
print("omv <-", inc)
check("omv traversal",
      ("acemagic", "ホストOS", "#d5a22b") in out
      and ("nanopi-r2s", "バックアップ先", "#3b82f6") in out)

out_ace, inc_ace = traverse("acemagic")
check("acemagic reverse traversal",
      ("omv", "ホストOS", "#d5a22b") in inc_ace
      and ("omv2", "ホストOS", "#d5a22b") in inc_ace)

# --- URL assembly (redirect + monitor) ---
rows = cur.execute(
    """SELECT s.subdomain, s.scheme, dn.ip, s.port, s.top_path,
              s.monitor_path, s.service_url
       FROM services s JOIN device_networks dn ON dn.id = s.device_network_id
       WHERE s.enabled = 1 ORDER BY s.id""").fetchall()

def build(scheme, ip, port, path, override):
    if override:
        return override
    base = f"{scheme}://{ip}:{port}"
    return base + (path if path else "/")

print("\nservice URLs (redirect / monitor):")
for sub, scheme, ip, port, top, mon, override in rows:
    redir = build(scheme, ip, port, top, override)
    monitor = build(scheme, ip, port, mon if mon else top, override)
    print(f"  {sub:10s} {redir}  |  {monitor}")
    if not override and ip is None:
        failures.append(f"url:{sub}")
check("all service URLs assembled", all(
    build(s, ip, p, t, o).startswith(("http://", "https://"))
    for _, s, ip, p, t, _, o in rows))

# --- category='service' pseudo-devices (external SaaS) ---
bad_svc = cur.execute(
    """SELECT COUNT(*) FROM devices
       WHERE category = 'service' AND (is_vm <> 0 OR meter_enabled <> 0)"""
).fetchone()[0]
check("service-category invariants (is_vm=0, meter off)", bad_svc == 0,
      f"violations={bad_svc}")

bad_ip = cur.execute(
    """SELECT COUNT(*) FROM device_networks dn
       JOIN devices d ON d.id = dn.device_id
       WHERE d.category = 'service' AND dn.ip IS NOT NULL""").fetchone()[0]
check("service-category memberships have NULL ip", bad_ip == 0,
      f"violations={bad_ip}")

saas = {sub: build(s, ip, p, t, o)
        for sub, s, ip, p, t, _, o in rows if sub in ("notion", "pcloud")}
print("saas URLs:", saas)
check("saas URLs resolve via service_url",
      saas == {"notion": "https://www.notion.so/",
               "pcloud": "https://my.pcloud.com/"}, str(saas))

print("\nRESULT:", "ALL OK" if not failures else f"FAILURES: {failures}")
sys.exit(1 if failures else 0)
