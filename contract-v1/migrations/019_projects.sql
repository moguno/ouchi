-- Migration 019 (2026-11-27): projects are prepared ahead of the
-- project feature. A projects table appears, seeded with the single
-- default project (id 1, 「デフォルト」), and every ledger entity
-- table gains a project_id column defaulting to that project:
-- networks, devices, interfaces, services, relation_names and
-- relations.
--
-- This step is deliberately only the embedding: existing rows all
-- land in project 1, uniqueness stays global (hostname, subdomain,
-- names), no portal behaviour changes, and nothing filters by
-- project yet. The columns are independent — moving a device to
-- another project does not cascade to its interfaces or services;
-- project semantics (partitioning, switching UI, project-scoped
-- uniqueness) belong to the future project feature. Interfaces
-- created through the API default to their device's project.
--
-- project_id carries no FOREIGN KEY clause: SQLite forbids adding a
-- column with REFERENCES and a non-NULL default via ALTER TABLE, and
-- referential integrity for projects is kept at the application
-- layer like the rest of the ledger.

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO projects (id, name) VALUES (1, 'デフォルト');

ALTER TABLE networks ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE devices ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE interfaces ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE relation_names ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE relations ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
