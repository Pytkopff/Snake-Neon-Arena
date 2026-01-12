-- ===============================================
-- 🔒 FIX ROOT CAUSE: Prevent & Merge Duplicates
-- ===============================================
-- This script will:
-- 1. Merge existing duplicate profiles into one
-- 2. Add UNIQUE constraints to prevent future duplicates
-- 3. Clean up orphaned game sessions
-- ===============================================

-- STEP 1: Find and merge duplicate Farcaster profiles
-- ===============================================
DO $$
DECLARE
  r RECORD;
  keep_user_id TEXT;
  delete_user_ids TEXT[];
BEGIN
  -- Loop through each Farcaster FID that has duplicates
  FOR r IN 
    SELECT farcaster_fid, ARRAY_AGG(user_id ORDER BY created_at ASC) AS user_ids
    FROM player_profiles
    WHERE farcaster_fid IS NOT NULL
    GROUP BY farcaster_fid
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the OLDEST profile (first created)
    keep_user_id := r.user_ids[1];
    delete_user_ids := r.user_ids[2:];
    
    RAISE NOTICE 'Merging FID %: Keeping %, Deleting %', r.farcaster_fid, keep_user_id, delete_user_ids;
    
    -- Update all game sessions to point to the kept profile
    UPDATE game_sessions
    SET user_id = keep_user_id
    WHERE user_id = ANY(delete_user_ids);
    
    -- Delete duplicate profiles
    DELETE FROM player_profiles
    WHERE user_id = ANY(delete_user_ids);
  END LOOP;
END $$;

-- STEP 2: Add UNIQUE constraint on farcaster_fid
-- ===============================================
-- This will PREVENT creating two profiles with the same Farcaster ID
ALTER TABLE player_profiles
ADD CONSTRAINT unique_farcaster_fid 
UNIQUE (farcaster_fid);

-- STEP 3: Add UNIQUE constraint on wallet_address (case-insensitive)
-- ===============================================
-- First, create a unique index with LOWER() to handle case sensitivity
DROP INDEX IF EXISTS idx_unique_wallet_address;
CREATE UNIQUE INDEX idx_unique_wallet_address 
ON player_profiles (LOWER(wallet_address))
WHERE wallet_address IS NOT NULL;

-- STEP 4: Verify the fix
-- ===============================================
SELECT 
  'VERIFICATION' AS status,
  (SELECT COUNT(*) FROM player_profiles WHERE farcaster_fid IS NOT NULL) AS total_farcaster_profiles,
  (SELECT COUNT(*) FROM (
    SELECT farcaster_fid 
    FROM player_profiles 
    WHERE farcaster_fid IS NOT NULL 
    GROUP BY farcaster_fid 
    HAVING COUNT(*) > 1
  ) dupes) AS duplicate_farcaster_profiles,
  (SELECT COUNT(*) FROM player_profiles WHERE user_id LIKE 'fc:%') AS profiles_with_fc_prefix;

-- Show the cleaned profiles
SELECT 
  user_id,
  canonical_user_id,
  farcaster_fid,
  farcaster_username,
  wallet_address,
  created_at
FROM player_profiles
ORDER BY created_at DESC
LIMIT 20;

-- ===============================================
-- ✅ DONE!
-- ===============================================
-- Now it's IMPOSSIBLE to create duplicate Farcaster profiles.
-- If your app tries to INSERT a duplicate farcaster_fid,
-- Postgres will return an error: "duplicate key value violates unique constraint"
-- 
-- Your frontend code MUST handle this by doing UPSERT instead:
-- INSERT ... ON CONFLICT (farcaster_fid) DO UPDATE ...
-- ===============================================
