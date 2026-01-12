-- ===============================================
-- 🔍 DIAGNOSE: Find my duplicate game sessions
-- ===============================================
-- This will show you ALL game sessions that belong
-- to the same person but have different user_ids

-- Part 1: Show all YOUR profiles (Pytek)
-- ===============================================
SELECT 
  'YOUR PROFILES' AS section,
  user_id,
  canonical_user_id,
  farcaster_fid,
  farcaster_username,
  display_name,
  wallet_address,
  created_at
FROM player_profiles
WHERE 
  farcaster_fid = '543636' 
  OR farcaster_username = 'pytek'
  OR user_id LIKE 'fc:543636%';

-- Part 2: Show all game sessions linked to those profiles
-- ===============================================
SELECT 
  'YOUR GAME SESSIONS' AS section,
  gs.id,
  gs.user_id,
  gs.mode,
  gs.score,
  gs.apples_eaten,
  gs.created_at,
  p.display_name,
  p.farcaster_username
FROM game_sessions gs
LEFT JOIN player_profiles p ON gs.user_id = p.user_id
WHERE 
  gs.user_id IN (
    SELECT user_id FROM player_profiles 
    WHERE farcaster_fid = '543636' 
       OR farcaster_username = 'pytek'
  )
  OR gs.user_id LIKE 'fc:543636%'
ORDER BY gs.created_at DESC;

-- Part 3: Find ALL duplicate Farcaster FIDs
-- ===============================================
SELECT 
  'DUPLICATE FARCASTER ACCOUNTS' AS section,
  farcaster_fid,
  COUNT(*) AS duplicate_count,
  STRING_AGG(user_id, ', ') AS all_user_ids
FROM player_profiles
WHERE farcaster_fid IS NOT NULL
GROUP BY farcaster_fid
HAVING COUNT(*) > 1;

-- Part 4: Show leaderboard with user_id exposed
-- ===============================================
SELECT 
  'CLASSIC LEADERBOARD DEBUG' AS section,
  gs.user_id,
  p.display_name,
  p.farcaster_username,
  MAX(gs.score) AS best_score,
  COUNT(*) AS games_played
FROM game_sessions gs
LEFT JOIN player_profiles p ON gs.user_id = p.user_id
WHERE gs.mode = 'classic'
GROUP BY gs.user_id, p.display_name, p.farcaster_username
ORDER BY best_score DESC
LIMIT 10;
