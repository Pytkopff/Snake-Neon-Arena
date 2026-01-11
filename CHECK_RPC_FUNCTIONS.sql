-- ===============================================
-- 🔍 CHECK IF repair_streak FUNCTION EXISTS
-- ===============================================
-- Run this in Supabase SQL Editor to check if the function exists

SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%repair%'
    OR routine_name LIKE '%streak%';

-- If the above returns empty, the function doesn't exist
-- We need to create it OR rewrite the repair logic to not use RPC
