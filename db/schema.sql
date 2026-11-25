-- Table structure of the core database (no data).
-- Read from production (core-db) on 2026-11-25; used to build core-db-dev.
-- Keep this file up to date when you change tables, so dev can be rebuilt.

-- Tables (22)

CREATE TABLE all_clubs (     id INTEGER PRIMARY KEY,     club_name TEXT UNIQUE NOT NULL,     country TEXT,     logo_url TEXT,  created_by_user_id INTEGER,   created_at DATETIME DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE all_countries (     id INTEGER PRIMARY KEY,     country_name VARCHAR(100) NOT NULL,     logo_url TEXT,     is_europe BOOLEAN NOT NULL DEFAULT FALSE,     created_by_user_id INT NOT NULL,     created_at DATETIME DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE all_leagues (     id INTEGER PRIMARY KEY,     league_name TEXT UNIQUE NOT NULL,     logo_url TEXT,  created_by_user_id INTEGER,   created_at DATETIME DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user1_id, user2_id)
);

CREATE TABLE country_group_standings (     id INTEGER PRIMARY KEY,     group_id INTEGER NOT NULL,     team_id INTEGER NOT NULL,      user_id INTEGER DEFAULT NULL,      played INTEGER DEFAULT 0,     wins INTEGER DEFAULT 0,     wins_vs_computer INTEGER DEFAULT 0,     wins_vs_player INTEGER DEFAULT 0,     draws INTEGER DEFAULT 0,     losses INTEGER DEFAULT 0,     goals_for INTEGER DEFAULT 0,     goals_against INTEGER DEFAULT 0,     goal_difference INTEGER DEFAULT 0,     points INTEGER DEFAULT 0,     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (group_id) REFERENCES league_groups(id) ON DELETE CASCADE,     FOREIGN KEY (team_id) REFERENCES all_countries(id),      FOREIGN KEY (user_id) REFERENCES users(id) );

CREATE TABLE country_matches (     id INTEGER PRIMARY KEY,     group_id INTEGER NOT NULL,     team1_id INTEGER NOT NULL,     team2_id INTEGER NOT NULL,     team1_user_id INTEGER DEFAULT NULL,      team2_user_id INTEGER DEFAULT NULL,      is_vs_computer BOOLEAN DEFAULT FALSE,     computer_team TEXT,     team1_score INTEGER DEFAULT NULL,      team2_score INTEGER DEFAULT NULL,      winner_team_id INTEGER DEFAULT NULL,      updated_user_id INTEGER DEFAULT NULL,      match_type TEXT CHECK(match_type = 'neutral'),     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, score_processed INTEGER DEFAULT 0,     FOREIGN KEY (group_id) REFERENCES league_groups(id) ON DELETE CASCADE,     FOREIGN KEY (team1_id) REFERENCES all_countries(id),     FOREIGN KEY (team2_id) REFERENCES all_countries(id),     FOREIGN KEY (winner_team_id) REFERENCES all_countries(id),     FOREIGN KEY (team1_user_id) REFERENCES users(id),     FOREIGN KEY (team2_user_id) REFERENCES users(id),     FOREIGN KEY (updated_user_id) REFERENCES users(id) );

CREATE TABLE friends (     id INTEGER PRIMARY KEY,     user_id INTEGER NOT NULL,            friend_id INTEGER NOT NULL,       status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),     created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at TEXT, rejected_by_user_id INTEGER,     FOREIGN KEY (user_id) REFERENCES users(id),     FOREIGN KEY (friend_id) REFERENCES users(id),     UNIQUE(user_id, friend_id) );

