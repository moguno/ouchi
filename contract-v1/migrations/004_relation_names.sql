-- ADDENDUM-24: separate relation definitions from relation edges.
--
-- Existing relations are one migration step behind. Group them by their old
-- tag, taking the colour and directional labels from the first relation in
-- each group. Relation IDs are preserved so unrelated device data remains
-- stable. The empty-tag fallback is only needed for malformed legacy rows;
-- the new model requires a non-empty natural key.
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS relation_names (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL,
  from_label TEXT,
  to_label TEXT
);

INSERT INTO relation_names (name, color, from_label, to_label)
SELECT groups.name, first_relation.color,
       first_relation.from_label, first_relation.to_label
FROM (
  SELECT
    COALESCE(NULLIF(trim(tag), ''), '未分類') AS name,
    MIN(id) AS first_id
  FROM relations
  GROUP BY COALESCE(NULLIF(trim(tag), ''), '未分類')
) AS groups
JOIN relations AS first_relation ON first_relation.id = groups.first_id
ORDER BY groups.first_id;

CREATE TABLE relations_v2 (
  id INTEGER PRIMARY KEY,
  relation_name_id INTEGER NOT NULL REFERENCES relation_names(id),
  from_device_id INTEGER NOT NULL REFERENCES devices(id),
  to_device_id INTEGER NOT NULL REFERENCES devices(id),
  CHECK (from_device_id <> to_device_id),
  UNIQUE (relation_name_id, from_device_id, to_device_id)
);

INSERT INTO relations_v2
  (id, relation_name_id, from_device_id, to_device_id)
SELECT
  legacy.id,
  definition.id,
  legacy.from_device_id,
  legacy.to_device_id
FROM relations AS legacy
JOIN relation_names AS definition
  ON definition.name =
     COALESCE(NULLIF(trim(legacy.tag), ''), '未分類');

DROP TABLE relations;
ALTER TABLE relations_v2 RENAME TO relations;

COMMIT;
