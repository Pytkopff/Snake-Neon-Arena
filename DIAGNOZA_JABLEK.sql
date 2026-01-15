-- ===============================================
-- 🔍 DIAGNOZA: Dlaczego jabłka się mnożą?
-- ===============================================
-- Wykonaj te query w Supabase SQL Editor i pokaż mi wyniki
-- ===============================================

-- 1️⃣ Sprawdź ile masz jabłek z każdego źródła
-- Zamień 'TWOJ_CANONICAL_ID' na swoje canonical_user_id (np. fc:123456 lub adres 0x...)

-- SUMA Z GIER
SELECT 
  'game_sessions' as source,
  COUNT(*) as sessions_count,
  SUM(apples_eaten) as total_apples
FROM game_sessions
WHERE LOWER(user_id) = LOWER('TWOJ_CANONICAL_ID');

-- SUMA Z DAILY CLAIMS
SELECT 
  'daily_claims' as source,
  COUNT(*) as claims_count,
  SUM(reward) as total_apples
FROM daily_claims
WHERE LOWER(user_id) = LOWER('TWOJ_CANONICAL_ID');

-- SUMA Z TRANSAKCJI (wydatki)
SELECT 
  'apple_transactions' as source,
  COUNT(*) as transactions_count,
  SUM(amount) as total_amount,
  COUNT(CASE WHEN amount > 0 THEN 1 END) as positive_count,
  COUNT(CASE WHEN amount < 0 THEN 1 END) as negative_count
FROM apple_transactions
WHERE LOWER(user_id) = LOWER('TWOJ_CANONICAL_ID');

-- 2️⃣ Pokaż ostatnie 10 transakcji
SELECT 
  transaction_type,
  amount,
  description,
  created_at
FROM apple_transactions
WHERE LOWER(user_id) = LOWER('TWOJ_CANONICAL_ID')
ORDER BY created_at DESC
LIMIT 10;

-- 3️⃣ Sprawdź czy są duplikaty w daily_claims
SELECT 
  DATE(claimed_at) as claim_date,
  COUNT(*) as claims_on_this_day,
  SUM(reward) as total_reward
FROM daily_claims
WHERE LOWER(user_id) = LOWER('TWOJ_CANONICAL_ID')
GROUP BY DATE(claimed_at)
ORDER BY claim_date DESC
LIMIT 10;

-- 4️⃣ Sprawdź ranking (to powinno być źródło prawdy)
SELECT 
  canonical_user_id,
  display_name,
  total_apples
FROM leaderboard_total_apples
WHERE LOWER(canonical_user_id) = LOWER('TWOJ_CANONICAL_ID');