CREATE TABLE group_standings (     id INTEGER PRIMARY KEY,     group_id INTEGER NOT NULL,     team_id INTEGER NOT NULL,     user_id INTEGER,     played INTEGER DEFAULT 0,     wins INTEGER DEFAULT 0,     wins_vs_computer INTEGER DEFAULT 0,     wins_vs_player INTEGER DEFAULT 0,     draws INTEGER DEFAULT 0,     losses INTEGER DEFAULT 0,     goals_for INTEGER DEFAULT 0,     goals_against INTEGER DEFAULT 0,     goal_difference INTEGER DEFAULT 0,     points INTEGER DEFAULT 0,     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (group_id) REFERENCES league_groups(id) ON DELETE CASCADE,     FOREIGN KEY (team_id) REFERENCES all_clubs(id),     FOREIGN KEY (user_id) REFERENCES users(id) );

CREATE TABLE league_access (     id INTEGER PRIMARY KEY,     league_id INTEGER NOT NULL,     user_id INTEGER NOT NULL,      granted_by_user_id INTEGER NOT NULL,      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,     FOREIGN KEY (user_id) REFERENCES users(id),     FOREIGN KEY (granted_by_user_id) REFERENCES users(id) );

CREATE TABLE league_groups (     id INTEGER PRIMARY KEY,     league_instance_id INTEGER NOT NULL,     group_name TEXT NOT NULL,     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (league_instance_id) REFERENCES league_instances(id) ON DELETE CASCADE );

CREATE TABLE league_instances (     id INTEGER PRIMARY KEY,     league_id INTEGER NOT NULL,     name TEXT NOT NULL,     created_by_user_id INTEGER,     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,     FOREIGN KEY (created_by_user_id) REFERENCES users(id) );

CREATE TABLE league_knockouts (     id INTEGER PRIMARY KEY,     league_id INTEGER NOT NULL,     round TEXT NOT NULL,     match_order INTEGER,     team1_id INTEGER DEFAULT NULL,     team2_id INTEGER DEFAULT NULL,     team1_user_id INTEGER DEFAULT NULL,     team2_user_id INTEGER DEFAULT NULL,     is_vs_computer BOOLEAN DEFAULT 0,     computer_team TEXT,     team1_score INTEGER DEFAULT NULL,     team2_score INTEGER DEFAULT NULL,     winner_team_id INTEGER DEFAULT NULL,     updated_user_id INTEGER DEFAULT NULL,     match_type TEXT CHECK(match_type IN ('home', 'away')),     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tie_slot INTEGER,     FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,     FOREIGN KEY (team1_id) REFERENCES all_clubs(id),     FOREIGN KEY (team2_id) REFERENCES all_clubs(id),     FOREIGN KEY (winner_team_id) REFERENCES all_clubs(id),     FOREIGN KEY (team1_user_id) REFERENCES users(id),     FOREIGN KEY (team2_user_id) REFERENCES users(id),     FOREIGN KEY (updated_user_id) REFERENCES users(id) );

CREATE TABLE league_matches (     id INTEGER PRIMARY KEY,     group_id INTEGER NOT NULL,     team1_id INTEGER NOT NULL,     team2_id INTEGER NOT NULL,     team1_user_id INTEGER,     team2_user_id INTEGER,     is_vs_computer BOOLEAN DEFAULT FALSE,     computer_team TEXT,     team1_score INTEGER,     team2_score INTEGER,     winner_team_id INTEGER,     updated_user_id INTEGER,     match_type TEXT CHECK(match_type IN ('home', 'away')),     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, score_processed INTEGER DEFAULT 0,     FOREIGN KEY (group_id) REFERENCES league_groups(id) ON DELETE CASCADE,     FOREIGN KEY (team1_id) REFERENCES all_clubs(id),     FOREIGN KEY (team2_id) REFERENCES all_clubs(id),     FOREIGN KEY (winner_team_id) REFERENCES all_clubs(id),     FOREIGN KEY (team1_user_id) REFERENCES users(id),     FOREIGN KEY (team2_user_id) REFERENCES users(id),     FOREIGN KEY (updated_user_id) REFERENCES users(id) );

