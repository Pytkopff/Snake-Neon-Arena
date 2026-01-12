-- ===============================================
-- 🔍 DIAGNOSE DUPLICATE ENTRIES
-- ===============================================
-- This will show you EXACTLY what's in the database
-- Replace 'pytek' with your Farcaster username
-- Run this in Supabase SQL Editor
-- ===============================================

-- 1. Show ALL profiles for user 'pytek' or wallet 0xc4...8798
SELECT 
  'player_profiles' AS table_name,
  user_id,
  canonical_user_id,
  wallet_address,
  farcaster_fid,
  farcaster_username,
  display_name,
  created_at
FROM player_profiles
WHERE farcaster_username ILIKE '%pytek%'
   OR wallet_address ILIKE '%c4ffd985%'
   OR wallet_address ILIKE '%8798%'
   OR display_name ILIKE '%pytek%'
   OR user_id ILIKE '%pytek%'
ORDER BY created_at DESC;

-- 2. Show ALL game sessions for these profiles
SELECT 
  'game_sessions' AS table_name,
  gs.id,
  gs.user_id,
  gs.mode,
  gs.score,
  gs.apples_eaten,
  gs.created_at,
  -- Try to match with profile
  p.display_name AS profile_name,
  p.farcaster_username
FROM game_sessions gs
LEFT JOIN player_profiles p 
  ON LOWER(gs.user_id) = LOWER(p.user_id)
WHERE gs.user_id ILIKE '%pytek%'
   OR gs.user_id ILIKE '%c4ffd985%'
   OR gs.user_id ILIKE '%8798%'
   OR p.farcaster_username ILIKE '%pytek%'
ORDER BY gs.created_at DESC;

-- 3. Show what the leaderboard sees
SELECT 
  'leaderboard_classic_raw' AS view_name,
  canonical_user_id,
  display_name,
  score,
  games_played
FROM leaderboard_classic
WHERE display_name ILIKE '%pytek%'
   OR canonical_user_id ILIKE '%pytek%'
   OR canonical_user_id ILIKE '%c4ffd985%'
   OR canonical_user_id ILIKE '%8798%'
ORDER BY score DESC;

-- 4. Count how many profiles exist for this wallet
SELECT 
  COUNT(*) AS profile_count,
  STRING_AGG(user_id, ', ') AS all_user_ids,
  STRING_AGG(display_name, ', ') AS all_display_names
FROM player_profiles
WHERE wallet_address ILIKE '%c4ffd985%'
   OR wallet_address ILIKE '%8798%'
   OR farcaster_username ILIKE '%pytek%';

-- ===============================================
-- 🔧 MANUAL CLEANUP (if needed)
-- ===============================================
-- If you see duplicate profiles, uncomment this to merge them manually:

/*
-- Step 1: Find all user_ids for your wallet
SELECT user_id, display_name, farcaster_username, wallet_address 
FROM player_profiles 
WHERE wallet_address ILIKE '%c4ffd985%' OR farcaster_username ILIKE '%pytek%';

-- Step 2: Update all game sessions to use the Farcaster user_id
-- UPDATE game_sessions 
-- SET user_id = 'fc:YOUR_FID_HERE'
-- WHERE user_id IN (
--   SELECT user_id FROM player_profiles 
--   WHERE wallet_address ILIKE '%c4ffd985%'
-- );

-- Step 3: Delete duplicate profiles (keep only Farcaster one)
-- DELETE FROM player_profiles 
-- WHERE wallet_address ILIKE '%c4ffd985%'
--   AND farcaster_fid IS NULL;
*/
