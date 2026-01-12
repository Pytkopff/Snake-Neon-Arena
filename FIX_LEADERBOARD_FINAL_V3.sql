-- =============================================================
-- 🔥 FINAL FIX: REMOVE DUPLICATES IN LEADERBOARDS (ALL MODES)
-- =============================================================
-- Problem: The same person appears multiple times (e.g. Farcaster + Wallet + Anonymous)
-- Cause: game_sessions.user_id can be:
--   - Farcaster id (fc:123...)
--   - Wallet address (0xabc...)
--   - Guest/Anonymous (guest:....)
--   And player_profiles can have multiple rows sharing the same wallet_address.
--
-- Goal:
--   1) Map every session to a single wallet_key:
--        - If player_profiles has a wallet_address for that user_id, use it.
--        - Otherwise fallback to the session user_id.
--      Use LOWER() everywhere to avoid case issues.
--   2) Choose the best display name per wallet_key:
--        Farcaster username > display_name > wallet_key
--   3) Aggregate by wallet_key so each person appears once.
--
-- IMPORTANT: Do NOT assume canonical_user_id; we only rely on user_id and wallet_address.
-- All IDs are cast to TEXT and normalized to LOWER().
--
-- Run this script in Supabase SQL Editor.
-- =============================================================

-- Drop existing views
DROP VIEW IF EXISTS leaderboard_classic CASCADE;
DROP VIEW IF EXISTS leaderboard_walls CASCADE;
DROP VIEW IF EXISTS leaderboard_chill CASCADE;
DROP VIEW IF EXISTS leaderboard_total_apples CASCADE;

-- ===============================================
-- Common CTEs for all views
-- ===============================================
-- profiles_norm: normalize profile fields and derive wallet_key
--   wallet_key = LOWER(wallet_address) if present, else LOWER(user_id)
-- best_profile: pick best display name per wallet_key (Farcaster > display_name > wallet_key)
-- sessions_norm: map every game_session row to its wallet_key (via profile match on user_id or wallet_address; fallback to user_id)

-- ===============================================
-- VIEW: Classic (Neon Ranked)
-- ===============================================
CREATE VIEW leaderboard_classic AS
WITH profiles_norm AS (
  SELECT
    LOWER(p.user_id::TEXT)                       AS user_id_norm,
    LOWER(p.wallet_address::TEXT)                AS wallet_addr_norm,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key,
    NULLIF(p.farcaster_username, '')             AS fc_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid,
    p.created_at
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    COALESCE(fc_username, display_name, wallet_key) AS display_name,
    avatar_url
  FROM profiles_norm
  ORDER BY
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
),
sessions_norm AS (
  SELECT
    gs.id,
    gs.mode,
    gs.score,
    gs.apples_eaten,
    gs.created_at,
    -- Map session user_id to wallet_key if profile exists, else fallback to user_id
    COALESCE(p.wallet_key, LOWER(gs.user_id::TEXT)) AS wallet_key
  FROM game_sessions gs
  LEFT JOIN profiles_norm p
    ON LOWER(gs.user_id::TEXT) = p.user_id_norm
    OR LOWER(gs.user_id::TEXT) = p.wallet_addr_norm
)
SELECT
  sn.wallet_key                           AS canonical_user_id,
  COALESCE(bp.display_name, sn.wallet_key) AS display_name,
  bp.avatar_url,
  MAX(sn.score)                           AS score,
  COUNT(DISTINCT sn.id)                   AS games_played
FROM sessions_norm sn
LEFT JOIN best_profile bp ON bp.wallet_key = sn.wallet_key
WHERE sn.mode = 'classic'
GROUP BY sn.wallet_key, COALESCE(bp.display_name, sn.wallet_key), bp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW: Walls (Time Blitz)
-- ===============================================
CREATE VIEW leaderboard_walls AS
WITH profiles_norm AS (
  SELECT
    LOWER(p.user_id::TEXT)                       AS user_id_norm,
    LOWER(p.wallet_address::TEXT)                AS wallet_addr_norm,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key,
    NULLIF(p.farcaster_username, '')             AS fc_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid,
    p.created_at
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    COALESCE(fc_username, display_name, wallet_key) AS display_name,
    avatar_url
  FROM profiles_norm
  ORDER BY
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
),
sessions_norm AS (
  SELECT
    gs.id,
    gs.mode,
    gs.score,
    gs.apples_eaten,
    gs.created_at,
    COALESCE(p.wallet_key, LOWER(gs.user_id::TEXT)) AS wallet_key
  FROM game_sessions gs
  LEFT JOIN profiles_norm p
    ON LOWER(gs.user_id::TEXT) = p.user_id_norm
    OR LOWER(gs.user_id::TEXT) = p.wallet_addr_norm
)
SELECT
  sn.wallet_key                           AS canonical_user_id,
  COALESCE(bp.display_name, sn.wallet_key) AS display_name,
  bp.avatar_url,
  MAX(sn.score)                           AS score,
  COUNT(DISTINCT sn.id)                   AS games_played
