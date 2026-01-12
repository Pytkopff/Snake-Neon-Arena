-- ===============================================
-- 🗑️ CLEAR LEADERBOARD DATA FOR TESTING
-- ===============================================
-- ⚠️ WARNING: This will DELETE all game sessions and player profiles!
-- Use this to start fresh and test the new leaderboard views
-- Run this in Supabase SQL Editor
-- ===============================================

-- ===============================================
-- OPTION 1: BACKUP DATA (Recommended first!)
-- ===============================================
-- Uncomment these lines to create backup tables before deletion
-- CREATE TABLE game_sessions_backup AS SELECT * FROM game_sessions;
-- CREATE TABLE player_profiles_backup AS SELECT * FROM player_profiles;
-- SELECT 'Backup created!' AS status;

-- ===============================================
-- OPTION 2: CLEAR ALL DATA (Complete Reset)
-- ===============================================
-- This will delete ALL game sessions and player profiles
-- Uncomment to execute:

-- DELETE FROM game_sessions;
-- DELETE FROM player_profiles;

-- SELECT 'All data cleared!' AS status;

-- ===============================================
-- OPTION 3: CLEAR ONLY GAME SESSIONS (Keep Profiles)
-- ===============================================
-- This keeps player profiles but removes all game history
-- Useful if you want to keep user accounts but reset scores
-- Uncomment to execute:

-- DELETE FROM game_sessions;

-- SELECT 'Game sessions cleared! Player profiles kept.' AS status;

-- ===============================================
-- OPTION 4: CLEAR ONLY FOR SPECIFIC USERS (Selective)
-- ===============================================
-- Clear data only for specific wallet addresses or user IDs
-- Replace '0xc4...8798' with actual addresses you want to clear
-- Uncomment and modify to execute:

-- DELETE FROM game_sessions 
-- WHERE user_id IN (
--   SELECT user_id FROM player_profiles 
--   WHERE wallet_address ILIKE '%c4%8798%'
--    OR user_id ILIKE '%c4%8798%'
--    OR farcaster_username = 'pytek'
-- );

-- DELETE FROM player_profiles
-- WHERE wallet_address ILIKE '%c4%8798%'
--    OR user_id ILIKE '%c4%8798%'
--    OR farcaster_username = 'pytek';

-- SELECT 'Selected users cleared!' AS status;

-- ===============================================
-- VERIFY CLEARANCE
-- ===============================================
-- Run these after clearing to verify:

SELECT 
  'game_sessions' AS table_name,
  COUNT(*) AS remaining_rows
FROM game_sessions

UNION ALL

SELECT 
  'player_profiles' AS table_name,
  COUNT(*) AS remaining_rows
FROM player_profiles

UNION ALL

SELECT 
  'leaderboard_classic' AS table_name,
  COUNT(*) AS remaining_rows
FROM leaderboard_classic

UNION ALL

SELECT 
  'leaderboard_walls' AS table_name,
  COUNT(*) AS remaining_rows
FROM leaderboard_walls

UNION ALL

SELECT 
  'leaderboard_chill' AS table_name,
  COUNT(*) AS remaining_rows
FROM leaderboard_chill

UNION ALL

SELECT 
  'leaderboard_total_apples' AS table_name,
  COUNT(*) AS remaining_rows
FROM leaderboard_total_apples;

-- ===============================================
-- QUICK RESET (All-in-one)
-- ===============================================
-- If you want to clear everything at once, uncomment this entire block:

/*
-- Step 1: Backup (optional but recommended)
CREATE TABLE IF NOT EXISTS game_sessions_backup AS SELECT * FROM game_sessions;
CREATE TABLE IF NOT EXISTS player_profiles_backup AS SELECT * FROM player_profiles;

-- Step 2: Clear all data
DELETE FROM game_sessions;
DELETE FROM player_profiles;

-- Step 3: Verify
SELECT 
  'Cleared!' AS status,
  (SELECT COUNT(*) FROM game_sessions) AS sessions_remaining,
  (SELECT COUNT(*) FROM player_profiles) AS profiles_remaining;
*/
