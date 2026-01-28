-- ===============================================
-- 🔥 PRAWIDŁOWA NAPRAWA RANKINGU V2
-- ===============================================
-- Ranking POWINIEN odejmować wydatki (repair streak)
-- Problem był w sprawdzaniu salda (localStorage vs baza)
-- ===============================================

-- 1️⃣ Przywróć sumowanie apple_transactions w rankingu
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

CREATE VIEW leaderboard_total_apples AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(gs.apples_eaten), 0) + 
  COALESCE(SUM(dc.reward), 0) + 
  COALESCE(SUM(at.amount), 0) AS total_apples
FROM player_profiles p
LEFT JOIN game_sessions gs 
  ON LOWER(gs.user_id) = LOWER(p.user_id)
LEFT JOIN daily_claims dc 
  ON LOWER(dc.user_id) = LOWER(p.user_id)
LEFT JOIN apple_transactions at 
  ON LOWER(at.user_id) = LOWER(p.user_id)
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
HAVING COALESCE(SUM(gs.apples_eaten), 0) + 
       COALESCE(SUM(dc.reward), 0) + 
       COALESCE(SUM(at.amount), 0) >= 0
ORDER BY total_apples DESC;

-- 2️⃣ Przyznaj uprawnienia
GRANT SELECT ON leaderboard_total_apples TO anon, authenticated;

-- ===============================
-- ✅ VERIFY
-- ===============================
SELECT 'leaderboard_total_apples' as view_name, COUNT(*) as player_count FROM leaderboard_total_apples;