FROM sessions_norm sn
LEFT JOIN best_profile bp ON bp.wallet_key = sn.wallet_key
WHERE sn.mode = 'walls'
GROUP BY sn.wallet_key, COALESCE(bp.display_name, sn.wallet_key), bp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW: Chill (Zen Flow)
-- ===============================================
CREATE VIEW leaderboard_chill AS
WITH profiles_norm AS (
  SELECT
    LOWER(p.user_id::TEXT)                       AS user_id_norm,
    LOWER(p.wallet_address::TEXT)                AS wallet_addr_norm,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key,
    NULLIF(p.farcaster_username, '')             AS fc_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid,
    p.created_at
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    COALESCE(fc_username, display_name, wallet_key) AS display_name,
    avatar_url
  FROM profiles_norm
  ORDER BY
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
),
sessions_norm AS (
  SELECT
    gs.id,
    gs.mode,
    gs.score,
    gs.apples_eaten,
    gs.created_at,
    COALESCE(p.wallet_key, LOWER(gs.user_id::TEXT)) AS wallet_key
  FROM game_sessions gs
  LEFT JOIN profiles_norm p
    ON LOWER(gs.user_id::TEXT) = p.user_id_norm
    OR LOWER(gs.user_id::TEXT) = p.wallet_addr_norm
)
SELECT
  sn.wallet_key                           AS canonical_user_id,
  COALESCE(bp.display_name, sn.wallet_key) AS display_name,
  bp.avatar_url,
  MAX(sn.score)                           AS score,
  COUNT(DISTINCT sn.id)                   AS games_played
FROM sessions_norm sn
LEFT JOIN best_profile bp ON bp.wallet_key = sn.wallet_key
WHERE sn.mode = 'chill'
GROUP BY sn.wallet_key, COALESCE(bp.display_name, sn.wallet_key), bp.avatar_url
ORDER BY score DESC
LIMIT 100;

-- ===============================================
-- VIEW: Total Apples (All Modes)
-- ===============================================
CREATE VIEW leaderboard_total_apples AS
WITH profiles_norm AS (
  SELECT
    LOWER(p.user_id::TEXT)                       AS user_id_norm,
    LOWER(p.wallet_address::TEXT)                AS wallet_addr_norm,
    LOWER(COALESCE(p.wallet_address, p.user_id)::TEXT) AS wallet_key,
    NULLIF(p.farcaster_username, '')             AS fc_username,
    p.display_name,
    p.avatar_url,
    p.farcaster_fid,
    p.created_at
  FROM player_profiles p
),
best_profile AS (
  SELECT DISTINCT ON (wallet_key)
    wallet_key,
    COALESCE(fc_username, display_name, wallet_key) AS display_name,
    avatar_url
  FROM profiles_norm
  ORDER BY
    wallet_key,
    CASE WHEN farcaster_fid IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
),
sessions_norm AS (
  SELECT
    gs.id,
    gs.mode,
    gs.score,
    gs.apples_eaten,
    gs.created_at,
    COALESCE(p.wallet_key, LOWER(gs.user_id::TEXT)) AS wallet_key
  FROM game_sessions gs
  LEFT JOIN profiles_norm p
    ON LOWER(gs.user_id::TEXT) = p.user_id_norm
    OR LOWER(gs.user_id::TEXT) = p.wallet_addr_norm
)
SELECT
  sn.wallet_key                           AS canonical_user_id,
  COALESCE(bp.display_name, sn.wallet_key) AS display_name,
  bp.avatar_url,
  SUM(sn.apples_eaten)                    AS total_apples,
  COUNT(DISTINCT sn.id)                   AS games_played
FROM sessions_norm sn
LEFT JOIN best_profile bp ON bp.wallet_key = sn.wallet_key
GROUP BY sn.wallet_key, COALESCE(bp.display_name, sn.wallet_key), bp.avatar_url
ORDER BY total_apples DESC
LIMIT 100;

-- ===============================================
-- ✅ VERIFY RESULTS
-- ===============================================
SELECT 'leaderboard_classic' AS view_name, COUNT(*) AS row_count FROM leaderboard_classic
UNION ALL
SELECT 'leaderboard_walls' AS view_name, COUNT(*) AS row_count FROM leaderboard_walls
UNION ALL
SELECT 'leaderboard_chill' AS view_name, COUNT(*) AS row_count FROM leaderboard_chill
UNION ALL
SELECT 'leaderboard_total_apples' AS view_name, COUNT(*) AS row_count FROM leaderboard_total_apples;

-- ===============================================
-- 📊 CHECK FOR DUPLICATES (Should return 0 rows)
-- ===============================================
SELECT 
  canonical_user_id,
  display_name,
  COUNT(*) AS duplicate_count
FROM leaderboard_classic
GROUP BY canonical_user_id, display_name
HAVING COUNT(*) > 1;

-- ===============================================
-- 📊 SAMPLE DATA (Top 10 Classic)
-- ===============================================
SELECT 
  ROW_NUMBER() OVER (ORDER BY score DESC) AS rank,
  canonical_user_id,
  display_name,
  score,
  games_played
FROM leaderboard_classic
ORDER BY score DESC
LIMIT 10;
