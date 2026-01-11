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

export const getPlayerStats = async (walletAddress, canonicalId = null) => {
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

  // 3. Logika Online (Supabase) - NOWY SYSTEM
  // Priorytet: canonicalId > walletAddress
  let targetCanonicalId = canonicalId;
  
  try {
    // A. Jeśli mamy canonicalId, użyj go bezpośrednio
    if (targetCanonicalId) {
      console.log('📊 Using canonicalId directly:', targetCanonicalId);
      
      // Pobierz sumę jabłek z game_sessions
      const { data: appleSumData } = await supabase
        .from('game_sessions')
        .select('apples_eaten')
        .eq('user_id', targetCanonicalId);
      
      if (appleSumData && appleSumData.length > 0) {
        const totalApplesFromDB = appleSumData.reduce((sum, row) => sum + (row.apples_eaten || 0), 0);
        console.log('🍎 Total apples from game_sessions:', totalApplesFromDB);
        
        // Synchronizuj z localStorage
        setStorageItem(STORAGE_KEYS.TOTAL_APPLES, totalApplesFromDB);
        stats.totalApples = totalApplesFromDB;
      }
      
      // Pobierz liczbę gier
      const { count } = await supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetCanonicalId);
      
      if (count !== null) {
        setStorageItem(STORAGE_KEYS.TOTAL_GAMES, count);
        stats.totalGames = count;
      }
      
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
        
        // Pobierz sumę jabłek z game_sessions
        const { data: appleSumData } = await supabase
          .from('game_sessions')
          .select('apples_eaten')
          .eq('user_id', targetCanonicalId);
        
        if (appleSumData && appleSumData.length > 0) {
          const totalApplesFromDB = appleSumData.reduce((sum, row) => sum + (row.apples_eaten || 0), 0);
          console.log('🍎 Total apples from game_sessions:', totalApplesFromDB);
          
          // Synchronizuj z localStorage
          setStorageItem(STORAGE_KEYS.TOTAL_APPLES, totalApplesFromDB);
          stats.totalApples = totalApplesFromDB;
        }
        
        // Pobierz liczbę gier
        const { count } = await supabase
          .from('game_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetCanonicalId);
        
        if (count !== null) {
          setStorageItem(STORAGE_KEYS.TOTAL_GAMES, count);
          stats.totalGames = count;
        }
        
        return stats;
      }
      
      // C. Fallback: stary system (dla backward compatibility)
      const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();
      if (profile) {
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
  
  // Dla gości (bez walletAddress) aktualizujemy localStorage bezpośrednio
  // Dla zalogowanych użytkowników dane będą z bazy przez getPlayerStats
  if (!walletAddress) {
    const currentTotalApples = getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0);
    const currentTotalGames = getStorageItem(STORAGE_KEYS.TOTAL_GAMES, 0);
    setStorageItem(STORAGE_KEYS.TOTAL_APPLES, currentTotalApples + applesInGame);
    setStorageItem(STORAGE_KEYS.TOTAL_GAMES, currentTotalGames + 1);
  } 

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
    // Najpierw znajdź lub utwórz profil
    let { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();
    
    // Jeśli nie ma profilu, utwórz go
    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ wallet_address: walletAddress }])
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
  const { farcasterFid, walletAddress, guestId, username, avatarUrl } = identity;
  
  // 1. Określ user_id i canonical_user_id (priorytet)
  let userId, canonicalUserId, displayName, defaultAvatar;
  
  if (farcasterFid) {
    userId = `fc:${farcasterFid}`;
    canonicalUserId = `fc:${farcasterFid}`;
    displayName = username || `Player_${farcasterFid}`;
    defaultAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fc${farcasterFid}&backgroundColor=0a0e27`;
  } else if (walletAddress) {
    userId = walletAddress.toLowerCase();
    canonicalUserId = walletAddress.toLowerCase();
    displayName = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
    defaultAvatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${walletAddress}&backgroundColor=0a0e27`;
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
    // 2. Sprawdź czy profil już istnieje
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
          display_name: displayName,
          avatar_url: avatarUrl || existing.avatar_url,
          farcaster_username: username || existing.farcaster_username,
        })
        .eq('user_id', userId);
      
      return existing.canonical_user_id;
    }

    // 3. Sprawdź czy istnieje profil Farcaster dla tego portfela (merge logic)
    if (walletAddress && !farcasterFid) {
      const { data: fcProfile } = await supabase
        .from('player_profiles')
        .select('canonical_user_id, farcaster_fid')
        .eq('wallet_address', walletAddress.toLowerCase())
        .not('farcaster_fid', 'is', null)
        .single();
      
      if (fcProfile) {
        // Użytkownik ma już konto Farcaster - użyj jego canonical_user_id
        canonicalUserId = fcProfile.canonical_user_id;
      }
    }

    // 4. Stwórz nowy profil
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

