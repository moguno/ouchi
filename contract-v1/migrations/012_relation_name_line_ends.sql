-- Migration 012 (2026-11-25): relation names gain endpoint shapes.
--
-- Each end of a relation line can be drawn as none / arrow / circle /
-- square / diamond, set per relation name (line_start for the from
-- side, line_end for the to side). Existing relation names keep the
-- established look: both ends default to 'circle', the dots the portal
-- has always drawn. The server checks PRAGMA table_info(relation_
-- names) before applying this migration.

ALTER TABLE relation_names ADD COLUMN line_start TEXT NOT NULL DEFAULT 'circle'
  CHECK (line_start IN ('none', 'arrow', 'circle', 'square', 'diamond'));
ALTER TABLE relation_names ADD COLUMN line_end TEXT NOT NULL DEFAULT 'circle'
  CHECK (line_end IN ('none', 'arrow', 'circle', 'square', 'diamond'));
