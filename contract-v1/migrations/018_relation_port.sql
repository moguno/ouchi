-- Migration 018 (2026-11-26): relations gain a structured destination
-- port and protocol.
--
-- ouchi relations are L3-only (they name IP-level communication), so
-- the destination port is a constrained field rather than free text
-- in an endpoint label: port is 1-65535, protocol is tcp or udp, and
-- the two are always set as a pair (both NULL = unspecified). ICMP
-- has no ports and stays out of the model. The relations table is
-- rebuilt so the UNIQUE spans the new columns too: two relations
-- between the same endpoints under the same name and labels may
-- differ by port (e.g. PostgreSQL and Redis on one host). Existing
-- rows copy across with NULL port/protocol; a label such as
-- "5432/tcp" can be moved into the fields by hand.

CREATE TABLE relations_new (
  id INTEGER PRIMARY KEY,
  relation_name_id INTEGER NOT NULL REFERENCES relation_names(id),
  from_interface_id INTEGER REFERENCES interfaces(id),
  from_service_id INTEGER REFERENCES services(id),
  to_interface_id INTEGER REFERENCES interfaces(id),
  to_service_id INTEGER REFERENCES services(id),
  from_label TEXT NOT NULL DEFAULT '',
  to_label TEXT NOT NULL DEFAULT '',
  properties TEXT NOT NULL DEFAULT '{}',
  port INTEGER,
  protocol TEXT,
  CHECK ((from_interface_id IS NULL) <> (from_service_id IS NULL)),
  CHECK ((to_interface_id IS NULL) <> (to_service_id IS NULL)),
  CHECK (
    from_interface_id IS NULL
    OR to_interface_id IS NULL
    OR from_interface_id <> to_interface_id
  ),
  CHECK (
    from_service_id IS NULL
    OR to_service_id IS NULL
    OR from_service_id <> to_service_id
  ),
  CHECK (port IS NULL OR (port >= 1 AND port <= 65535)),
  CHECK (protocol IS NULL OR protocol IN ('tcp', 'udp')),
  CHECK ((port IS NULL) = (protocol IS NULL)),
  UNIQUE (
    relation_name_id,
    from_interface_id,
    from_service_id,
    to_interface_id,
    to_service_id,
    from_label,
    to_label,
    port,
    protocol
  )
);

INSERT INTO relations_new (
  id, relation_name_id, from_interface_id, from_service_id,
  to_interface_id, to_service_id, from_label, to_label, properties
)
SELECT
  id, relation_name_id, from_interface_id, from_service_id,
  to_interface_id, to_service_id, from_label, to_label, properties
FROM relations;

DROP TABLE relations;
ALTER TABLE relations_new RENAME TO relations;
