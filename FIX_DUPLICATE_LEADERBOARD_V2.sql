-- ===============================================
-- 🔥 FIX DUPLICATE USERS IN LEADERBOARD (V2)
-- ===============================================
-- Problem: Users STILL appear twice (pytek + 0xc4...8798)
-- Root Cause: Multiple player_profiles entries with same wallet_address
--             but different user_id values (fc:123 vs 0xc4...8798)
-- Solution: Map ALL user_id values to their wallet_address, then aggregate
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
WITH wallet_mapping AS (
  -- Map ALL user_id values to their wallet_address
  -- This ensures we capture sessions from both fc:123 AND 0xc4...8798
  SELECT 
    p.user_id,
    COALESCE(p.wallet_address, p.canonical_user_id) AS wallet_key,
    p.farcaster_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid
  FROM player_profiles p
),
best_profile AS (
  -- Select the BEST profile for each wallet_key
  -- Prefer Farcaster profiles over wallet-only profiles
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    CASE 
      WHEN farcaster_username IS NOT NULL AND farcaster_username != ''
      THEN farcaster_username
      ELSE display_name
    END AS display_name,
    avatar_url
  FROM wallet_mapping
  ORDER BY 
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  bp.wallet_key AS canonical_user_id,
  bp.display_name,
  bp.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN wallet_mapping wm ON LOWER(gs.user_id) = LOWER(wm.user_id)
JOIN best_profile bp ON bp.wallet_key = wm.wallet_key
WHERE gs.mode = 'classic'
GROUP BY bp.wallet_key, bp.display_name, bp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW 2: Walls Mode (Time Blitz)
-- ===============================================
CREATE VIEW leaderboard_walls AS
WITH wallet_mapping AS (
  SELECT 
    p.user_id,
    COALESCE(p.wallet_address, p.canonical_user_id) AS wallet_key,
    p.farcaster_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    CASE 
      WHEN farcaster_username IS NOT NULL AND farcaster_username != ''
      THEN farcaster_username
      ELSE display_name
    END AS display_name,
    avatar_url
  FROM wallet_mapping
  ORDER BY 
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  bp.wallet_key AS canonical_user_id,
  bp.display_name,
  bp.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN wallet_mapping wm ON LOWER(gs.user_id) = LOWER(wm.user_id)
JOIN best_profile bp ON bp.wallet_key = wm.wallet_key
WHERE gs.mode = 'walls'
GROUP BY bp.wallet_key, bp.display_name, bp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW 3: Chill Mode (Zen Flow)
-- ===============================================
CREATE VIEW leaderboard_chill AS
WITH wallet_mapping AS (
  SELECT 
    p.user_id,
    COALESCE(p.wallet_address, p.canonical_user_id) AS wallet_key,
    p.farcaster_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    CASE 
      WHEN farcaster_username IS NOT NULL AND farcaster_username != ''
      THEN farcaster_username
      ELSE display_name
    END AS display_name,
    avatar_url
  FROM wallet_mapping
  ORDER BY 
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  bp.wallet_key AS canonical_user_id,
  bp.display_name,
  bp.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN wallet_mapping wm ON LOWER(gs.user_id) = LOWER(wm.user_id)
JOIN best_profile bp ON bp.wallet_key = wm.wallet_key
WHERE gs.mode = 'chill'
GROUP BY bp.wallet_key, bp.display_name, bp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW 4: Total Apples (All Modes Combined)
-- ===============================================
CREATE VIEW leaderboard_total_apples AS
WITH wallet_mapping AS (
  SELECT 
    p.user_id,
    COALESCE(p.wallet_address, p.canonical_user_id) AS wallet_key,
    p.farcaster_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    CASE 
      WHEN farcaster_username IS NOT NULL AND farcaster_username != ''
      THEN farcaster_username
      ELSE display_name
    END AS display_name,
    avatar_url
  FROM wallet_mapping
  ORDER BY 
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  bp.wallet_key AS canonical_user_id,
  bp.display_name,
  bp.avatar_url,
  SUM(gs.apples_eaten) AS total_apples,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN wallet_mapping wm ON LOWER(gs.user_id) = LOWER(wm.user_id)
JOIN best_profile bp ON bp.wallet_key = wm.wallet_key
GROUP BY bp.wallet_key, bp.display_name, bp.avatar_url
ORDER BY total_apples DESC
LIMIT 100;

-- ===============================================
-- ✅ VERIFY SETUP
-- ===============================================
SELECT 'leaderboard_classic' as view_name, COUNT(*) as row_count FROM leaderboard_classic
UNION ALL
SELECT 'leaderboard_walls' as view_name, COUNT(*) as row_count FROM leaderboard_walls
UNION ALL
SELECT 'leaderboard_chill' as view_name, COUNT(*) as row_count FROM leaderboard_chill
UNION ALL
SELECT 'leaderboard_total_apples' as view_name, COUNT(*) as row_count FROM leaderboard_total_apples;

-- ===============================================
-- 📊 DIAGNOSTIC QUERIES
-- ===============================================

-- 1. Check for duplicate wallet addresses in profiles
SELECT 
  'Duplicate wallet_address entries' AS check_name,
  wallet_address,
  COUNT(*) AS profile_count,
  STRING_AGG(user_id, ', ') AS user_ids
FROM player_profiles
WHERE wallet_address IS NOT NULL
GROUP BY wallet_address
HAVING COUNT(*) > 1
ORDER BY profile_count DESC;

-- 2. Check specific user (replace with actual wallet)
-- SELECT * FROM player_profiles WHERE wallet_address ILIKE '%c4%8798%';

-- 3. Verify no duplicates in final leaderboard
SELECT 
  'Duplicates in leaderboard_classic' AS check_name,
  display_name,
  COUNT(*) AS count
FROM leaderboard_classic
GROUP BY display_name
HAVING COUNT(*) > 1;

-- 4. Show sample data from leaderboard
SELECT 
  canonical_user_id,
  display_name,
  score,
  games_played
FROM leaderboard_classic
ORDER BY score DESC
LIMIT 10;
