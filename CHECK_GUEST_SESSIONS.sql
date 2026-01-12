-- ===============================================
-- 🔍 Check if Guest profiles have your sessions
-- ===============================================

-- Show all sessions for the 3 profiles
SELECT 
  gs.user_id,
  p.display_name,
  p.farcaster_username,
  gs.mode,
  gs.score,
  gs.apples_eaten,
  gs.created_at
FROM game_sessions gs
LEFT JOIN player_profiles p ON gs.user_id = p.user_id
WHERE 
  gs.user_id = 'guest:aaf208d0-feca-451d-b76e-cbcf84ac1404'
  OR gs.user_id = 'fc:543636'
  OR gs.user_id = 'guest:3773fce7-51b6-49b7-a7e4-235915228ad7'
ORDER BY gs.created_at DESC;

-- Count sessions per profile
SELECT 
  gs.user_id,
  p.display_name,
  COUNT(*) AS total_sessions,
  MAX(gs.score) AS best_score
FROM game_sessions gs
LEFT JOIN player_profiles p ON gs.user_id = p.user_id
WHERE 
  gs.user_id = 'guest:aaf208d0-feca-451d-b76e-cbcf84ac1404'
  OR gs.user_id = 'fc:543636'
  OR gs.user_id = 'guest:3773fce7-51b6-49b7-a7e4-235915228ad7'
GROUP BY gs.user_id, p.display_name;
