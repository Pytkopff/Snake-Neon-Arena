// ===============================================
// 🔍 SNAKE NEON ARENA - DIAGNOSTIC SCRIPT
// ===============================================
// Uruchom ten skrypt w konsoli przeglądarki (F12)
// aby zdiagnozować problemy z leaderboard
// ===============================================

console.log('🔍 Starting Snake Neon Arena Diagnostics...\n');

// Test 1: Sprawdź czy Supabase działa
console.log('📋 Test 1: Supabase Connection');
try {
  const { supabase } = await import('./src/utils/supabaseClient.js');
  console.log('✅ Supabase client loaded');
  console.log('   URL:', supabase.supabaseUrl || 'Not visible');
} catch (e) {
  console.error('❌ Failed to load Supabase client:', e);
}

// Test 2: Sprawdź tabele
console.log('\n📋 Test 2: Check Tables');
try {
  const { supabase } = await import('./src/utils/supabaseClient.js');
  
  // Sprawdź player_profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('player_profiles')
    .select('*')
    .limit(1);
  
  if (profilesError) {
    console.error('❌ player_profiles error:', profilesError.message);
  } else {
    console.log('✅ player_profiles exists, records:', profiles?.length || 0);
  }
  
  // Sprawdź game_sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('*')
    .limit(1);
  
  if (sessionsError) {
    console.error('❌ game_sessions error:', sessionsError.message);
  } else {
    console.log('✅ game_sessions exists, records:', sessions?.length || 0);
  }
} catch (e) {
  console.error('❌ Table check failed:', e);
}

// Test 3: Sprawdź widoki
console.log('\n📋 Test 3: Check Views');
const views = ['leaderboard_classic', 'leaderboard_walls', 'leaderboard_chill', 'leaderboard_total_apples'];

try {
  const { supabase } = await import('./src/utils/supabaseClient.js');
  
  for (const viewName of views) {
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`❌ ${viewName}:`, error.message);
    } else {
      console.log(`✅ ${viewName}: OK, records:`, data?.length || 0);
    }
  }
} catch (e) {
  console.error('❌ View check failed:', e);
}

// Test 4: Sprawdź dane w tabelach
console.log('\n📋 Test 4: Data Count');
try {
  const { supabase } = await import('./src/utils/supabaseClient.js');
  
  const { count: profileCount } = await supabase
    .from('player_profiles')
    .select('*', { count: 'exact', head: true });
  
  const { count: sessionCount } = await supabase
    .from('game_sessions')
    .select('*', { count: 'exact', head: true });
  
  console.log('📊 Total player_profiles:', profileCount);
  console.log('📊 Total game_sessions:', sessionCount);
  
  if (sessionCount === 0) {
    console.warn('⚠️  No game sessions found! Play a game first.');
  }
} catch (e) {
  console.error('❌ Count check failed:', e);
}

console.log('\n✅ Diagnostics complete!');
