-- Migration 016: networks gain an explicit display order, edited from
-- the management screen's up/down buttons. Existing networks keep
-- today's display order: creation order, with the internet network
-- last.
ALTER TABLE networks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE networks SET sort_order = id * 10;
UPDATE networks
SET sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM networks)
WHERE name = 'インターネット';
