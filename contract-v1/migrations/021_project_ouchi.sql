-- Migration 021 (2026-11-27): the "ouchi" — portal title plus the
-- global memo — moves from the single settings row onto projects.
-- A project is a completely separate partition and holds exactly one
-- ouchi, so title and properties become project columns and the
-- current values move to the first project. settings keeps only the
-- domain, which stays a deployment-wide value.
-- The server checks PRAGMA table_info(projects) before applying this migration.
ALTER TABLE projects ADD COLUMN title TEXT NOT NULL DEFAULT 'あなたのホームラボ';
ALTER TABLE projects ADD COLUMN properties TEXT NOT NULL DEFAULT '{}';
-- On a fresh install the settings row does not exist yet when the
-- migrations run (the seed comes later), so fall back to the column
-- defaults instead of writing NULL into the NOT NULL columns.
UPDATE projects
SET title = COALESCE(
      (SELECT title FROM settings WHERE id = 1),
      'あなたのホームラボ'
    ),
    properties = COALESCE(
      (SELECT properties FROM settings WHERE id = 1),
      '{}'
    )
WHERE id = (SELECT MIN(id) FROM projects);
ALTER TABLE settings DROP COLUMN title;
ALTER TABLE settings DROP COLUMN properties;
