-- ===============================================
-- 🔥 COMPLETE RESET + FIX (All-in-One)
-- ===============================================
-- This script will:
-- 1. Backup your data
-- 2. Clear all game sessions and profiles
-- 3. Rebuild leaderboard views with proper deduplication
-- 4. Verify everything is clean
-- Run this ONCE in Supabase SQL Editor
-- ===============================================

-- STEP 1: Backup (just in case)
-- ===============================================
DROP TABLE IF EXISTS game_sessions_backup;
DROP TABLE IF EXISTS player_profiles_backup;
CREATE TABLE game_sessions_backup AS SELECT * FROM game_sessions;
CREATE TABLE player_profiles_backup AS SELECT * FROM player_profiles;

-- STEP 2: Clear all data
-- ===============================================
DELETE FROM game_sessions;
DELETE FROM player_profiles;

-- STEP 3: Drop old views
-- ===============================================
DROP VIEW IF EXISTS leaderboard_classic CASCADE;
DROP VIEW IF EXISTS leaderboard_walls CASCADE;
DROP VIEW IF EXISTS leaderboard_chill CASCADE;
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

-- STEP 4: Recreate views with deduplication logic
-- ===============================================

-- VIEW: Classic Mode (Neon Ranked)
CREATE VIEW leaderboard_classic AS
WITH user_wallet_map AS (
  SELECT 
    LOWER(p.user_id::TEXT) AS session_user_id,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key
  FROM player_profiles p
),
best_display_name AS (
  SELECT DISTINCT ON (LOWER(COALESCE(wallet_address, user_id)::TEXT))
    LOWER(COALESCE(wallet_address, user_id)::TEXT) AS wallet_key,
    COALESCE(
      NULLIF(farcaster_username, ''),
      display_name
    ) AS display_name,
    avatar_url
  FROM player_profiles
  ORDER BY 
    LOWER(COALESCE(wallet_address, user_id)::TEXT),
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
)
SELECT
  bdn.wallet_key AS canonical_user_id,
  bdn.display_name,
  bdn.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
INNER JOIN user_wallet_map uwm 
  ON LOWER(gs.user_id::TEXT) = uwm.session_user_id
INNER JOIN best_display_name bdn 
  ON uwm.wallet_key = bdn.wallet_key
WHERE gs.mode = 'classic'
GROUP BY bdn.wallet_key, bdn.display_name, bdn.avatar_url
ORDER BY score DESC
LIMIT 100;

-- VIEW: Walls Mode (Time Blitz)
CREATE VIEW leaderboard_walls AS
WITH user_wallet_map AS (
  SELECT 
    LOWER(p.user_id::TEXT) AS session_user_id,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key
  FROM player_profiles p
),
best_display_name AS (
  SELECT DISTINCT ON (LOWER(COALESCE(wallet_address, user_id)::TEXT))
    LOWER(COALESCE(wallet_address, user_id)::TEXT) AS wallet_key,
    COALESCE(
      NULLIF(farcaster_username, ''),
      display_name
    ) AS display_name,
    avatar_url
  FROM player_profiles
  ORDER BY 
    LOWER(COALESCE(wallet_address, user_id)::TEXT),
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
)
SELECT
  bdn.wallet_key AS canonical_user_id,
  bdn.display_name,
  bdn.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
INNER JOIN user_wallet_map uwm 
  ON LOWER(gs.user_id::TEXT) = uwm.session_user_id
INNER JOIN best_display_name bdn 
  ON uwm.wallet_key = bdn.wallet_key
WHERE gs.mode = 'walls'
GROUP BY bdn.wallet_key, bdn.display_name, bdn.avatar_url
ORDER BY score DESC
LIMIT 100;

-- VIEW: Chill Mode (Zen Flow)
CREATE VIEW leaderboard_chill AS
WITH user_wallet_map AS (
  SELECT 
    LOWER(p.user_id::TEXT) AS session_user_id,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key
  FROM player_profiles p
),
best_display_name AS (
  SELECT DISTINCT ON (LOWER(COALESCE(wallet_address, user_id)::TEXT))
    LOWER(COALESCE(wallet_address, user_id)::TEXT) AS wallet_key,
    COALESCE(
      NULLIF(farcaster_username, ''),
      display_name
    ) AS display_name,
    avatar_url
  FROM player_profiles
  ORDER BY 
    LOWER(COALESCE(wallet_address, user_id)::TEXT),
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
)
SELECT
  bdn.wallet_key AS canonical_user_id,
  bdn.display_name,
  bdn.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
INNER JOIN user_wallet_map uwm 
  ON LOWER(gs.user_id::TEXT) = uwm.session_user_id
INNER JOIN best_display_name bdn 
  ON uwm.wallet_key = bdn.wallet_key
WHERE gs.mode = 'chill'
GROUP BY bdn.wallet_key, bdn.display_name, bdn.avatar_url
ORDER BY score DESC
LIMIT 100;

-- VIEW: Total Apples
CREATE VIEW leaderboard_total_apples AS
WITH user_wallet_map AS (
  SELECT 
    LOWER(p.user_id::TEXT) AS session_user_id,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key
  FROM player_profiles p
),
best_display_name AS (
  SELECT DISTINCT ON (LOWER(COALESCE(wallet_address, user_id)::TEXT))
    LOWER(COALESCE(wallet_address, user_id)::TEXT) AS wallet_key,
    COALESCE(
      NULLIF(farcaster_username, ''),
      display_name
    ) AS display_name,
    avatar_url
  FROM player_profiles
  ORDER BY 
    LOWER(COALESCE(wallet_address, user_id)::TEXT),
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
)
SELECT
  bdn.wallet_key AS canonical_user_id,
  bdn.display_name,
  bdn.avatar_url,
  SUM(gs.apples_eaten) AS total_apples,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
INNER JOIN user_wallet_map uwm 
  ON LOWER(gs.user_id::TEXT) = uwm.session_user_id
INNER JOIN best_display_name bdn 
  ON uwm.wallet_key = bdn.wallet_key
GROUP BY bdn.wallet_key, bdn.display_name, bdn.avatar_url
ORDER BY total_apples DESC
LIMIT 100;

-- STEP 5: Verify everything is clean
-- ===============================================
SELECT 
  'VERIFICATION' AS step,
  (SELECT COUNT(*) FROM game_sessions) AS sessions,
  (SELECT COUNT(*) FROM player_profiles) AS profiles,
  (SELECT COUNT(*) FROM leaderboard_classic) AS classic_leaderboard,
  (SELECT COUNT(*) FROM leaderboard_walls) AS walls_leaderboard,
  (SELECT COUNT(*) FROM leaderboard_chill) AS chill_leaderboard,
  (SELECT COUNT(*) FROM leaderboard_total_apples) AS apples_leaderboard;

-- ===============================================
-- ✅ DONE! 
-- ===============================================
-- All data cleared and views rebuilt.
-- Go to your app and refresh (close/reopen on mobile).
-- Leaderboards should be empty now.
-- ===============================================
