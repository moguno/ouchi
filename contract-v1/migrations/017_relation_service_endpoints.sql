-- Migration 017 (2026-11-26): relation endpoints may be services.
--
-- A relation endpoint is now either an interface or a service, mixed
-- freely. The relations table is rebuilt: from/to_interface_id become
-- nullable and from/to_service_id are added, with CHECKs that each side
-- names exactly one endpoint and never the same endpoint twice.
-- Existing rows are all interface endpoints and copy across unchanged.
-- The UNIQUE spans every endpoint column; SQLite treats NULLs as
-- distinct there, so duplicate detection for service endpoints is
-- enforced by the application validation, as before for labels.

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
  UNIQUE (
    relation_name_id,
    from_interface_id,
    from_service_id,
    to_interface_id,
    to_service_id,
    from_label,
    to_label
  )
);

INSERT INTO relations_new (
  id, relation_name_id, from_interface_id, to_interface_id,
  from_label, to_label, properties
)
SELECT
  id, relation_name_id, from_interface_id, to_interface_id,
  from_label, to_label, properties
FROM relations;

DROP TABLE relations;
ALTER TABLE relations_new RENAME TO relations;
