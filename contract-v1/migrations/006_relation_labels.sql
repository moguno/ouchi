-- Relation endpoint labels move from relation names to relations.
--
-- Until now relation_names owned from_label/to_label as templates with {}
-- placeholders, and each relation carried the placeholder values. The user
-- decided (2026-11-23) that relation names are pure categories (name +
-- colour) and each relation owns its two endpoint labels as free text.
--
-- Existing labels are expanded exactly the way the API resolved them:
-- a non-empty template has every {} replaced by the trimmed placeholder
-- value (an empty value becomes "-"); an empty template stores an empty
-- label and the display falls back to the relation name. Uniqueness moves
-- from the placeholder pair to the label pair, so links that differ only
-- in their labels (e.g. different ports) still coexist.
--
-- The old definition table is renamed out of the way first so the foreign
-- keys of the rebuilt relations table resolve to the new table.
BEGIN IMMEDIATE;

ALTER TABLE relation_names RENAME TO relation_names_old;

CREATE TABLE relation_names (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL
);

INSERT INTO relation_names (id, name, color)
SELECT id, name, color FROM relation_names_old;

CREATE TABLE relations_v4 (
  id INTEGER PRIMARY KEY,
  relation_name_id INTEGER NOT NULL REFERENCES relation_names(id),
  from_device_id INTEGER NOT NULL REFERENCES devices(id),
  to_device_id INTEGER NOT NULL REFERENCES devices(id),
  from_label TEXT NOT NULL DEFAULT '',
  to_label TEXT NOT NULL DEFAULT '',
  CHECK (from_device_id <> to_device_id),
  UNIQUE (
    relation_name_id,
    from_device_id,
    to_device_id,
    from_label,
    to_label
  )
);

INSERT INTO relations_v4
  (id, relation_name_id, from_device_id, to_device_id, from_label, to_label)
SELECT
  r.id,
  r.relation_name_id,
  r.from_device_id,
  r.to_device_id,
  CASE
    WHEN trim(coalesce(n.from_label, '')) = '' THEN ''
    ELSE replace(
      trim(n.from_label),
      '{}',
      CASE WHEN trim(r.from_placeholder) = '' THEN '-'
           ELSE trim(r.from_placeholder) END
    )
  END,
  CASE
    WHEN trim(coalesce(n.to_label, '')) = '' THEN ''
    ELSE replace(
      trim(n.to_label),
      '{}',
      CASE WHEN trim(r.to_placeholder) = '' THEN '-'
           ELSE trim(r.to_placeholder) END
    )
  END
FROM relations r
JOIN relation_names_old n ON n.id = r.relation_name_id;

DROP TABLE relations;
ALTER TABLE relations_v4 RENAME TO relations;

DROP TABLE relation_names_old;

COMMIT;