export const claimDaily = async (walletAddress) => {
  const today = new Date().toISOString();
  
  // A. GOŚĆ
  if (!walletAddress) {
    const current = getStorageItem('snake_daily_status', { streak: 0 });
    let newStreak = current.streak + 1;
    
    // Reset jeśli zerwany (gość nie ma opcji naprawy za jabłka bo nie ma bazy)
    const lastDate = current.lastClaim ? new Date(current.lastClaim) : null;
    if (lastDate && !isYesterday(new Date(), lastDate) && !isSameDay(new Date(), lastDate)) {
        newStreak = 1;
    }

    const rewardIndex = (newStreak - 1) % 7;
    const reward = DAILY_REWARDS[rewardIndex];

    setStorageItem('snake_daily_status', { streak: newStreak, lastClaim: today });
    
    // Dodaj jabłka do portfela gościa
    const currentApples = getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0);
    setStorageItem(STORAGE_KEYS.TOTAL_APPLES, currentApples + reward);

    return { success: true, reward, newStreak };
  }

  // B. ZALOGOWANY - NOWY SYSTEM: używamy tylko localStorage
  // Streak jest lokalną funkcją, nie trzeba synchronizować z Supabase
  const current = getStorageItem('snake_daily_status', { streak: 0 });
  let newStreak = current.streak + 1;
  
  // Reset jeśli zerwany
  const lastDate = current.lastClaim ? new Date(current.lastClaim) : null;
  if (lastDate && !isYesterday(new Date(), lastDate) && !isSameDay(new Date(), lastDate)) {
      newStreak = 1;
  }

  const rewardIndex = (newStreak - 1) % 7;
  const reward = DAILY_REWARDS[rewardIndex];

  // Zapisz w localStorage
  setStorageItem('snake_daily_status', { streak: newStreak, lastClaim: today });
  
  // Dodaj jabłka do localStorage
  const currentApples = getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0);
  setStorageItem(STORAGE_KEYS.TOTAL_APPLES, currentApples + reward);
  console.log('🍎 Daily reward claimed:', reward, 'New total:', currentApples + reward);

  return { success: true, reward, newStreak };
};

export const repairStreakWithApples = async (walletAddress) => {
    if (!walletAddress) return false; // Goście nie mogą naprawiać

    const cost = 500;
    
    // Sprawdź ile ma jabłek w localStorage
    let currentApples = getStorageItem(STORAGE_KEYS.TOTAL_APPLES, 0);
    console.log(`🍎 Daily Check-in: Repair attempt. User has: ${currentApples}, Need: ${cost}`);
    
    if (currentApples < cost) {
        console.log(`🍎 Daily Check-in: Not enough apples to repair streak. User has: ${currentApples} Need: ${cost}`);
        return false;
    }

    // Odejmij 500 jabłek
    setStorageItem(STORAGE_KEYS.TOTAL_APPLES, currentApples - cost);
    
    // Napraw streak w localStorage (resetujemy lastClaim, żeby mógł teraz claimować)
    const current = getStorageItem('snake_daily_status', { streak: 0 });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    setStorageItem('snake_daily_status', { 
        streak: current.streak, // Zachowaj obecny streak
        lastClaim: yesterday.toISOString() // Ustaw na "wczoraj", żeby dzisiaj mógł claimować
    });
    
    console.log('✅ Streak repaired successfully! User can now claim today.');
    return true;
};

export const resetStreakToZero = async (walletAddress) => {
    // Gracz poddał się i nie płaci. Resetujemy streak do 0.
    setStorageItem('snake_daily_status', { streak: 0, lastClaim: null });
    console.log('🔄 Streak reset to 0');
    return true;
};