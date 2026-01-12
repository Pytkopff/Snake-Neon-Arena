-- ===============================================
-- 🔧 MERGE Guest Sessions to Farcaster Profile
-- ===============================================
-- This will:
-- 1. Move all guest sessions to your Farcaster profile (fc:543636)
-- 2. Remove duplicate sessions (same score, mode, time)
-- 3. Delete guest profiles
-- ===============================================

-- STEP 1: Show current state (BEFORE)
-- ===============================================
SELECT 'BEFORE MERGE' AS status;

SELECT 
  user_id,
  COUNT(*) AS total_sessions,
  SUM(CASE WHEN mode = 'classic' THEN 1 ELSE 0 END) AS classic_sessions,
  MAX(CASE WHEN mode = 'classic' THEN score ELSE 0 END) AS best_classic
FROM game_sessions
WHERE 
  user_id IN (
    'guest:aaf208d0-feca-451d-b76e-cbcf84ac1404',
    'fc:543636',
    'guest:3773fce7-51b6-49b7-a7e4-235915228ad7'
  )
GROUP BY user_id;

-- STEP 2: Move ALL guest sessions to Farcaster profile
-- ===============================================
UPDATE game_sessions
SET user_id = 'fc:543636'
WHERE 
  user_id = 'guest:aaf208d0-feca-451d-b76e-cbcf84ac1404'
  OR user_id = 'guest:3773fce7-51b6-49b7-a7e4-235915228ad7';

-- STEP 3: Remove duplicate sessions
-- ===============================================
-- Keep only the OLDEST session for each unique (user_id, mode, score, apples_eaten) combination
DELETE FROM game_sessions
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, mode, score, apples_eaten 
        ORDER BY created_at ASC
      ) AS rn
    FROM game_sessions
    WHERE user_id = 'fc:543636'
  ) duplicates
  WHERE rn > 1
);

-- STEP 4: Delete guest profiles
-- ===============================================
DELETE FROM player_profiles
WHERE 
  user_id = 'guest:aaf208d0-feca-451d-b76e-cbcf84ac1404'
  OR user_id = 'guest:3773fce7-51b6-49b7-a7e4-235915228ad7';

-- STEP 5: Verify (AFTER)
-- ===============================================
SELECT 'AFTER MERGE' AS status;

-- Count profiles
SELECT 
  COUNT(*) AS total_profiles,
  COUNT(CASE WHEN user_id LIKE 'guest:%' THEN 1 END) AS guest_profiles,
  COUNT(CASE WHEN user_id = 'fc:543636' THEN 1 END) AS pytek_profiles
FROM player_profiles;

-- Count sessions
SELECT 
  user_id,
  COUNT(*) AS total_sessions,
  COUNT(DISTINCT mode) AS unique_modes,
  MAX(score) AS best_score
FROM game_sessions
WHERE user_id = 'fc:543636'
GROUP BY user_id;

-- Show all your sessions (should be unique now)
SELECT 
  mode,
  score,
  apples_eaten,
  created_at
FROM game_sessions
WHERE user_id = 'fc:543636'
ORDER BY created_at DESC;

-- ===============================================
-- ✅ DONE!
-- ===============================================
-- Now all your sessions are under ONE profile: fc:543636
-- Leaderboard should show ONLY 1 entry for Pytek
-- ===============================================
