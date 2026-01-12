-- ===============================================
-- 🔧 ADD updated_at COLUMN TO player_profiles
-- ===============================================
-- This fixes the missing column error and adds automatic timestamp tracking
-- Run this in Supabase SQL Editor
-- ===============================================

-- Step 1: Add the updated_at column
ALTER TABLE player_profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Step 2: Set updated_at to created_at for existing rows (if they don't have updated_at)
UPDATE player_profiles 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Step 3: Create a function to automatically update the timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a trigger to call the function on UPDATE
DROP TRIGGER IF EXISTS update_player_profiles_updated_at ON player_profiles;

CREATE TRIGGER update_player_profiles_updated_at
    BEFORE UPDATE ON player_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Verify the column was added
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'player_profiles'
    AND column_name = 'updated_at';

-- Step 6: Test the trigger (optional - uncomment to test)
-- UPDATE player_profiles 
-- SET display_name = display_name 
-- WHERE user_id = (SELECT user_id FROM player_profiles LIMIT 1);

-- SELECT user_id, display_name, created_at, updated_at 
-- FROM player_profiles 
-- ORDER BY updated_at DESC 
-- LIMIT 5;

-- ===============================================
-- ✅ SUCCESS MESSAGE
-- ===============================================
SELECT 'Column updated_at added successfully with auto-update trigger!' AS status;
