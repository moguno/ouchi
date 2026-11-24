-- Migration 010: network accent becomes a free CSS color.
-- Until v0.10 the accent was one of five tone names (blue/green/orange/
-- violet/slate) mapped to a fixed palette. Convert stored tone names to
-- the palette hex values so existing ledgers keep the same hues; new
-- values are picked with the color picker and stored as-is.
UPDATE networks
SET accent = CASE accent
  WHEN 'blue' THEN '#5b9bd6'
  WHEN 'green' THEN '#4ba755'
  WHEN 'orange' THEN '#d69132'
  WHEN 'violet' THEN '#7467a8'
  WHEN 'slate' THEN '#667483'
  ELSE accent
END
WHERE accent IN ('blue', 'green', 'orange', 'violet', 'slate');
