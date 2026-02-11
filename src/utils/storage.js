// src/utils/storage.js
import { STORAGE_KEYS, SKINS, MISSIONS } from './constants';
// Upewnij się, że plik supabaseClient.js istnieje w tym samym folderze!
import { supabase } from './supabaseClient';
import { generateWalletPseudonym, getDefaultWalletAvatar } from './walletIdentity';

// ==========================================
// 🔥 CROSS-DEVICE SYNC: Fetch from SQL Views
// ==========================================

/**
 * Pobiera najlepsze wyniki gracza bezpośrednio z widoków SQL (leaderboard_*)
 * To jest JEDYNE ŹRÓDŁO PRAWDY dla wyników między urządzeniami
 * @param {string} canonicalId - canonical_user_id gracza
 * @returns {Promise<Object>} - { bestScoreClassic, bestScoreWalls, bestScoreChill, totalApples }
 */
export const fetchBestScoresFromDB = async (canonicalId) => {
  if (!canonicalId) {
    return { bestScoreClassic: 0, bestScoreWalls: 0, bestScoreChill: 0, totalApples: 0 };
  }

  try {
    console.log('🔄 Fetching best scores from DB for:', canonicalId);

    // Pobierz wyniki równolegle z wszystkich widoków
    const [classicResult, wallsResult, chillResult, applesResult] = await Promise.all([
      supabase
        .from('leaderboard_classic')
        .select('score')
        .eq('canonical_user_id', canonicalId)
        .single(),
      supabase
        .from('leaderboard_walls')
        .select('score')
        .eq('canonical_user_id', canonicalId)
        .single(),
      supabase
        .from('leaderboard_chill')
        .select('score')
        .eq('canonical_user_id', canonicalId)
        .single(),
      supabase
        .from('leaderboard_total_apples')
        .select('total_apples')
        .eq('canonical_user_id', canonicalId)
        .single()
    ]);

    const scores = {
      bestScoreClassic: classicResult.data?.score || 0,
      bestScoreWalls: wallsResult.data?.score || 0,
      bestScoreChill: chillResult.data?.score || 0,
      totalApples: applesResult.data?.total_apples || 0
    };

    console.log('✅ DB scores fetched:', scores);
    return scores;
  } catch (error) {
    console.error('❌ Error fetching scores from DB:', error);
    return { bestScoreClassic: 0, bestScoreWalls: 0, bestScoreChill: 0, totalApples: 0 };
  }
};

/**
 * Automatyczne przesyłanie wyższych lokalnych wyników do bazy (Conflict Resolution)
 * Gdy gracz ma wyższy wynik lokalnie (np. po grze offline), automatycznie przesyłamy go do DB
 * @param {string} canonicalId - canonical_user_id gracza
 * @param {Object} localScores - { bestScoreClassic, bestScoreWalls, bestScoreChill }
 * @param {Object} dbScores - { bestScoreClassic, bestScoreWalls, bestScoreChill }
 */
export const syncLocalScoresToDB = async (canonicalId, localScores, dbScores) => {
  if (!canonicalId) return;

  // 🔥 SAFETY: Don't sync local scores if they belong to a different identity
  // This prevents the "Split Personality" bug where old scores leak to a new profile
  const storedCanonicalId = localStorage.getItem('snake_canonical_id');
  if (storedCanonicalId && storedCanonicalId !== canonicalId) {
    console.warn('⚠️ syncLocalScoresToDB: canonical ID mismatch — skipping sync to prevent score contamination');
    console.warn(`   localStorage: ${storedCanonicalId}, target: ${canonicalId}`);
    return;
  }

  try {
    const modesToSync = [];
    
    // Sprawdź, które wyniki lokalne są wyższe
    if (localScores.bestScoreClassic > dbScores.bestScoreClassic) {
      modesToSync.push({ mode: 'classic', score: localScores.bestScoreClassic });
    }
    if (localScores.bestScoreWalls > dbScores.bestScoreWalls) {
      modesToSync.push({ mode: 'walls', score: localScores.bestScoreWalls });
    }
    if (localScores.bestScoreChill > dbScores.bestScoreChill) {
      modesToSync.push({ mode: 'chill', score: localScores.bestScoreChill });
    }

    if (modesToSync.length === 0) {
      console.log('✅ All local scores are synced with DB');
      return;
    }

    console.log('🔄 Syncing higher local scores to DB:', modesToSync);

    // Prześlij wyższe wyniki jako nowe sesje gry (z 0 jabłek, bo nie pamiętamy ile było)
    const sessionsToInsert = modesToSync.map(({ mode, score }) => ({
      user_id: canonicalId,
      mode: mode,
      score: score,
      apples_eaten: 0, // Nie znamy dokładnej liczby jabłek dla starego wyniku
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('game_sessions')
      .insert(sessionsToInsert);

    if (error) {
      console.error('❌ Error syncing local scores to DB:', error);
    } else {
      console.log('✅ Local scores synced to DB successfully');
    }
  } catch (error) {
    console.error('❌ Error in syncLocalScoresToDB:', error);
  }
};

// --- POMOCNICZE LOKALNE (OFFLINE) ---
export const getStorageItem = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}`, error);
    return defaultValue;
  }
};

export const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key}`, error);
  }
};

// ==========================================
// CZĘŚĆ 1: LOGIKA SUPABASE (ONLINE)
// ==========================================

// 1. Inicjalizacja gracza w bazie
export const syncProfile = async (walletAddress) => {
  if (!walletAddress) return null;

  try {
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ wallet_address: walletAddress }])
        .select()
        .single();
      
      if (createError) throw createError;
      profile = newProfile;
      
      await supabase.from('player_stats').insert([{ user_id: profile.id }]);
    }
    return profile;
  } catch (err) {
    console.error('Supabase Profile Sync Error:', err);
    return null;
  }
};

// 2. Pobieranie statystyk
// src/utils/storage.js

