-- Migration 022 (2026-11-28): projects gain a color, shown as the
-- project's initial disc in the project side menu. The color is
-- decided once, when the project is created, from a hash of its
-- name, and stored here like any other value — renaming a project
-- never recolors it, and editing the color is an ordinary update.
-- Existing rows start empty; the server backfills them with the
-- same name-hash derivation the first time it opens the database
-- (see applySchemaAndMigrations), because SQL cannot run the hash.
-- The server checks PRAGMA table_info(projects) before applying this migration.
ALTER TABLE projects ADD COLUMN color TEXT NOT NULL DEFAULT '';
