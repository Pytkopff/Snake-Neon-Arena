-- ===============================================
-- 🔥 FIX DUPLICATE USERS IN LEADERBOARD (FINAL FIX)
-- ===============================================
-- Issue: Syntax errors in previous script
-- Root Cause: Multiple player_profiles with same wallet_address
-- Solution: Robust grouping by normalized wallet_address
-- Run this in Supabase SQL Editor
-- ===============================================

-- Drop existing views
DROP VIEW IF EXISTS leaderboard_classic CASCADE;
DROP VIEW IF EXISTS leaderboard_walls CASCADE;
DROP VIEW IF EXISTS leaderboard_chill CASCADE;
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

-- ===============================================
-- VIEW 1: Classic Mode (Neon Ranked)
-- ===============================================
CREATE VIEW leaderboard_classic AS
WITH user_wallet_map AS (
  -- Map each user_id to a unique wallet key
  -- Use wallet_address if available, otherwise use user_id
  -- IMPORTANT: Normalize to lowercase for case-insensitive matching
  SELECT 
    LOWER(p.user_id::TEXT) AS session_user_id,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key
  FROM player_profiles p
),
best_display_name AS (
  -- For each wallet_key, pick the best display name
  -- Priority: Farcaster username > display_name
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

-- ===============================================
-- VIEW 2: Walls Mode (Time Blitz)
-- ===============================================
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

-- ===============================================
-- VIEW 3: Chill Mode (Zen Flow)
-- ===============================================
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

-- ===============================================
-- VIEW 4: Total Apples (All Modes Combined)
-- ===============================================
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

-- ===============================================
-- ✅ VERIFY RESULTS
-- ===============================================
SELECT 'leaderboard_classic' AS view_name, COUNT(*) AS row_count FROM leaderboard_classic
UNION ALL
SELECT 'leaderboard_walls' AS view_name, COUNT(*) AS row_count FROM leaderboard_walls
UNION ALL
SELECT 'leaderboard_chill' AS view_name, COUNT(*) AS row_count FROM leaderboard_chill
UNION ALL
SELECT 'leaderboard_total_apples' AS view_name, COUNT(*) AS row_count FROM leaderboard_total_apples;

-- ===============================================
-- 📊 CHECK FOR DUPLICATES (Should return 0 rows)
-- ===============================================
SELECT 
  'Duplicates in classic' AS check_type,
  canonical_user_id,
  display_name,
  COUNT(*) AS duplicate_count
FROM leaderboard_classic
GROUP BY canonical_user_id, display_name
HAVING COUNT(*) > 1

UNION ALL

SELECT 
  'Duplicates by display_name' AS check_type,
  NULL AS canonical_user_id,
  display_name,
  COUNT(*) AS duplicate_count
FROM leaderboard_classic
GROUP BY display_name
HAVING COUNT(*) > 1;

-- ===============================================
-- 📊 SAMPLE DATA (Top 10 Classic)
-- ===============================================
SELECT 
  ROW_NUMBER() OVER (ORDER BY score DESC) AS rank,
  canonical_user_id,
  display_name,
  score,
  games_played
FROM leaderboard_classic
ORDER BY score DESC
LIMIT 10;