export const getPlayerStats = async (walletAddress, canonicalId = null) => {
  // 1. Pobieramy wyniki lokalne (Offline) - to będzie fallback
  const localBestClassic = getStorageItem(STORAGE_KEYS.BEST_SCORE, 0);
  const localBestWalls = getStorageItem('snake_best_score_walls', 0);
  const localBestChill = getStorageItem('snake_best_score_chill', 0);
  // 🍎 Apples balance model:
  // - STORAGE_KEYS.TOTAL_APPLES: current spendable balance (can go down)
  // - snake_total_apples_gross: monotonic "earned" counter used for cross-device max() (never goes down)
  // - snake_apples_spent: monotonic "spent" counter (never goes down)
  const localAppleBalance = getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0);
  const localAppleGross = getStorageItem('snake_total_apples_gross', localAppleBalance);
  const localApplesSpent = getStorageItem('snake_apples_spent', 0);

  // 2. Budujemy obiekt statystyk (startujemy z lokalnych wartości)
  let stats = {
    totalApples: Math.max(0, Number(localAppleBalance) || 0),
    totalGames: getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0),
    bestScore: Math.max(localBestClassic, localBestWalls, localBestChill),
    
    // 🔥 TE TRZY POLA SĄ KLUCZOWE DLA MISJI:
    bestScoreClassic: localBestClassic,
    bestScoreWalls: localBestWalls,
    bestScoreChill: localBestChill
  };

  // 3. Logika Online (Supabase) - NOWY SYSTEM
  // Priorytet: canonicalId > walletAddress
  let targetCanonicalId = canonicalId;
  
  try {
    // A. Jeśli mamy canonicalId, użyj go bezpośrednio
    if (targetCanonicalId) {
      console.log('📊 Using canonicalId directly:', targetCanonicalId);
      
      // 🔥 FETCH BEST SCORES FROM SQL VIEWS (CROSS-DEVICE SYNC)
      const dbScores = await fetchBestScoresFromDB(targetCanonicalId);
      
      // Pobierz liczbę gier
      const { count, error: countError } = await supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetCanonicalId);
      
      if (countError) {
        console.error('Error counting games from game_sessions:', countError);
      }
      
      const gameCount = count !== null ? count : 0;
      
      // 🔥 CONFLICT RESOLUTION: Porównaj lokalne wyniki z bazą
      // Jeśli lokalne wyniki są WYŻSZE niż w bazie, automatycznie prześlij je w tle
      const localScores = {
        bestScoreClassic: localBestClassic,
        bestScoreWalls: localBestWalls,
        bestScoreChill: localBestChill
      };
      
      // Automatycznie synchronizuj wyższe lokalne wyniki do bazy (w tle, nie czekaj)
      syncLocalScoresToDB(targetCanonicalId, localScores, dbScores).catch(err => 
        console.error('Background sync failed:', err)
      );
      
      // 🔥 NOWE: Dla zalogowanych użytkowników, BAZA jest źródłem prawdy
      // Używamy max() tylko dla scores (żeby nie stracić offline progress)
      // Ale dla jabłek używamy TYLKO bazy (bo ranking liczy z bazy)
      const resolvedScores = {
        bestScoreClassic: Math.max(localBestClassic, dbScores.bestScoreClassic),
        bestScoreWalls: Math.max(localBestWalls, dbScores.bestScoreWalls),
        bestScoreChill: Math.max(localBestChill, dbScores.bestScoreChill),
        totalApplesGross: dbScores.totalApples  // ✅ Użyj TYLKO bazy (nie max!)
      };
      
      const resolvedApplesSpent = 0;  // ✅ Reset spent (wydatki są w apple_transactions w bazie)
      const resolvedAppleBalance = Math.max(0, Number(dbScores.totalApples) || 0);  // ✅ Bezpośrednio z bazy
      
      // 🔥 Zapisz rozwiązane wartości do localStorage (NADPISZ starymi danymi z bazy)
      setStorageItem(STORAGE_KEYS.BEST_SCORE, resolvedScores.bestScoreClassic);
      setStorageItem('snake_best_score_walls', resolvedScores.bestScoreWalls);
      setStorageItem('snake_best_score_chill', resolvedScores.bestScoreChill);
      setStorageItem('snake_total_apples_gross', resolvedScores.totalApplesGross);  // Baza = prawda
      setStorageItem('snake_apples_spent', 0);  // Reset (wydatki są w bazie)
      setStorageItem(STORAGE_KEYS.TOTAL_APPLES, resolvedAppleBalance);  // Baza = prawda
      setStorageItem(STORAGE_KEYS.TOTAL_GAMES, gameCount);
      
      console.log('✅ Resolved scores (local vs DB):', {
        classic: { local: localBestClassic, db: dbScores.bestScoreClassic, resolved: resolvedScores.bestScoreClassic },
        walls: { local: localBestWalls, db: dbScores.bestScoreWalls, resolved: resolvedScores.bestScoreWalls },
        chill: { local: localBestChill, db: dbScores.bestScoreChill, resolved: resolvedScores.bestScoreChill },
        apples: { local: localAppleGross, db: dbScores.totalApples, gross: resolvedScores.totalApplesGross, spent: resolvedApplesSpent, balance: resolvedAppleBalance }
      });
      
      stats = {
        totalApples: resolvedAppleBalance,
        totalGames: gameCount,
        bestScore: Math.max(resolvedScores.bestScoreClassic, resolvedScores.bestScoreWalls, resolvedScores.bestScoreChill),
        bestScoreClassic: resolvedScores.bestScoreClassic,
        bestScoreWalls: resolvedScores.bestScoreWalls,
        bestScoreChill: resolvedScores.bestScoreChill
      };
      
      return stats;
    }
    
    // B. Jeśli nie ma canonicalId, próbuj znaleźć przez walletAddress
    if (walletAddress) {
      const { data: newProfile } = await supabase
        .from('player_profiles')
        .select('canonical_user_id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();
      
      if (newProfile) {
        console.log('📊 Found new profile by wallet:', newProfile);
        targetCanonicalId = newProfile.canonical_user_id;
        
        // 🔥 FETCH BEST SCORES FROM SQL VIEWS (CROSS-DEVICE SYNC)
        const dbScores = await fetchBestScoresFromDB(targetCanonicalId);
        
        // Pobierz liczbę gier
        const { count, error: countError } = await supabase
          .from('game_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetCanonicalId);
        
        if (countError) {
          console.error('Error counting games from game_sessions:', countError);
        }
        
        const gameCount = count !== null ? count : 0;
        
        // 🔥 CONFLICT RESOLUTION: Porównaj lokalne wyniki z bazą
        const localScores = {
          bestScoreClassic: localBestClassic,
          bestScoreWalls: localBestWalls,
          bestScoreChill: localBestChill
        };
        
        // Automatycznie synchronizuj wyższe lokalne wyniki do bazy (w tle, nie czekaj)
        syncLocalScoresToDB(targetCanonicalId, localScores, dbScores).catch(err => 
          console.error('Background sync failed:', err)
        );
        
        // 🔥 NOWE: Dla zalogowanych, BAZA jest źródłem prawdy dla jabłek
        const resolvedScores = {
          bestScoreClassic: Math.max(localBestClassic, dbScores.bestScoreClassic),
          bestScoreWalls: Math.max(localBestWalls, dbScores.bestScoreWalls),
          bestScoreChill: Math.max(localBestChill, dbScores.bestScoreChill),
          totalApplesGross: dbScores.totalApples  // ✅ Użyj TYLKO bazy (nie max!)
        };
        
        const resolvedApplesSpent = 0;  // ✅ Reset spent (wydatki są w bazie)
        const resolvedAppleBalance = Math.max(0, Number(dbScores.totalApples) || 0);  // ✅ Bezpośrednio z bazy
        
        // Zapisz rozwiązane wartości do localStorage (NADPISZ starymi danymi z bazy)
        setStorageItem(STORAGE_KEYS.BEST_SCORE, resolvedScores.bestScoreClassic);
        setStorageItem('snake_best_score_walls', resolvedScores.bestScoreWalls);
        setStorageItem('snake_best_score_chill', resolvedScores.bestScoreChill);
        setStorageItem('snake_total_apples_gross', resolvedScores.totalApplesGross);
        setStorageItem('snake_apples_spent', 0);  // Reset spent
        setStorageItem(STORAGE_KEYS.TOTAL_APPLES, resolvedAppleBalance);
        setStorageItem(STORAGE_KEYS.TOTAL_GAMES, gameCount);
        
        console.log('✅ Resolved scores (local vs DB):', {
          classic: { local: localBestClassic, db: dbScores.bestScoreClassic, resolved: resolvedScores.bestScoreClassic },
          walls: { local: localBestWalls, db: dbScores.bestScoreWalls, resolved: resolvedScores.bestScoreWalls },
          chill: { local: localBestChill, db: dbScores.bestScoreChill, resolved: resolvedScores.bestScoreChill },
          apples: { local: localAppleGross, db: dbScores.totalApples, gross: resolvedScores.totalApplesGross, spent: resolvedApplesSpent, balance: resolvedAppleBalance }
        });
        
        stats = {
          totalApples: resolvedAppleBalance,
          totalGames: gameCount,
          bestScore: Math.max(resolvedScores.bestScoreClassic, resolvedScores.bestScoreWalls, resolvedScores.bestScoreChill),
          bestScoreClassic: resolvedScores.bestScoreClassic,
          bestScoreWalls: resolvedScores.bestScoreWalls,
          bestScoreChill: resolvedScores.bestScoreChill
        };
        
        return stats;
      }
      
      // C. Fallback: stary system (dla backward compatibility)
      const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();
      if (profile) {
        const { data: dbStats } = await supabase.from('player_stats').select('*').eq('user_id', profile.id).single();
        
        if (dbStats) {
          // Jeśli mamy dane z chmury, nadpisujemy lokalne
          // Fallback: traktuj total_apples_eaten jako "gross" i odlicz lokalne wydatki
          const spent = Math.max(0, Number(getStorageItem('snake_apples_spent', 0)) || 0);
          const gross = Math.max(0, Number(dbStats.total_apples_eaten) || 0);
          setStorageItem('snake_total_apples_gross', gross);
          setStorageItem(STORAGE_KEYS.TOTAL_APPLES, Math.max(0, gross - spent));
          setStorageItem(STORAGE_KEYS.TOTAL_GAMES, dbStats.total_games_played);
          
          stats = {
              totalApples: Math.max(0, gross - spent),
              totalGames: dbStats.total_games_played,
              // Ogólny
              bestScore: Math.max(dbStats.highest_score_classic, dbStats.highest_score_walls, dbStats.highest_score_chill),
              // Szczegółowe
              bestScoreClassic: dbStats.highest_score_classic,
              bestScoreWalls: dbStats.highest_score_walls,
              bestScoreChill: dbStats.highest_score_chill
          };
        }
      }
    }
  } catch (e) {
    console.error("Error syncing stats:", e);
  }
  
  return stats;
};

