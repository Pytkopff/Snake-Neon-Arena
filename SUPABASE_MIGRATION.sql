-- ===============================================
-- 🔥 SNAKE NEON ARENA - PRODUCTION MIGRATION
-- ===============================================
-- SYNCHRONIZED WITH FRONTEND CODE
-- Execute this in Supabase Dashboard → SQL Editor
-- ===============================================

-- Clean slate
DROP VIEW IF EXISTS leaderboard_classic CASCADE;
DROP VIEW IF EXISTS leaderboard_walls CASCADE;
DROP VIEW IF EXISTS leaderboard_chill CASCADE;
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS player_profiles CASCADE;

-- ===============================
-- 👤 PLAYER PROFILES
-- ===============================
CREATE TABLE player_profiles (
  user_id TEXT PRIMARY KEY,
  canonical_user_id TEXT NOT NULL,

  wallet_address TEXT,
  farcaster_fid TEXT,
  farcaster_username TEXT,

  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_canonical
  ON player_profiles (LOWER(canonical_user_id));

-- ===============================
-- 🎮 GAME SESSIONS
-- ===============================
CREATE TABLE game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('classic','walls','chill')),
  score INTEGER NOT NULL,
  apples_eaten INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_user ON game_sessions (LOWER(user_id));
CREATE INDEX idx_sessions_mode_score ON game_sessions (mode, score DESC);

-- ===============================
-- 🏆 LEADERBOARDS
-- ===============================
CREATE VIEW leaderboard_classic AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  MAX(gs.score) AS score
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.mode = 'classic'
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY score DESC;

CREATE VIEW leaderboard_walls AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  MAX(gs.score) AS score
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.mode = 'walls'
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY score DESC;

CREATE VIEW leaderboard_chill AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  MAX(gs.score) AS score
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.mode = 'chill'
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY score DESC;

CREATE VIEW leaderboard_total_apples AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  SUM(gs.apples_eaten) AS total_apples
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY total_apples DESC;

-- ===============================
-- 🔒 PERMISSIONS
-- ===============================
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- ===============================
-- ✅ VERIFY SETUP
-- ===============================
SELECT 'leaderboard_classic' as view_name, COUNT(*) as row_count FROM leaderboard_classic
UNION ALL
SELECT 'leaderboard_walls' as view_name, COUNT(*) as row_count FROM leaderboard_walls
UNION ALL
SELECT 'leaderboard_chill' as view_name, COUNT(*) as row_count FROM leaderboard_chill
UNION ALL
SELECT 'leaderboard_total_apples' as view_name, COUNT(*) as row_count FROM leaderboard_total_apples;
