-- ===============================================
-- 🔎 DIAGNOSE: Why one person shows up 2-3x in leaderboard
-- ===============================================
-- Usage:
-- 1) Set your Farcaster primary user_id (fc:...) and (optional) your wallet address.
-- 2) Run sections A-D and paste results.
-- ===============================================

-- >>> SET THESE:
-- Replace with your values
WITH params AS (
  SELECT
    'fc:543636'::text AS primary_fc_user_id,
    NULL::text AS wallet_user_id -- e.g. '0xc4...8798' lowercased, or keep NULL
)
SELECT * FROM params;

-- ===============================================
-- A) What identities exist in player_profiles for you?
-- ===============================================
WITH params AS (
  SELECT
    'fc:543636'::text AS primary_fc_user_id,
    NULL::text AS wallet_user_id
)
SELECT
  user_id,
  canonical_user_id,
  wallet_address,
  farcaster_fid,
  farcaster_username,
  display_name,
  created_at
FROM player_profiles p, params x
WHERE p.user_id = x.primary_fc_user_id
   OR (x.wallet_user_id IS NOT NULL AND p.user_id = x.wallet_user_id)
   OR (p.wallet_address IS NOT NULL AND x.wallet_user_id IS NOT NULL AND LOWER(p.wallet_address) = LOWER(x.wallet_user_id))
ORDER BY created_at DESC;

-- ===============================================
-- B) Which user_ids in game_sessions map to your wallet/canonical?
--    (this is what creates duplicates in leaderboard views)
-- ===============================================
WITH params AS (
  SELECT
    'fc:543636'::text AS primary_fc_user_id,
    NULL::text AS wallet_user_id
)
SELECT
  gs.user_id,
  COUNT(*) AS sessions,
  MAX(gs.created_at) AS last_seen
FROM game_sessions gs, params x
WHERE gs.user_id = x.primary_fc_user_id
   OR (x.wallet_user_id IS NOT NULL AND gs.user_id = x.wallet_user_id)
   OR gs.user_id LIKE 'guest:%'
GROUP BY gs.user_id
ORDER BY sessions DESC, last_seen DESC
LIMIT 50;

-- ===============================================
-- C) Show suspicious "same score, same mode" duplicates across different user_id
-- ===============================================
SELECT
  mode,
  score,
  COUNT(*) AS rows,
  STRING_AGG(user_id, ', ' ORDER BY user_id) AS user_ids,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM game_sessions
GROUP BY mode, score
HAVING COUNT(*) > 1
ORDER BY last_seen DESC
LIMIT 50;

-- ===============================================
-- D) What does the current leaderboard view contain for your identities?
-- ===============================================
WITH params AS (
  SELECT
    'fc:543636'::text AS primary_fc_user_id
)
SELECT *
FROM leaderboard_classic l, params p
WHERE l.canonical_user_id = p.primary_fc_user_id
   OR l.display_name ILIKE '%pytek%'
ORDER BY score DESC;