// 3. Aktualizacja statystyk
// src/utils/storage.js

export const updatePlayerStats = async (applesInGame, score, walletAddress, mode = 'classic') => {
  // Aktualizujemy best score lokalnie
  updateBestScore(score, mode);
  
  // 🔥 NOWE: Aktualizuj gross dla WSZYSTKICH (goście + zalogowani)
  // To jest potrzebne, żeby getPlayerStats() miało aktualne dane do max(local, db)
  const currentGross = Math.max(0, Number(getStorageItem('snake_total_apples_gross', 0)) || 0);
  const currentSpent = Math.max(0, Number(getStorageItem('snake_apples_spent', 0)) || 0);
  const newGross = currentGross + applesInGame;
  const newBalance = Math.max(0, newGross - currentSpent);
  
  setStorageItem('snake_total_apples_gross', newGross);
  setStorageItem(STORAGE_KEYS.TOTAL_APPLES, newBalance);
  
  // Dla gości aktualizujemy też total games
  if (!walletAddress) {
    const currentTotalGames = getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0);
    setStorageItem(STORAGE_KEYS.TOTAL_GAMES, currentTotalGames + 1);
  } 

  // ❌ USUNIĘTE: Stary system RPC increment_apples - nie używamy już tego
  // Jabłka są zapisywane przez saveGameSession do game_sessions (nowy system)
  // Statystyki będą pobierane przez getPlayerStats z game_sessions
  
  // Zwracamy statystyki (dla gości z localStorage, dla zalogowanych z bazy)
  if (!walletAddress) {
    return {
      totalApples: getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0),
      totalGames: getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0),
      bestScore: Math.max(
        getStorageItem(STORAGE_KEYS.BEST_SCORE, 0),
        getStorageItem('snake_best_score_walls', 0),
        getStorageItem('snake_best_score_chill', 0)
      ),
      bestScoreClassic: getStorageItem(STORAGE_KEYS.BEST_SCORE, 0),
      bestScoreWalls: getStorageItem('snake_best_score_walls', 0),
      bestScoreChill: getStorageItem('snake_best_score_chill', 0)
    };
  }
  
  // Dla zalogowanych użytkowników statystyki będą pobrane przez getPlayerStats w App.jsx
  // Zwracamy tylko best scores (jabłka i gry będą z bazy)
  return {
    totalApples: getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0), // Tymczasowo, będzie nadpisane przez getPlayerStats
    totalGames: getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0), // Tymczasowo, będzie nadpisane przez getPlayerStats
    bestScore: Math.max(
      getStorageItem(STORAGE_KEYS.BEST_SCORE, 0),
      getStorageItem('snake_best_score_walls', 0),
      getStorageItem('snake_best_score_chill', 0)
    ),
    bestScoreClassic: getStorageItem(STORAGE_KEYS.BEST_SCORE, 0),
    bestScoreWalls: getStorageItem('snake_best_score_walls', 0),
    bestScoreChill: getStorageItem('snake_best_score_chill', 0)
  };
};

