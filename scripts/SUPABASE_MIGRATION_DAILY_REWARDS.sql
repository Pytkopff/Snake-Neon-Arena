-- ===============================================
-- 🎁 DAILY REWARDS MIGRATION
-- ===============================================
-- Dodaje tabelę daily_claims i aktualizuje ranking total_apples
-- Execute this in Supabase Dashboard → SQL Editor
-- ===============================================

-- 1️⃣ Nowa tabela do zapisywania daily check-ins
CREATE TABLE IF NOT EXISTS daily_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  reward INTEGER NOT NULL,
  streak_day INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_claims_user ON daily_claims (LOWER(user_id));
CREATE INDEX idx_daily_claims_date ON daily_claims (claimed_at DESC);

-- 2️⃣ (Opcjonalnie) Tabela do śledzenia wydatków jabłek (np. repair streak)
CREATE TABLE IF NOT EXISTS apple_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- dodatnia wartość = zarobek, ujemna = wydatek
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('daily_claim', 'game', 'repair_streak', 'unlock_skin')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_apple_transactions_user ON apple_transactions (LOWER(user_id));

-- 3️⃣ Zaktualizuj widok leaderboard_total_apples
-- Teraz sumuje jabłka z game_sessions + daily_claims + apple_transactions
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
       COALESCE(SUM(at.amount), 0) > 0
ORDER BY total_apples DESC;

-- 4️⃣ Przyznaj uprawnienia
GRANT SELECT, INSERT ON daily_claims TO anon, authenticated;
GRANT SELECT, INSERT ON apple_transactions TO anon, authenticated;
GRANT SELECT ON leaderboard_total_apples TO anon, authenticated;

-- ===============================
-- ✅ VERIFY SETUP
-- ===============================
SELECT 'daily_claims' as table_name, COUNT(*) as row_count FROM daily_claims
UNION ALL
SELECT 'apple_transactions' as table_name, COUNT(*) as row_count FROM apple_transactions
UNION ALL
SELECT 'leaderboard_total_apples' as view_name, COUNT(*) as row_count FROM leaderboard_total_apples;
