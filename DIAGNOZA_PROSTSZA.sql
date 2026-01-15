-- ===============================================
-- 🔍 PROSTSZA DIAGNOZA
-- ===============================================
-- Najpierw znajdź swoje canonical_user_id
-- ===============================================

-- 1️⃣ ZNAJDŹ SWÓJ PROFIL (użyj adresu wallet)
-- Zamień '0xc44fD985AC717af0Cb69933FeaEe36aBf1dE8798' na swój adres
SELECT 
  user_id as canonical_id,
  display_name,
  wallet_address,
  farcaster_username
FROM player_profiles
WHERE LOWER(wallet_address) = LOWER('0xc44fD985AC717af0Cb69933FeaEe36aBf1dE8798');

-- 2️⃣ Po znalezieniu canonical_id, użyj go tutaj:
-- Zamień 'fc:123456' lub '0x...' na swoje canonical_id z kroku 1

-- Sprawdź ile masz z gier
SELECT 
  COUNT(*) as total_games,
  SUM(apples_eaten) as total_apples_from_games,
  MAX(created_at) as last_game
FROM game_sessions
WHERE user_id = 'WPISZ_TUTAJ_CANONICAL_ID_Z_KROKU_1';

-- Sprawdź ile masz z daily
SELECT 
  COUNT(*) as total_claims,
  SUM(reward) as total_apples_from_daily,
  MAX(claimed_at) as last_claim
FROM daily_claims
WHERE user_id = 'WPISZ_TUTAJ_CANONICAL_ID_Z_KROKU_1';

-- Sprawdź ranking
SELECT 
  display_name,
  total_apples
FROM leaderboard_total_apples
WHERE canonical_user_id = 'WPISZ_TUTAJ_CANONICAL_ID_Z_KROKU_1';

-- 3️⃣ Pokaż WSZYSTKIE sesje z ostatnich 24h (żeby zobaczyć czy są duplikaty)
SELECT 
  mode,
  score,
  apples_eaten,
  created_at
FROM game_sessions
WHERE user_id = 'WPISZ_TUTAJ_CANONICAL_ID_Z_KROKU_1'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