// 4. Skiny
export const unlockSkinOnServer = async (skinId, walletAddress) => {
  if (!walletAddress) return;
  try {
    const walletAddressLower = walletAddress.toLowerCase();
    // Najpierw znajdź lub utwórz profil
    let { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddressLower).single();
    
    // Jeśli nie ma profilu, utwórz go
    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ wallet_address: walletAddressLower }])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating profile for skin unlock:', createError);
        return;
      }
      profile = newProfile;
    }
    
    // Sprawdź czy skin już nie jest odblokowany (unikaj duplikatów)
    const { data: existing } = await supabase
      .from('unlocked_skins')
      .select('id')
      .eq('user_id', profile.id)
      .eq('skin_id', skinId)
      .single();
    
    if (existing) {
      console.log(`Skin ${skinId} already unlocked for user ${profile.id}`);
      return;
    }
    
    // Odblokuj skin
    const { error: insertError } = await supabase
      .from('unlocked_skins')
      .insert([{ user_id: profile.id, skin_id: skinId }]);
    
    if (insertError) {
      console.error('Error unlocking skin:', insertError);
    } else {
      console.log(`✅ Skin ${skinId} unlocked successfully for user ${profile.id}`);
    }
  } catch (err) {
    console.error('Error in unlockSkinOnServer:', err);
  }
};

export const getUnlockedSkins = async (walletAddress) => {
  // 1. Pobieramy to, co jest w przeglądarce (to może być błędne "6/6")
  let localSkins = getStorageItem(STORAGE_KEYS.UNLOCKED_SKINS, ['default']);

  // 2. Jeśli gracz NIE JEST zalogowany -> wierzymy przeglądarce
  if (!walletAddress) return localSkins;

  // 3. Jeśli JEST zalogowany -> Baza Danych jest szeryfem 🤠
  try {
    const walletAddressLower = walletAddress.toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddressLower).single();

    if (profile) {
      const { data: unlocked } = await supabase.from('unlocked_skins').select('skin_id').eq('user_id', profile.id);
      
      if (unlocked) {
        // Jeśli baza zwraca 0 skinów, a lokalnie mamy więcej -> nie nadpisuj (fallback)
        if (unlocked.length === 0 && localSkins.length > 1) {
          return localSkins;
        }
        // Robimy listę skinów z bazy
        const dbSkins = unlocked.map(u => u.skin_id);
        
        // Upewniamy się, że 'default' zawsze tam jest
        if (!dbSkins.includes('default')) dbSkins.push('default');

        // 🔥 NAPRAWA BŁĘDU:
        // Ignorujemy to, co było w localSkins (te 6/6) i NADPISUJEMY je stanem z bazy.
        // Dzięki temu "czysty" portfel automatycznie wyczyści "brudną" przeglądarkę.
        setStorageItem(STORAGE_KEYS.UNLOCKED_SKINS, dbSkins);
        
        return dbSkins;
      }
    }
  } catch (error) {
    console.error('Error syncing skins:', error);
  }

  // Fallback (gdyby baza nie odpowiedziała)
  return localSkins;
};

// Helpery
export const getSelectedSkin = () => getStorageItem(STORAGE_KEYS.SELECTED_SKIN, 'default');
export const setSelectedSkin = (skinId) => setStorageItem(STORAGE_KEYS.SELECTED_SKIN, skinId);

// ... (reszta kodu wyżej bez zmian)

