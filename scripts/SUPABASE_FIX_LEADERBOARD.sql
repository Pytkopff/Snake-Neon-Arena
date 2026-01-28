-- ===============================================
-- 🔥 NAPRAWA RANKINGU - Usuń ujemne transakcje
-- ===============================================
-- Problem: apple_transactions z ujemnymi wartościami (wydatki)
--          powodują ujemny total_apples i gracze znikają z rankingu
-- Rozwiązanie: Ranking liczy TYLKO zarobione jabłka (bez wydatków)
-- ===============================================

-- 1️⃣ Usuń istniejące ujemne transakcje (opcjonalnie - jeśli chcesz wyczyścić historię)
DELETE FROM apple_transactions WHERE amount < 0;

-- 2️⃣ Zaktualizuj widok rankingu - NIE sumuj apple_transactions
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

CREATE VIEW leaderboard_total_apples AS
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(gs.apples_eaten), 0) + COALESCE(SUM(dc.reward), 0) AS total_apples
FROM player_profiles p
LEFT JOIN game_sessions gs 
  ON LOWER(gs.user_id) = LOWER(p.user_id)
LEFT JOIN daily_claims dc 
  ON LOWER(dc.user_id) = LOWER(p.user_id)
GROUP BY p.canonical_user_id, p.display_name, p.avatar_url
HAVING COALESCE(SUM(gs.apples_eaten), 0) + COALESCE(SUM(dc.reward), 0) > 0
ORDER BY total_apples DESC;

-- 3️⃣ Przyznaj uprawnienia
GRANT SELECT ON leaderboard_total_apples TO anon, authenticated;

-- ===============================
-- ✅ VERIFY
-- ===============================
SELECT 'leaderboard_total_apples' as view_name, COUNT(*) as player_count FROM leaderboard_total_apples;
