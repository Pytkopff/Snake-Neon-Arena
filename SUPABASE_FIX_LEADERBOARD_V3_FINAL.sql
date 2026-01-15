-- ===============================================
-- 🔥 OSTATECZNA NAPRAWA RANKINGU V3
-- ===============================================
-- Problem: LEFT JOINy tworzą kartezjański iloczyn
-- Rozwiązanie: Sumuj każdą tabelę osobno, potem dodaj
-- ===============================================

DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

CREATE VIEW leaderboard_total_apples AS
WITH game_totals AS (
  -- Sumuj jabłka z gier dla każdego gracza
  SELECT 
    LOWER(user_id) as user_id_lower,
    SUM(apples_eaten) as apples_from_games
  FROM game_sessions
  GROUP BY LOWER(user_id)
),
daily_totals AS (
  -- Sumuj jabłka z daily check-in dla każdego gracza
  SELECT 
    LOWER(user_id) as user_id_lower,
    SUM(reward) as apples_from_daily
  FROM daily_claims
  GROUP BY LOWER(user_id)
),
transaction_totals AS (
  -- Sumuj transakcje (wydatki są ujemne) dla każdego gracza
  SELECT 
    LOWER(user_id) as user_id_lower,
    SUM(amount) as apples_from_transactions
  FROM apple_transactions
  GROUP BY LOWER(user_id)
)
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(g.apples_from_games, 0) + 
  COALESCE(d.apples_from_daily, 0) + 
  COALESCE(t.apples_from_transactions, 0) AS total_apples
FROM player_profiles p
LEFT JOIN game_totals g ON LOWER(p.user_id) = g.user_id_lower
LEFT JOIN daily_totals d ON LOWER(p.user_id) = d.user_id_lower
LEFT JOIN transaction_totals t ON LOWER(p.user_id) = t.user_id_lower
WHERE COALESCE(g.apples_from_games, 0) + 
      COALESCE(d.apples_from_daily, 0) + 
      COALESCE(t.apples_from_transactions, 0) >= 0
ORDER BY total_apples DESC;

-- Przyznaj uprawnienia
GRANT SELECT ON leaderboard_total_apples TO anon, authenticated;

-- ===============================
-- ✅ VERIFY
-- ===============================
SELECT 'leaderboard_total_apples' as view_name, COUNT(*) as player_count FROM leaderboard_total_apples;

-- Sprawdź swoje jabłka (zamień fc:543636 na swoje canonical_id)
SELECT 
  canonical_user_id,
  display_name,
  total_apples
FROM leaderboard_total_apples
WHERE canonical_user_id = 'fc:543636';