export const checkUnlocks = async (stats, walletAddress) => {
  const unlocked = await getUnlockedSkins(walletAddress);
  const newUnlocks = [];

  MISSIONS.forEach(mission => {
    if (mission.rewardType === 'skin' && unlocked.includes(mission.rewardId)) return;

    let isCompleted = false;

    // --- PROSTE MISJE (Ogólne) ---
    if (mission.type === 'games' && stats.totalGames >= mission.target) isCompleted = true;
    if (mission.type === 'apples' && stats.totalApples >= mission.target) isCompleted = true;
    
    // --- MISJE NA WYNIK (Z uwzględnieniem trybu!) ---
    if (mission.type === 'score') {
        let scoreToCheck = 0;
        
        // Jeśli misja wymaga konkretnego trybu, sprawdzamy tylko ten wynik
        if (mission.mode === 'classic') scoreToCheck = stats.bestScoreClassic;
        else if (mission.mode === 'walls') scoreToCheck = stats.bestScoreWalls;
        else if (mission.mode === 'chill') scoreToCheck = stats.bestScoreChill;
        // Jeśli nie podano trybu, bierzemy najlepszy ogólny (dla prostych misji)
        else scoreToCheck = stats.bestScore;

        if (scoreToCheck >= mission.target) isCompleted = true;
    }

    if (isCompleted) {
      if (mission.rewardType === 'skin') {
         const skinName = SKINS.find(s => s.id === mission.rewardId)?.name || 'Unknown Skin';
         newUnlocks.push(skinName);
         
         const updatedLocal = [...unlocked, mission.rewardId];
         setStorageItem(STORAGE_KEYS.UNLOCKED_SKINS, updatedLocal);
         unlockSkinOnServer(mission.rewardId, walletAddress);
      }
    }
  });
  
  return newUnlocks;
};

// ==========================================
// CZĘŚĆ 2: KOMPATYBILNOŚĆ Z LEADERBOARD (To naprawia błąd!)
// ==========================================

const MODE_KEYS = {
  'classic': STORAGE_KEYS.BEST_SCORE,
  'walls': 'snake_best_score_walls',
  'chill': 'snake_best_score_chill'
};

export const getBestScore = (mode = 'classic') => {
  const key = MODE_KEYS[mode] || STORAGE_KEYS.BEST_SCORE;
  return getStorageItem(key, 0);
};

export const updateBestScore = (score, mode = 'classic') => {
  const key = MODE_KEYS[mode] || STORAGE_KEYS.BEST_SCORE;
  const current = getStorageItem(key, 0);
  if (score > current) {
    setStorageItem(key, score);
    return true;
  }
  return false;
};

const addLocalScore = (key, score, name) => {
  const list = getStorageItem(key, []);
  const entry = { score, name, date: new Date().toISOString() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score); 
  const top10 = list.slice(0, 10); 
  setStorageItem(key, top10);
};

export const getLeaderboard = () => getStorageItem(STORAGE_KEYS.LEADERBOARD, []);
export const getLeaderboard60s = () => getStorageItem(STORAGE_KEYS.LEADERBOARD_60S, []);
export const getLeaderboardChill = () => getStorageItem(STORAGE_KEYS.LEADERBOARD_CHILL, []);

export const addToLeaderboard = (score, name) => addLocalScore(STORAGE_KEYS.LEADERBOARD, score, name);
export const addToLeaderboard_Local = addToLeaderboard;

export const addToLeaderboard60s = (score, name) => addLocalScore(STORAGE_KEYS.LEADERBOARD_60S, score, name);
export const addToLeaderboard60s_Local = addToLeaderboard60s;

export const addToLeaderboardChill = (score, name) => addLocalScore(STORAGE_KEYS.LEADERBOARD_CHILL, score, name);
export const addToLeaderboardChill_Local = addToLeaderboardChill;

