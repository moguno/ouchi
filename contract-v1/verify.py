#!/usr/bin/env python3
"""Build the v0.14 ledger in memory and verify the design end to end.

Checks:
  1. schema + seed load with foreign keys on; foreign_key_check is clean
  2. row counts match the seed's intent
  4. relation traversal for omv works both directions across interfaces,
     with each relation's own endpoint labels
  5. redirect and monitor URLs assemble from scheme + interface IP +
     port + paths for every enabled service
  6. category='service' pseudo-devices (external SaaS):
     meter_enabled=0, interface ip is NULL, and their services
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
          for t in ("networks", "devices", "interfaces", "relation_names",
                    "relations", "services")}
check("row counts", counts == {"networks": 3, "devices": 16,
                               "interfaces": 17, "relation_names": 2,
                               "relations": 5,
                               "services": 9}, str(counts))

relation_columns = [row[1] for row in cur.execute(
    "PRAGMA table_info(relations)").fetchall()]
check("relation label columns",
      "from_label" in relation_columns
      and "to_label" in relation_columns,
      str(relation_columns))
relation_name_columns = [row[1] for row in cur.execute(
    "PRAGMA table_info(relation_names)").fetchall()]
check("relation names are pure categories",
      relation_name_columns == ["id", "name", "color",
                                "line_start", "line_end"],
      str(relation_name_columns))

# --- relation traversal for omv (both directions, labels resolved) ---
def relation_label(label, name):
    if not label or not label.strip():
        return name
    return label

def traverse(hostname):
    did = cur.execute("SELECT id FROM devices WHERE hostname = ?",
                      (hostname,)).fetchone()[0]
    out = cur.execute(
        """SELECT d.hostname, r.from_label, n.name, n.color
           FROM relations r
           JOIN relation_names n ON n.id = r.relation_name_id
           JOIN interfaces ti ON ti.id = r.to_interface_id
           JOIN devices d ON d.id = ti.device_id
           JOIN interfaces fi ON fi.id = r.from_interface_id
           WHERE fi.device_id = ?""", (did,)).fetchall()
    inc = cur.execute(
        """SELECT d.hostname, r.to_label, n.name, n.color
           FROM relations r
           JOIN relation_names n ON n.id = r.relation_name_id
           JOIN interfaces fi ON fi.id = r.from_interface_id
           JOIN devices d ON d.id = fi.device_id
           JOIN interfaces ti ON ti.id = r.to_interface_id
           WHERE ti.device_id = ?""", (did,)).fetchall()
    return (
        [(hostname, relation_label(label, name), color)
         for hostname, label, name, color in out],
        [(hostname, relation_label(label, name), color)
         for hostname, label, name, color in inc],
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
       FROM services s JOIN interfaces dn ON dn.id = s.interface_id
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
       WHERE category = 'service' AND meter_enabled <> 0"""
).fetchone()[0]
check("service-category invariants (meter off)", bad_svc == 0,
      f"violations={bad_svc}")

bad_ip = cur.execute(
    """SELECT COUNT(*) FROM interfaces dn
       JOIN devices d ON d.id = dn.device_id
       WHERE d.category = 'service' AND dn.ip IS NOT NULL""").fetchone()[0]
check("service-category interfaces have NULL ip", bad_ip == 0,
      f"violations={bad_ip}")

saas = {sub: build(s, ip, p, t, o)
        for sub, s, ip, p, t, _, o in rows if sub in ("notion", "pcloud")}
print("saas URLs:", saas)
check("saas URLs resolve via service_url",
      saas == {"notion": "https://www.notion.so/",
               "pcloud": "https://my.pcloud.com/"}, str(saas))

print("\nRESULT:", "ALL OK" if not failures else f"FAILURES: {failures}")
sys.exit(1 if failures else 0)