CREATE TABLE leagues (     id INTEGER PRIMARY KEY,     name TEXT NOT NULL,     banner_id INTEGER NOT NULL,     created_by_user_id INTEGER NOT NULL,     created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_group BOOLEAN DEFAULT TRUE, team_count INTEGER NOT NULL DEFAULT 0,     FOREIGN KEY (created_by_user_id) REFERENCES users(id) );

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    encrypted_message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, is_read INTEGER DEFAULT 0);

CREATE TABLE national_knockouts (     id INTEGER PRIMARY KEY,     league_id INTEGER NOT NULL,     round TEXT NOT NULL,     match_order INTEGER,     team1_id INTEGER DEFAULT NULL,     team2_id INTEGER DEFAULT NULL,     team1_user_id INTEGER DEFAULT NULL,     team2_user_id INTEGER DEFAULT NULL,     is_vs_computer BOOLEAN DEFAULT 0,     computer_team TEXT,     team1_score INTEGER DEFAULT NULL,     team2_score INTEGER DEFAULT NULL,     winner_team_id INTEGER DEFAULT NULL,     updated_user_id INTEGER DEFAULT NULL,     match_type TEXT DEFAULT 'neutral' CHECK(match_type = 'neutral'),     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,     FOREIGN KEY (team1_id) REFERENCES all_countries(id),     FOREIGN KEY (team2_id) REFERENCES all_countries(id),     FOREIGN KEY (winner_team_id) REFERENCES all_countries(id),     FOREIGN KEY (team1_user_id) REFERENCES users(id),     FOREIGN KEY (team2_user_id) REFERENCES users(id),     FOREIGN KEY (updated_user_id) REFERENCES users(id) );

CREATE TABLE national_round_knockouts (     id INTEGER PRIMARY KEY,     league_id INTEGER NOT NULL,     round TEXT NOT NULL,     match_order INTEGER,     team1_id INTEGER DEFAULT NULL,      team2_id INTEGER DEFAULT NULL,      team1_user_id INTEGER DEFAULT NULL,      team2_user_id INTEGER DEFAULT NULL,      is_vs_computer BOOLEAN DEFAULT 0,     computer_team TEXT,     team1_score INTEGER DEFAULT NULL,      team2_score INTEGER DEFAULT NULL,      winner_team_id INTEGER DEFAULT NULL,      updated_user_id INTEGER DEFAULT NULL,      match_type TEXT DEFAULT 'neutral' CHECK(match_type = 'neutral'),     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,     FOREIGN KEY (team1_id) REFERENCES all_countries(id),     FOREIGN KEY (team2_id) REFERENCES all_countries(id),     FOREIGN KEY (winner_team_id) REFERENCES all_countries(id),     FOREIGN KEY (team1_user_id) REFERENCES users(id),     FOREIGN KEY (team2_user_id) REFERENCES users(id),     FOREIGN KEY (updated_user_id) REFERENCES users(id) );

CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 1, window_start INTEGER NOT NULL);

CREATE TABLE round_knockouts (     id INTEGER PRIMARY KEY,     league_id INTEGER NOT NULL,     round TEXT NOT NULL,     match_order INTEGER,     team1_id INTEGER DEFAULT NULL,     team2_id INTEGER DEFAULT NULL,     team1_user_id INTEGER DEFAULT NULL,     team2_user_id INTEGER DEFAULT NULL,     is_vs_computer BOOLEAN DEFAULT 0,     computer_team TEXT,     team1_score INTEGER DEFAULT NULL,     team2_score INTEGER DEFAULT NULL,     winner_team_id INTEGER DEFAULT NULL,     updated_user_id INTEGER DEFAULT NULL,     match_type TEXT CHECK(match_type IN ('home', 'away')),     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tie_slot INTEGER,     FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,     FOREIGN KEY (team1_id) REFERENCES all_clubs(id),     FOREIGN KEY (team2_id) REFERENCES all_clubs(id),     FOREIGN KEY (winner_team_id) REFERENCES all_clubs(id),     FOREIGN KEY (team1_user_id) REFERENCES users(id),     FOREIGN KEY (team2_user_id) REFERENCES users(id),     FOREIGN KEY (updated_user_id) REFERENCES users(id) );

