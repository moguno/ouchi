-- Ledger-level bookkeeping (key/value).
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Installs that already hold a ledger were seeded (or populated by
-- hand) long ago. Mark them now so the startup seed never runs for
-- them again — not even if the user later deletes every project and
-- network. Fresh installs have no networks yet at this point, so no
-- marker is written and the seed still runs exactly once for them.
INSERT INTO meta (key, value)
SELECT 'seeded', '1'
WHERE EXISTS (SELECT 1 FROM networks);
