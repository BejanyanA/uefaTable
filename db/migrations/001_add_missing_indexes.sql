-- Indexes that were missing for queries the API runs (found 2026-11-25 by
-- checking every statement's query plan).
--
--   league_instances(league_id)   fixtures, standings, bracket, instance list
--   round_knockouts(*_user_id)    achievements
--   users(LOWER(...))             friend search, sign-up checks
--   messages(...)                 chat list: last message and unread counts
--
-- Safe to run more than once. Applied to: dev (2026-11-25). Not yet: production.
--
--   dev:  npx wrangler@4.168.0 d1 execute core-db-dev --remote --config wrangler.dev.toml --file db/migrations/001_add_missing_indexes.sql

CREATE INDEX IF NOT EXISTS idx_league_instances_league_id ON league_instances(league_id);
CREATE INDEX IF NOT EXISTS idx_rk_team1_user ON round_knockouts(team1_user_id);
CREATE INDEX IF NOT EXISTS idx_rk_team2_user ON round_knockouts(team2_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_unread ON messages(conversation_id, is_read, sender_id);