CREATE TABLE user_notification_state (   user_id INTEGER PRIMARY KEY,   updated_at TEXT );

CREATE TABLE user_teams (     id INTEGER PRIMARY KEY,     league_instance_id INTEGER NOT NULL,     user_id INTEGER,     team_id INTEGER,     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (user_id) REFERENCES users(id),     FOREIGN KEY (team_id) REFERENCES all_clubs(id),     FOREIGN KEY (league_instance_id) REFERENCES league_instances(id) ON DELETE CASCADE );

CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT, salt TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT NULL, is_online INTEGER DEFAULT 0, last_seen TEXT, public_key TEXT);

-- Indexes (75)

CREATE INDEX idx_cgs_group_id ON country_group_standings(group_id);

CREATE INDEX idx_cgs_team_id ON country_group_standings(team_id);

CREATE INDEX idx_cgs_updated_at ON country_group_standings(updated_at);

CREATE INDEX idx_cgs_user_id ON country_group_standings(user_id);

CREATE INDEX idx_cm_group_id ON country_matches(group_id);

CREATE INDEX idx_cm_team1_id ON country_matches(team1_id);

CREATE INDEX idx_cm_team1_user_id ON country_matches(team1_user_id);

CREATE INDEX idx_cm_team2_id ON country_matches(team2_id);

CREATE INDEX idx_cm_team2_user_id ON country_matches(team2_user_id);

CREATE INDEX idx_cm_updated_at ON country_matches(updated_at);

CREATE INDEX idx_cm_updated_user_id ON country_matches(updated_user_id);

CREATE INDEX idx_cm_winner_team_id ON country_matches(winner_team_id);

CREATE INDEX idx_conversations_user1
ON conversations(user1_id);

CREATE INDEX idx_conversations_user2
ON conversations(user2_id);

CREATE INDEX idx_country_name ON all_countries(country_name);

CREATE INDEX idx_created_at ON all_countries(created_at);

CREATE INDEX idx_created_by_user_id ON all_countries(created_by_user_id);

CREATE INDEX idx_friends_friend_status ON friends(friend_id, status);

CREATE INDEX idx_friends_friend_status_created   ON friends(friend_id, status, created_at);

CREATE UNIQUE INDEX idx_friends_unique_pair ON friends(user_id, friend_id);

CREATE INDEX idx_friends_user_friend ON friends(user_id, friend_id);

CREATE INDEX idx_friends_user_status ON friends(user_id, status);

CREATE INDEX idx_group_standings_group_id ON group_standings(group_id);

CREATE INDEX idx_group_standings_group_team ON group_standings(group_id, team_id);

CREATE INDEX idx_group_standings_user ON group_standings(user_id);

CREATE INDEX idx_is_europe ON all_countries(is_europe);

CREATE INDEX idx_knockouts_league_id ON league_knockouts (league_id);

CREATE INDEX idx_knockouts_league_round ON league_knockouts (league_id, round);

CREATE INDEX idx_knockouts_next   ON league_knockouts(league_id, round, match_order, match_type);

CREATE INDEX idx_knockouts_order ON league_knockouts (league_id, round, match_order);

CREATE INDEX idx_knockouts_team1_id ON league_knockouts (team1_id);

CREATE INDEX idx_knockouts_team1_user ON league_knockouts (team1_user_id);

CREATE INDEX idx_knockouts_team2_id ON league_knockouts (team2_id);

CREATE INDEX idx_knockouts_team2_user ON league_knockouts (team2_user_id);

CREATE INDEX idx_knockouts_tie   ON league_knockouts(league_id, round, match_order);

CREATE INDEX idx_knockouts_updated_user ON league_knockouts (updated_user_id);

CREATE INDEX idx_knockouts_winner_team_id ON league_knockouts (winner_team_id);

CREATE INDEX idx_kos_tie   ON league_knockouts(league_id, round, match_order, tie_slot);

CREATE INDEX idx_league_access_league ON league_access(league_id);