export const clearLeaderboard = (keyName) => {
    let storageKey = keyName;
    if (keyName === 'snake_leaderboard') storageKey = STORAGE_KEYS.LEADERBOARD;
    else if (keyName === 'snake_leaderboard_60s') storageKey = STORAGE_KEYS.LEADERBOARD_60S;
    else if (keyName === 'snake_leaderboard_chill') storageKey = STORAGE_KEYS.LEADERBOARD_CHILL;
    
    try {
        localStorage.removeItem(storageKey);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// ==========================================
// NOWY SYSTEM LEADERBOARD (TEXT-based Identity)
// ==========================================

/**
 * Synchronizuje profil gracza z priorytetem: Farcaster > Wallet > Guest
 * @param {Object} identity - { farcasterFid, walletAddress, guestId, username, avatarUrl }
 * @returns {Promise<string>} - canonical_user_id gracza
 */
export const syncPlayerProfile = async (identity) => {
  const { farcasterFid, walletAddress, guestId, previousGuestId, username, avatarUrl, displayName: identityDisplayName } = identity;
  
  // 1. Określ user_id i canonical_user_id (priorytet)
  let userId, canonicalUserId, displayName, defaultAvatar;
  
  if (farcasterFid) {
    userId = `fc:${farcasterFid}`;
    canonicalUserId = `fc:${farcasterFid}`;
    displayName = username || identityDisplayName || `Player_${farcasterFid}`;
    defaultAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fc${farcasterFid}&backgroundColor=0a0e27`;
  } else if (walletAddress) {
    userId = walletAddress.toLowerCase();
    canonicalUserId = walletAddress.toLowerCase();
    displayName = identityDisplayName || generateWalletPseudonym(walletAddress);
    defaultAvatar = avatarUrl || getDefaultWalletAvatar(walletAddress);
  } else if (guestId) {
    userId = `guest:${guestId}`;
    canonicalUserId = `guest:${guestId}`;
    displayName = 'Guest Player';
    defaultAvatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${guestId}&backgroundColor=0a0e27`;
  } else {
    console.error('syncPlayerProfile: No identity provided');
    return null;
  }

  try {
    console.log('🔄 syncPlayerProfile called with:', { farcasterFid, walletAddress, guestId, username });
    
    // 🔥 MERGE STRATEGY: Prevent "Split Personality" Bug
    // If user has BOTH Farcaster AND Wallet, merge them into ONE profile
    
    // 2A. Sprawdź czy istnieje profil Farcaster (priorytet najwyższy)
    if (farcasterFid && walletAddress) {
      console.log('🔄 User has both Farcaster AND Wallet - checking for merge...');
      
      const { data: fcProfile } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('user_id', `fc:${farcasterFid}`)
        .single();
      
      if (fcProfile) {
        // Farcaster profil już istnieje - UPDATE z wallet_address
        console.log('✅ Found existing Farcaster profile - updating with wallet');
        await supabase
          .from('player_profiles')
          .update({
            wallet_address: walletAddress.toLowerCase(),
            display_name: displayName,
            avatar_url: avatarUrl || fcProfile.avatar_url,
            farcaster_username: username || fcProfile.farcaster_username,
          })
          .eq('user_id', `fc:${farcasterFid}`);
        
        // 🔥 FIX: Usuń WSZYSTKIE duplikaty dla tego wallet_address (nie tylko exact match)
        const { data: duplicates } = await supabase
          .from('player_profiles')
          .select('user_id')
          .eq('wallet_address', walletAddress.toLowerCase())
          .neq('user_id', `fc:${farcasterFid}`);
        
        if (duplicates && duplicates.length > 0) {
          console.log('🗑️ Removing duplicate profiles:', duplicates.map(d => d.user_id));
          
          // Przenieś sesje gry ze starych profili do Farcaster profilu
          for (const dup of duplicates) {
            await supabase
              .from('game_sessions')
              .update({ user_id: `fc:${farcasterFid}` })
              .eq('user_id', dup.user_id);
          }
          
          // Teraz usuń duplikaty
          await supabase
            .from('player_profiles')
            .delete()
            .eq('wallet_address', walletAddress.toLowerCase())
            .neq('user_id', `fc:${farcasterFid}`);
        }
        
        // 🔥 Jeśli wcześniej na tym urządzeniu był guest, też go scalamy do konta FC
        if (previousGuestId) {
          const guestUserId = `guest:${previousGuestId}`;
          await supabase
            .from('game_sessions')
            .update({ user_id: `fc:${farcasterFid}` })
            .eq('user_id', guestUserId);
          
          await supabase
            .from('player_profiles')
            .delete()
            .eq('user_id', guestUserId);
        }

        console.log('✅ Merged wallet (and possible guest) into Farcaster profile');
        return fcProfile.canonical_user_id;
      }
      
      // Sprawdź czy istnieje profil wallet-only
      const { data: walletProfile } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('user_id', walletAddress.toLowerCase())
        .single();
      
      if (walletProfile) {
        // Wallet profil istnieje - UPDATE z Farcaster info
        console.log('✅ Found existing Wallet profile - upgrading to Farcaster');
        // Najpierw przenieś sesje z wallet user_id -> fc user_id (bo zaraz zmienimy user_id w profilu)
        await supabase
          .from('game_sessions')
          .update({ user_id: userId })
          .eq('user_id', walletAddress.toLowerCase());

        await supabase
          .from('player_profiles')
          .update({
            user_id: userId, // Zmień na fc:XXX
            canonical_user_id: canonicalUserId, // Zmień na fc:XXX
            farcaster_fid: farcasterFid,
            farcaster_username: username,
            display_name: displayName,
            avatar_url: avatarUrl || walletProfile.avatar_url,
          })
          .eq('user_id', walletAddress.toLowerCase());
        
        // 🔥 Jeśli wcześniej na tym urządzeniu był guest, też go scalamy do konta FC
        if (previousGuestId) {
          const guestUserId = `guest:${previousGuestId}`;
          await supabase
            .from('game_sessions')
            .update({ user_id: userId })
            .eq('user_id', guestUserId);
          
          await supabase
            .from('player_profiles')
            .delete()
            .eq('user_id', guestUserId);
        }
        
        console.log('✅ Upgraded wallet profile to Farcaster');
        return canonicalUserId;
      }
    }
    
    // 2B. Sprawdź czy profil już istnieje (standard flow)
    const { data: existing } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Profil istnieje - zaktualizuj dane jeśli są nowsze
      await supabase
        .from('player_profiles')
        .update({
          wallet_address: walletAddress ? walletAddress.toLowerCase() : existing.wallet_address,
          display_name: displayName,
          avatar_url: avatarUrl || existing.avatar_url,
          farcaster_username: username || existing.farcaster_username,
        })
        .eq('user_id', userId);
      
      // 🔥 Jeśli user się zalogował, a wcześniej był guest na tym urządzeniu – przenieś sesje guest -> to konto
      if (previousGuestId && (farcasterFid || walletAddress)) {
        const guestUserId = `guest:${previousGuestId}`;
        await supabase
          .from('game_sessions')
          .update({ user_id: userId })
          .eq('user_id', guestUserId);
        
        await supabase
          .from('player_profiles')
          .delete()
          .eq('user_id', guestUserId);
      }
      
      return existing.canonical_user_id;
    }

    // 3. Sprawdź czy istnieje profil Farcaster dla tego portfela (merge logic - backward compat)
    if (walletAddress && !farcasterFid) {
      const { data: fcProfile } = await supabase
        .from('player_profiles')
        .select('canonical_user_id, farcaster_fid')
        .eq('wallet_address', walletAddress.toLowerCase())
        .not('farcaster_fid', 'is', null)
        .single();
      
      if (fcProfile) {
        // Użytkownik ma już konto Farcaster - nie twórz nowego, zwróć istniejący
        console.log('✅ Wallet matches existing Farcaster account');
        return fcProfile.canonical_user_id;
      }
    }

    // 4. Stwórz nowy profil (tylko jeśli żaden nie istnieje)
    console.log('📝 Creating new profile:', { userId, canonicalUserId });
    const { error: insertError } = await supabase
      .from('player_profiles')
      .insert({
        user_id: userId,
        canonical_user_id: canonicalUserId,
        farcaster_fid: farcasterFid || null,
        farcaster_username: username || null,
        wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
        display_name: displayName,
        avatar_url: avatarUrl || defaultAvatar,
      });

    if (insertError) throw insertError;

    // 🔥 Jeśli właśnie tworzymy konto zalogowane, a wcześniej był guest na tym urządzeniu – przenieś sesje guest -> to konto
    if (previousGuestId && (farcasterFid || walletAddress)) {
      const guestUserId = `guest:${previousGuestId}`;
      await supabase
        .from('game_sessions')
        .update({ user_id: userId })
        .eq('user_id', guestUserId);
      
      await supabase
        .from('player_profiles')
        .delete()
        .eq('user_id', guestUserId);
    }
    
    console.log('✅ Player profile synced:', { userId, canonicalUserId });
    return canonicalUserId;
  } catch (error) {
    console.error('syncPlayerProfile error:', error);
    return null;
  }
};

/**
 * Zapisuje sesję gry do bazy danych
 * @param {Object} session - { userId, mode, score, applesEaten }
 */
export const saveGameSession = async (session) => {
  const { userId, mode, score, applesEaten } = session;
  
  console.log('🎮 Attempting to save game session:', { userId, mode, score, applesEaten });
  
  if (!userId || !mode || score === undefined) {
    console.error('❌ saveGameSession: Missing required fields', session);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id: userId,
        mode: mode,
        score: score,
        apples_eaten: applesEaten || 0,
      })
      .select(); // Dodajemy .select() aby zobaczyć co zostało zapisane

    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw error;
    }
    
    console.log('✅ Game session saved to DB:', data);
    
    // ❌ USUNIĘTE: Nie aktualizujemy localStorage tutaj, bo to powoduje podwójne zliczanie
    // localStorage będzie zaktualizowany przez getPlayerStats() który sumuje z game_sessions
    
  } catch (error) {
    console.error('❌ saveGameSession error:', error);
  }
};

