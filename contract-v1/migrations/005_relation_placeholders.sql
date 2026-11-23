-- ADDENDUM-24-SUPPLEMENT-1: relation-edge placeholder values.
--
-- SQLite cannot widen an existing inline UNIQUE constraint with ALTER TABLE.
-- Rebuild the relation table, preserve every existing ID and relation edge,
-- and fill the two new values with the empty string.
BEGIN IMMEDIATE;

CREATE TABLE relations_v3 (
  id INTEGER PRIMARY KEY,
  relation_name_id INTEGER NOT NULL REFERENCES relation_names(id),
  from_device_id INTEGER NOT NULL REFERENCES devices(id),
  to_device_id INTEGER NOT NULL REFERENCES devices(id),
  from_placeholder TEXT NOT NULL DEFAULT '',
  to_placeholder TEXT NOT NULL DEFAULT '',
  CHECK (from_device_id <> to_device_id),
  UNIQUE (
    relation_name_id,
    from_device_id,
    to_device_id,
    from_placeholder,
    to_placeholder
  )
);

INSERT INTO relations_v3
  (id, relation_name_id, from_device_id, to_device_id,
   from_placeholder, to_placeholder)
SELECT
  id, relation_name_id, from_device_id, to_device_id, '', ''
FROM relations;

DROP TABLE relations;
ALTER TABLE relations_v3 RENAME TO relations;

COMMIT;
