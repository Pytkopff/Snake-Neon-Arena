-- ===============================================
-- 🔍 QUICK DIAGNOSTIC - Run this in Supabase SQL Editor
-- ===============================================
-- This will show you exactly what exists in your database

-- 1. Check all views
SELECT 
    schemaname,
    viewname
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname LIKE 'leaderboard%'
ORDER BY viewname;

-- 2. Check if the required views exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'leaderboard_classic') 
        THEN '✅' ELSE '❌' 
    END AS leaderboard_classic,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'leaderboard_walls') 
        THEN '✅' ELSE '❌' 
    END AS leaderboard_walls,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'leaderboard_chill') 
        THEN '✅' ELSE '❌' 
    END AS leaderboard_chill,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'leaderboard_total_apples') 
        THEN '✅' ELSE '❌' 
    END AS leaderboard_total_apples;

-- 3. Check tables
SELECT 
    tablename
FROM pg_tables 
WHERE schemaname = 'public' 
    AND (tablename = 'player_profiles' OR tablename = 'game_sessions')
ORDER BY tablename;

-- 4. Count records
SELECT 
    'player_profiles' AS table_name,
    COUNT(*) AS record_count
FROM player_profiles
UNION ALL
SELECT 
    'game_sessions' AS table_name,
    COUNT(*) AS record_count
FROM game_sessions;