CREATE INDEX idx_league_access_lookup   ON league_access(league_id, user_id);

CREATE INDEX idx_league_access_user ON league_access(user_id);

CREATE INDEX idx_league_groups_instance_id ON league_groups(league_instance_id);

CREATE INDEX idx_league_matches_group_id ON league_matches(group_id);

CREATE INDEX idx_league_matches_teams ON league_matches(team1_id, team2_id);

CREATE INDEX idx_leagues_banner_id ON leagues(banner_id);

CREATE INDEX idx_leagues_created_at ON leagues(created_at);

CREATE INDEX idx_leagues_created_by_user ON leagues(created_by_user_id);

CREATE INDEX idx_messages_conversation_id
ON messages(conversation_id);

CREATE INDEX idx_nk_league_id ON national_knockouts(league_id);

CREATE INDEX idx_nk_match_order ON national_knockouts(match_order);

CREATE INDEX idx_nk_round ON national_knockouts(round);

CREATE INDEX idx_nk_team1_id ON national_knockouts(team1_id);

CREATE INDEX idx_nk_team1_user_id ON national_knockouts(team1_user_id);

CREATE INDEX idx_nk_team2_id ON national_knockouts(team2_id);

CREATE INDEX idx_nk_team2_user_id ON national_knockouts(team2_user_id);

CREATE INDEX idx_nk_updated_at ON national_knockouts(updated_at);

CREATE INDEX idx_nk_updated_user_id ON national_knockouts(updated_user_id);

CREATE INDEX idx_nk_winner_team_id ON national_knockouts(winner_team_id);

CREATE INDEX idx_nrk_league_id ON national_round_knockouts(league_id);

CREATE INDEX idx_nrk_match_order ON national_round_knockouts(match_order);

CREATE INDEX idx_nrk_round ON national_round_knockouts(round);

CREATE INDEX idx_nrk_team1_id ON national_round_knockouts(team1_id);

CREATE INDEX idx_nrk_team1_user_id ON national_round_knockouts(team1_user_id);

CREATE INDEX idx_nrk_team2_id ON national_round_knockouts(team2_id);

CREATE INDEX idx_nrk_team2_user_id ON national_round_knockouts(team2_user_id);

CREATE INDEX idx_nrk_updated_at ON national_round_knockouts(updated_at);

CREATE INDEX idx_nrk_updated_user_id ON national_round_knockouts(updated_user_id);

CREATE INDEX idx_nrk_winner_team_id ON national_round_knockouts(winner_team_id);

CREATE INDEX idx_rk_league_round ON round_knockouts(league_id, "round");

CREATE INDEX idx_rk_league_round_order_slot ON round_knockouts(league_id, "round", match_order, tie_slot);

CREATE INDEX idx_rk_team1 ON round_knockouts(team1_id);

CREATE INDEX idx_rk_team2 ON round_knockouts(team2_id);

CREATE INDEX idx_user_teams_league_user ON user_teams(league_instance_id, user_id);

CREATE INDEX idx_user_teams_team ON user_teams(team_id);

CREATE UNIQUE INDEX ux_final_single ON league_knockouts(league_id, round, match_order) WHERE round = 'final';

-- Added by db/migrations/001_add_missing_indexes.sql
CREATE INDEX idx_league_instances_league_id ON league_instances(league_id);

CREATE INDEX idx_rk_team1_user ON round_knockouts(team1_user_id);

CREATE INDEX idx_rk_team2_user ON round_knockouts(team2_user_id);

CREATE INDEX idx_users_username_lower ON users(LOWER(username));

CREATE INDEX idx_users_email_lower ON users(LOWER(email));

CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at, id);

CREATE INDEX idx_messages_conversation_unread ON messages(conversation_id, is_read, sender_id);

-- Added by db/migrations/002_live_cache.sql
CREATE TABLE live_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT '',
  fetched_at INTEGER NOT NULL DEFAULT 0,
  refreshing_until INTEGER NOT NULL DEFAULT 0
);
