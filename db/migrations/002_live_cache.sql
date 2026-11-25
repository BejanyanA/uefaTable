-- Stored copies of live football data (provider answers in our own shape),
-- shared by every visitor. One row per thing we fetch: a calendar date, the
-- live list, the day's request count. See routes_endpoints/live/cache.js.
--
-- Safe to run more than once. Applied to: dev (2026-11-25). Not yet: production.
--
--   dev:         npx wrangler@4.168.0 d1 execute core-db-dev --remote --config wrangler.dev.toml --file db/migrations/002_live_cache.sql
--   production:  npx wrangler@4.168.0 d1 execute core-db --remote --file db/migrations/002_live_cache.sql

CREATE TABLE IF NOT EXISTS live_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT '',
  fetched_at INTEGER NOT NULL DEFAULT 0,
  refreshing_until INTEGER NOT NULL DEFAULT 0
);
