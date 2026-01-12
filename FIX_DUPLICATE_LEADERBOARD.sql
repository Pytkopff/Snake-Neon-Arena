-- ===============================================
-- 🔥 FIX DUPLICATE USERS IN LEADERBOARD
-- ===============================================
-- Problem: Users appear twice if they have both Farcaster + Wallet
-- Solution: GROUP BY wallet_address and prefer Farcaster username
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
WITH ranked_profiles AS (
  SELECT DISTINCT ON (COALESCE(p.wallet_address, p.canonical_user_id))
    COALESCE(p.wallet_address, p.canonical_user_id) AS unique_id,
    p.wallet_address,
    p.canonical_user_id,
    -- Prefer Farcaster username over wallet address
    CASE 
      WHEN p.farcaster_username IS NOT NULL AND p.farcaster_username != '' 
      THEN p.farcaster_username
      ELSE p.display_name
    END AS display_name,
    p.avatar_url,
    p.user_id
  FROM player_profiles p
  -- Order to prefer Farcaster profiles (with farcaster_fid) over wallet-only profiles
  ORDER BY 
    COALESCE(p.wallet_address, p.canonical_user_id),
    CASE WHEN p.farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  rp.unique_id AS canonical_user_id,
  rp.display_name,
  rp.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN ranked_profiles rp
  ON LOWER(gs.user_id) = LOWER(rp.canonical_user_id)
  OR (rp.wallet_address IS NOT NULL AND LOWER(gs.user_id) = LOWER(rp.wallet_address))
WHERE gs.mode = 'classic'
GROUP BY rp.unique_id, rp.display_name, rp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW 2: Walls Mode (Time Blitz)
-- ===============================================
CREATE VIEW leaderboard_walls AS
WITH ranked_profiles AS (
  SELECT DISTINCT ON (COALESCE(p.wallet_address, p.canonical_user_id))
    COALESCE(p.wallet_address, p.canonical_user_id) AS unique_id,
    p.wallet_address,
    p.canonical_user_id,
    -- Prefer Farcaster username over wallet address
    CASE 
      WHEN p.farcaster_username IS NOT NULL AND p.farcaster_username != '' 
      THEN p.farcaster_username
      ELSE p.display_name
    END AS display_name,
    p.avatar_url,
    p.user_id
  FROM player_profiles p
  -- Order to prefer Farcaster profiles (with farcaster_fid) over wallet-only profiles
  ORDER BY 
    COALESCE(p.wallet_address, p.canonical_user_id),
    CASE WHEN p.farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  rp.unique_id AS canonical_user_id,
  rp.display_name,
  rp.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN ranked_profiles rp
  ON LOWER(gs.user_id) = LOWER(rp.canonical_user_id)
  OR (rp.wallet_address IS NOT NULL AND LOWER(gs.user_id) = LOWER(rp.wallet_address))
WHERE gs.mode = 'walls'
GROUP BY rp.unique_id, rp.display_name, rp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW 3: Chill Mode (Zen Flow)
-- ===============================================
CREATE VIEW leaderboard_chill AS
WITH ranked_profiles AS (
  SELECT DISTINCT ON (COALESCE(p.wallet_address, p.canonical_user_id))
    COALESCE(p.wallet_address, p.canonical_user_id) AS unique_id,
    p.wallet_address,
    p.canonical_user_id,
    -- Prefer Farcaster username over wallet address
    CASE 
      WHEN p.farcaster_username IS NOT NULL AND p.farcaster_username != '' 
      THEN p.farcaster_username
      ELSE p.display_name
    END AS display_name,
    p.avatar_url,
    p.user_id
  FROM player_profiles p
  -- Order to prefer Farcaster profiles (with farcaster_fid) over wallet-only profiles
  ORDER BY 
    COALESCE(p.wallet_address, p.canonical_user_id),
    CASE WHEN p.farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  rp.unique_id AS canonical_user_id,
  rp.display_name,
  rp.avatar_url,
  MAX(gs.score) AS score,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN ranked_profiles rp
  ON LOWER(gs.user_id) = LOWER(rp.canonical_user_id)
  OR (rp.wallet_address IS NOT NULL AND LOWER(gs.user_id) = LOWER(rp.wallet_address))
WHERE gs.mode = 'chill'
GROUP BY rp.unique_id, rp.display_name, rp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW 4: Total Apples (All Modes Combined)
-- ===============================================
CREATE VIEW leaderboard_total_apples AS
WITH ranked_profiles AS (
  SELECT DISTINCT ON (COALESCE(p.wallet_address, p.canonical_user_id))
    COALESCE(p.wallet_address, p.canonical_user_id) AS unique_id,
    p.wallet_address,
    p.canonical_user_id,
    -- Prefer Farcaster username over wallet address
    CASE 
      WHEN p.farcaster_username IS NOT NULL AND p.farcaster_username != '' 
      THEN p.farcaster_username
      ELSE p.display_name
    END AS display_name,
    p.avatar_url,
    p.user_id
  FROM player_profiles p
  -- Order to prefer Farcaster profiles (with farcaster_fid) over wallet-only profiles
  ORDER BY 
    COALESCE(p.wallet_address, p.canonical_user_id),
    CASE WHEN p.farcaster_fid IS NOT NULL THEN 0 ELSE 1 END
)
SELECT
  rp.unique_id AS canonical_user_id,
  rp.display_name,
  rp.avatar_url,
  SUM(gs.apples_eaten) AS total_apples,
  COUNT(DISTINCT gs.id) AS games_played
FROM game_sessions gs
JOIN ranked_profiles rp
  ON LOWER(gs.user_id) = LOWER(rp.canonical_user_id)
  OR (rp.wallet_address IS NOT NULL AND LOWER(gs.user_id) = LOWER(rp.wallet_address))
GROUP BY rp.unique_id, rp.display_name, rp.avatar_url
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
-- 📊 TEST QUERY: Check for duplicates
-- ===============================================
-- Run this to verify no duplicates exist
-- Should return 0 rows if fix is working
SELECT 
  display_name, 
  COUNT(*) as count
FROM leaderboard_classic
GROUP BY display_name
HAVING COUNT(*) > 1;