// ==========================================
// DAILY CHECK-IN SYSTEM 📅 (Wklej na końcu pliku storage.js)
// ==========================================

export const DAILY_REWARDS = [50, 100, 150, 200, 250, 300, 1000]; // Dzień 7 = 1000!

// Pomocnik: Czy data to "dzisiaj"?
const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

// Pomocnik: Czy data to "wczoraj"?
const isYesterday = (d1, d2) => {
  const yesterday = new Date(d1);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(yesterday, d2);
};

export const getDailyStatus = async (walletAddress) => {
  // Domyślny stan (dla nowego gracza)
  let status = {
    streak: 0,
    lastClaim: null,
    canClaim: true,
    isMissed: false, // Czy stracił passę?
    nextReward: DAILY_REWARDS[0],
    dayIndex: 0
  };

  // 🔥 NOWY SYSTEM: Używamy TYLKO localStorage dla Daily Check-in (dla wszystkich użytkowników)
  // Streak jest lokalną funkcją i nie musi być w bazie danych
  const local = getStorageItem('snake_daily_status', null);
  if (local) {
    status.streak = local.streak;
    status.lastClaim = local.lastClaim;
    console.log('📅 Daily status from localStorage:', local);
  }

  // 3. Logika czasu (Co wyświetlić?)
  if (status.lastClaim) {
    const lastDate = new Date(status.lastClaim);
    const today = new Date();

    if (isSameDay(today, lastDate)) {
      status.canClaim = false; // Już odebrał dzisiaj
      status.isMissed = false;
    } else if (isYesterday(today, lastDate)) {
      status.canClaim = true; // Idealnie, wrócił dzień po dniu
      status.isMissed = false;
    } else {
      // Minęło więcej niż 1 dzień (i to nie jest pierwsze uruchomienie) -> STREAK ZERWANY!
      // Wyjątek: jeśli streak to 0, to znaczy że dopiero zaczyna lub już zresetował.
      if (status.streak > 0) {
          status.canClaim = false; 
          status.isMissed = true; 
      }
    }
  }

  // Zabezpieczenie cyklu 7 dni
  const dayIndex = status.streak % 7;
  status.nextReward = DAILY_REWARDS[dayIndex];
  status.dayIndex = dayIndex;

  return status;
};

export const claimDaily = async (walletAddress, canonicalId = null) => {
  const today = new Date().toISOString();
  const now = new Date();
  
  // A. GOŚĆ (brak wallet i brak canonicalId)
  if (!walletAddress && !canonicalId) {
    const current = getStorageItem('snake_daily_status', { streak: 0, lastClaim: null });
    const lastDate = current.lastClaim ? new Date(current.lastClaim) : null;

    // ✅ Guard: nie pozwalaj odebrać drugi raz tego samego dnia
    if (lastDate && isSameDay(now, lastDate)) {
      return { success: false, error: 'ALREADY_CLAIMED_TODAY' };
    }

    let newStreak = current.streak + 1;
    
    // Reset jeśli zerwany (gość nie ma opcji naprawy za jabłka bo nie ma bazy)
    if (lastDate && !isYesterday(now, lastDate) && !isSameDay(now, lastDate)) {
        newStreak = 1;
    }

    const rewardIndex = (newStreak - 1) % 7;
    const reward = DAILY_REWARDS[rewardIndex];

    setStorageItem('snake_daily_status', { streak: newStreak, lastClaim: today });
    
    // Dodaj jabłka do portfela gościa
    const currentApples = Number(getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0)) || 0;
    const nextBalance = currentApples + reward;
    setStorageItem(STORAGE_KEYS.TOTAL_APPLES, nextBalance);
    // utrzymuj też gross dla spójności modelu
    const gross = Number(getStorageItem('snake_total_apples_gross', nextBalance)) || nextBalance;
    setStorageItem('snake_total_apples_gross', Math.max(gross, nextBalance));

    return { success: true, reward, newStreak };
  }

  // B. ZALOGOWANY - NOWY SYSTEM: używamy tylko localStorage dla streak
  // ale zapisujemy daily rewards do bazy dla rankingu
  const current = getStorageItem('snake_daily_status', { streak: 0, lastClaim: null });
  const lastDate = current.lastClaim ? new Date(current.lastClaim) : null;

  // ✅ Guard: nie pozwalaj odebrać drugi raz tego samego dnia
  if (lastDate && isSameDay(now, lastDate)) {
    return { success: false, error: 'ALREADY_CLAIMED_TODAY' };
  }

  // ✅ Guard: jeśli streak zerwany (missed), nie pozwalaj claimować - trzeba naprawić albo zresetować
  if (lastDate && !isYesterday(now, lastDate) && !isSameDay(now, lastDate) && current.streak > 0) {
    return { success: false, error: 'STREAK_MISSED' };
  }

  let newStreak = current.streak + 1;
  
  // Reset jeśli zerwany
  // (dla zalogowanych już zablokowane powyżej — nie resetujemy tutaj)

  const rewardIndex = (newStreak - 1) % 7;
  const reward = DAILY_REWARDS[rewardIndex];

  // Zapisz w localStorage
  setStorageItem('snake_daily_status', { streak: newStreak, lastClaim: today });
  
  // Dodaj jabłka do localStorage
  const currentApples = Number(getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0)) || 0;
  const nextBalance = currentApples + reward;
  setStorageItem(STORAGE_KEYS.TOTAL_APPLES, nextBalance);
  // gross rośnie monotonicznie (potrzebne, żeby wydatki nie "wracały" po syncu z DB)
  const gross = Number(getStorageItem('snake_total_apples_gross', nextBalance)) || nextBalance;
  setStorageItem('snake_total_apples_gross', Math.max(gross, nextBalance));
  console.log('🍎 Daily reward claimed:', reward, 'New balance:', nextBalance);

  // 🔥 NOWE: Zapisz daily claim do bazy (dla rankingu)
  try {
    // Użyj canonicalId bezpośrednio (lub znajdź po wallet_address jako fallback)
    let userId = canonicalId;
    
    if (!userId && walletAddress) {
      // Fallback: znajdź przez wallet_address
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('user_id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();
      userId = profile?.user_id;
    }
    
    if (userId) {
      // Zapisz claim do bazy
      const { data, error: claimError } = await supabase
        .from('daily_claims')
        .insert({
          user_id: userId,
          reward: reward,
          streak_day: newStreak,
          claimed_at: today
        })
        .select();
      
      if (claimError) {
        console.error('❌ Failed to save daily claim to DB:', claimError);
        // Nie przerywamy - localStorage już został zaktualizowany
      } else {
        console.log('✅ Daily claim saved to DB:', { reward, streak_day: newStreak, userId });
      }
    } else {
      console.warn('⚠️ No user_id found. canonicalId:', canonicalId, 'walletAddress:', walletAddress);
    }
  } catch (error) {
    console.error('❌ Error saving daily claim to DB:', error);
    // Nie przerywamy - localStorage już został zaktualizowany
  }

  return { success: true, reward, newStreak };
};

