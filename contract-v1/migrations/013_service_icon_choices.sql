-- Migration 013 (2026-11-25): service icons shrink to three choices.
--
-- A service icon is now the service's favicon, an explicit image URL,
-- or unset (NULL, rendered as one bundled placeholder icon). Stored
-- references to the retired bundled generic / preset icons become
-- unset; legacy dashboard references become the CDN image URL they
-- always resolved to. The server checks for any legacy value before
-- applying this migration, so it is safe to run repeatedly.

UPDATE services
SET icon_key = 'url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/'
  || lower(substr(icon_key, 11)) || '.svg'
WHERE icon_key LIKE 'dashboard:%';

UPDATE services
SET icon_key = NULL
WHERE icon_key LIKE 'generic:%'
  OR icon_key LIKE 'preset:%'
  OR icon_key = ''
  OR (icon_key NOT LIKE '%:%' AND icon_key <> 'favicon');
