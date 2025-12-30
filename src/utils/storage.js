// src/utils/storage.js
import { STORAGE_KEYS, SKINS, MISSIONS } from './constants';
// Upewnij się, że plik supabaseClient.js istnieje w tym samym folderze!
import { supabase } from './supabaseClient';

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

export const getPlayerStats = async (walletAddress) => {
  // 1. Pobieramy wyniki lokalne (Offline)
  const bestClassic = getStorageItem(STORAGE_KEYS.BEST_SCORE, 0); // Stary klucz to Classic
  const bestWalls = getStorageItem('snake_best_score_walls', 0);
  const bestChill = getStorageItem('snake_best_score_chill', 0);

  // 2. Budujemy obiekt statystyk
  let stats = {
    totalApples: getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0),
    totalGames: getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0),
    bestScore: Math.max(bestClassic, bestWalls, bestChill), // Ogólny Max (do nagłówka)
    
    // 🔥 TE TRZY POLA SĄ KLUCZOWE DLA MISJI:
    bestScoreClassic: bestClassic,
    bestScoreWalls: bestWalls,
    bestScoreChill: bestChill
  };

  if (!walletAddress) return stats;

  // 3. Logika Online (Supabase)
  try {
    const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();
    if (!profile) return stats;

    const { data: dbStats } = await supabase.from('player_stats').select('*').eq('user_id', profile.id).single();
    
    if (dbStats) {
      // Jeśli mamy dane z chmury, nadpisujemy lokalne
      setStorageItem(STORAGE_KEYS.TOTAL_APPLES, dbStats.total_apples_eaten);
      setStorageItem(STORAGE_KEYS.TOTAL_GAMES, dbStats.total_games_played);
      
      stats = {
          totalApples: dbStats.total_apples_eaten,
          totalGames: dbStats.total_games_played,
          // Ogólny
          bestScore: Math.max(dbStats.highest_score_classic, dbStats.highest_score_walls, dbStats.highest_score_chill),
          // Szczegółowe
          bestScoreClassic: dbStats.highest_score_classic,
          bestScoreWalls: dbStats.highest_score_walls,
          bestScoreChill: dbStats.highest_score_chill
      };
    }
  } catch (e) {
    console.error("Error syncing stats:", e);
  }
  
  return stats;
};

// 3. Aktualizacja statystyk
// src/utils/storage.js

export const updatePlayerStats = async (applesInGame, score, walletAddress, mode = 'classic') => {
  // 1. NAJPIERW LOKALNIE (Żeby gracz widział wynik od razu na ekranie)
  const currentTotalApples = getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0);
  const currentTotalGames = getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0);
  
  // Aktualizujemy "brudnopis" w przeglądarce
  setStorageItem(STORAGE_KEYS.TOTAL_APPLES, currentTotalApples + applesInGame);
  setStorageItem(STORAGE_KEYS.TOTAL_GAMES, currentTotalGames + 1);
  updateBestScore(score, mode); 

  // 2. TERAZ WYSYŁAMY DO SUPABASE (Bezpiecznie)
  if (walletAddress) {
    try {
      // Najpierw musimy zdobyć ID gracza na podstawie portfela
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();
      
      if (profile) {
        console.log(`📡 Wysyłam wynik do bazy: ${score} pkt (${mode})`);

        // A) Zgłaszamy wynik do historii (Trigger w bazie sam sprawdzi, czy to rekord!)
        const { error: scoreError } = await supabase.from('game_scores').insert([{
            user_id: profile.id,
            score: score,
            mode: mode
        }]);

        if (scoreError) console.error('Błąd zapisu wyniku:', scoreError);

        // B) Bezpiecznie dodajemy jabłka (używając funkcji RPC, którą stworzyliśmy)
        if (applesInGame > 0) {
            const { error: appleError } = await supabase.rpc('increment_apples', { 
                row_id: profile.id, 
                quantity: applesInGame 
            });
            if (appleError) console.error('Błąd dodawania jabłek:', appleError);
        }
      }
    } catch (err) {
      console.error('Błąd komunikacji z Supabase:', err);
    }
  }

  // Na koniec pobieramy świeży stan z bazy (żeby upewnić się, że wszystko się zgadza)
  return await getPlayerStats(walletAddress);
};

// 4. Skiny
export const unlockSkinOnServer = async (skinId, walletAddress) => {
  if (!walletAddress) return;
  try {
    const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();
    if (!profile) return;
    await supabase.from('unlocked_skins').insert([{ user_id: profile.id, skin_id: skinId }]);
  } catch (err) {}
};

export const getUnlockedSkins = async (walletAddress) => {
  // 1. Pobieramy to, co jest w przeglądarce (to może być błędne "6/6")
  let localSkins = getStorageItem(STORAGE_KEYS.UNLOCKED_SKINS, ['default']);

  // 2. Jeśli gracz NIE JEST zalogowany -> wierzymy przeglądarce
  if (!walletAddress) return localSkins;

  // 3. Jeśli JEST zalogowany -> Baza Danych jest szeryfem 🤠
  try {
    const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();

    if (profile) {
      const { data: unlocked } = await supabase.from('unlocked_skins').select('skin_id').eq('user_id', profile.id);
      
      if (unlocked) {
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

// 👇 TE FUNKCJE BYŁY BRAKUJĄCE:
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