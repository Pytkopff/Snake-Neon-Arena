-- ===============================================
-- 🔥 SNAKE NEON ARENA - FINAL PRODUCTION SCRIPT
-- ===============================================
-- This script is synchronized 100% with your frontend code
-- Copy-paste this ENTIRE script into Supabase SQL Editor
-- ===============================================

-- ===============================================
-- STEP 1: CLEAN SLATE (Drop Everything)
-- ===============================================

DROP VIEW IF EXISTS leaderboard_classic CASCADE;
DROP VIEW IF EXISTS leaderboard_walls CASCADE;
DROP VIEW IF EXISTS leaderboard_chill CASCADE;
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS player_profiles CASCADE;

-- ===============================================
-- STEP 2: PLAYER PROFILES TABLE
-- ===============================================
-- Frontend: syncPlayerProfile() writes to this table
-- Columns match exactly what storage.js sends

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

-- Index for fast lookups by canonical_user_id
CREATE INDEX idx_profiles_canonical 
  ON player_profiles (LOWER(canonical_user_id));

-- Index for wallet-based merging
CREATE INDEX idx_profiles_wallet 
  ON player_profiles (LOWER(wallet_address)) 
  WHERE wallet_address IS NOT NULL;

-- ===============================================
-- STEP 3: GAME SESSIONS TABLE
-- ===============================================
-- Frontend: saveGameSession() writes to 'game_sessions' 
-- Columns: user_id, mode, score, apples_eaten

CREATE TABLE game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('classic','walls','chill')),
  score INTEGER NOT NULL,
  apples_eaten INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_sessions_user 
  ON game_sessions (LOWER(user_id));

CREATE INDEX idx_sessions_mode_score 
  ON game_sessions (mode, score DESC);

CREATE INDEX idx_sessions_created 
  ON game_sessions (created_at DESC);

-- ===============================================
-- STEP 4: LEADERBOARD VIEWS
-- ===============================================
-- Frontend: GlobalLeaderboard.jsx fetches from these views
-- VIEW_MAPPING: classic, walls, chill, apples

-- VIEW 1: Classic Mode (Neon Ranked)
CREATE VIEW leaderboard_classic AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  MAX(gs.score) AS score,
  COUNT(*) AS games_played
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.mode = 'classic'
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY score DESC
LIMIT 100;

-- VIEW 2: Walls Mode (Time Blitz)
CREATE VIEW leaderboard_walls AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  MAX(gs.score) AS score,
  COUNT(*) AS games_played
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.mode = 'walls'
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY score DESC
LIMIT 100;

-- VIEW 3: Chill Mode (Zen Flow)
CREATE VIEW leaderboard_chill AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  MAX(gs.score) AS score,
  COUNT(*) AS games_played
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.mode = 'chill'
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY score DESC
LIMIT 100;

-- VIEW 4: Total Apples (All Modes Combined)
CREATE VIEW leaderboard_total_apples AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  SUM(gs.apples_eaten) AS total_apples,
  COUNT(*) AS games_played
FROM game_sessions gs
JOIN player_profiles p
  ON LOWER(gs.user_id) = LOWER(p.user_id)
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
ORDER BY total_apples DESC
LIMIT 100;

-- ===============================================
-- STEP 5: PERMISSIONS
-- ===============================================
-- Allow anonymous and authenticated users to read

GRANT SELECT ON player_profiles TO anon, authenticated;
GRANT SELECT ON game_sessions TO anon, authenticated;

GRANT SELECT ON leaderboard_classic TO anon, authenticated;
GRANT SELECT ON leaderboard_walls TO anon, authenticated;
GRANT SELECT ON leaderboard_chill TO anon, authenticated;
GRANT SELECT ON leaderboard_total_apples TO anon, authenticated;

-- ===============================================
-- STEP 6: VERIFICATION QUERY
-- ===============================================
-- Run this to verify all views were created successfully

SELECT 
  'player_profiles' AS object_name, 
  'table' AS object_type,
  COUNT(*) AS row_count 
FROM player_profiles

UNION ALL

SELECT 
  'game_sessions' AS object_name, 
  'table' AS object_type,
  COUNT(*) AS row_count 
FROM game_sessions

UNION ALL

SELECT 
  'leaderboard_classic' AS object_name, 
  'view' AS object_type,
  COUNT(*) AS row_count 
FROM leaderboard_classic

UNION ALL

SELECT 
  'leaderboard_walls' AS object_name, 
  'view' AS object_type,
  COUNT(*) AS row_count 
FROM leaderboard_walls

UNION ALL

SELECT 
  'leaderboard_chill' AS object_name, 
  'view' AS object_type,
  COUNT(*) AS row_count 
FROM leaderboard_chill

UNION ALL

SELECT 
  'leaderboard_total_apples' AS object_name, 
  'view' AS object_type,
  COUNT(*) AS row_count 
FROM leaderboard_total_apples;

-- ===============================================
-- ✅ SUCCESS!
-- ===============================================
-- If you see this message, the script executed successfully
-- Your database is now synchronized with the frontend code

SELECT '✅ Database setup complete! Tables and views are ready.' AS status;