export const repairStreakWithApples = async (walletAddress, canonicalId = null) => {
    if (!walletAddress && !canonicalId) return false; // Goście nie mogą naprawiać

    const cost = 500;
    
    // 🔥 NOWE: Sprawdź saldo BEZPOŚREDNIO z bazy (nie localStorage!)
    // To zapobiega wydawaniu więcej niż gracz faktycznie ma w rankingu
    let currentApples = 0;
    
    if (canonicalId) {
        // Pobierz z widoku rankingu (to jest źródło prawdy)
        const { data, error } = await supabase
            .from('leaderboard_total_apples')
            .select('total_apples')
            .eq('canonical_user_id', canonicalId)
            .single();
        
        if (!error && data) {
            currentApples = Math.max(0, Number(data.total_apples) || 0);
        }
    }
    
    console.log(`🍎 Daily Check-in: Repair attempt. User has: ${currentApples} (from DB), Need: ${cost}`);
    
    if (currentApples < cost) {
        console.log(`🍎 Daily Check-in: Not enough apples to repair streak. User has: ${currentApples} Need: ${cost}`);
        return false;
    }

    // Odejmij 500 jabłek (przez ledger "spent", żeby koszt nie znikał po późniejszym max(local, db))
    const prevSpent = Math.max(0, Number(getStorageItem('snake_apples_spent', 0)) || 0);
    const nextSpent = prevSpent + cost;
    setStorageItem('snake_apples_spent', nextSpent);

    // Utrzymuj spójne saldo w localStorage
    // Liczymy gross jako: saldo aktualny + już wydane jabłka
    const gross = Math.max(0, Number(getStorageItem('snake_total_apples_gross', 0)) || 0);
    // Jeśli gross jest 0 (pierwszy run), ustawiamy go na currentApples + prevSpent
    const finalGross = gross > 0 ? gross : (currentApples + prevSpent);
    const nextBalance = Math.max(0, finalGross - nextSpent);
    setStorageItem('snake_total_apples_gross', finalGross);
    setStorageItem(STORAGE_KEYS.TOTAL_APPLES, nextBalance);
    
    // Napraw streak w localStorage (resetujemy lastClaim, żeby mógł teraz claimować)
    const current = getStorageItem('snake_daily_status', { streak: 0 });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    setStorageItem('snake_daily_status', { 
        streak: current.streak, // Zachowaj obecny streak
        lastClaim: yesterday.toISOString() // Ustaw na "wczoraj", żeby dzisiaj mógł claimować
    });
    
    // 🔥 NOWE: Zapisz wydatek do bazy (dla rankingu)
    // Gracz MUSI czuć karę za przegapienie streaka!
    try {
        let profileQuery = supabase
            .from('player_profiles')
            .select('user_id');

        if (canonicalId) {
            profileQuery = profileQuery.eq('canonical_user_id', canonicalId);
        } else if (walletAddress) {
            profileQuery = profileQuery.eq('wallet_address', walletAddress.toLowerCase());
        }

        const { data: profile } = await profileQuery.single();
        
        if (profile?.user_id) {
            const { error: transactionError } = await supabase
                .from('apple_transactions')
                .insert({
                    user_id: profile.user_id,
                    amount: -cost, // ujemna wartość = wydatek
                    transaction_type: 'repair_streak',
                    description: `Repaired streak at day ${current.streak}`
                });
            
            if (transactionError) {
                console.error('❌ Failed to save repair transaction to DB:', transactionError);
                // Nie przerywamy - localStorage już został zaktualizowany
            } else {
                console.log('✅ Repair transaction saved to DB:', { amount: -cost });
            }
        }
    } catch (error) {
        console.error('❌ Error saving repair transaction to DB:', error);
    }
    
    console.log('✅ Streak repaired successfully! User can now claim today.');
    return true;
};

export const resetStreakToZero = async (walletAddress) => {
    // Gracz poddał się i nie płaci. Resetujemy streak do 0.
    setStorageItem('snake_daily_status', { streak: 0, lastClaim: null });
    console.log('🔄 Streak reset to 0');
    return true;
};