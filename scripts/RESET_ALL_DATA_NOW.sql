-- ===============================================
-- 🗑️ INSTANT RESET - Clear All Game Data
-- ===============================================
-- ⚠️ This will DELETE ALL game sessions and profiles
-- Use for fresh testing
-- Run this in Supabase SQL Editor
-- ===============================================

-- Step 1: Create backup (RECOMMENDED!)
CREATE TABLE IF NOT EXISTS game_sessions_backup AS SELECT * FROM game_sessions;
CREATE TABLE IF NOT EXISTS player_profiles_backup AS SELECT * FROM player_profiles;

-- Step 2: Clear all data
DELETE FROM game_sessions;
DELETE FROM player_profiles;

-- Step 3: Verify
SELECT 
  'Data cleared!' AS status,
  (SELECT COUNT(*) FROM game_sessions) AS sessions_remaining,
  (SELECT COUNT(*) FROM player_profiles) AS profiles_remaining,
  (SELECT COUNT(*) FROM leaderboard_classic) AS classic_leaderboard,
  (SELECT COUNT(*) FROM leaderboard_walls) AS walls_leaderboard,
  (SELECT COUNT(*) FROM leaderboard_chill) AS chill_leaderboard;

-- ===============================================
-- ✅ Success - Data is clean!
-- ===============================================
-- Next steps:
-- 1. Close this tab
-- 2. Go to your Snake game
-- 3. Test scenarios:
--    A) Farcaster login → play → check leaderboard
--    B) Connect wallet → play → check for duplicates
--    C) Different wallets → verify no duplicates
-- ===============================================
