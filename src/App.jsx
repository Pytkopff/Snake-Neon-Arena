// src/App.jsx

// ❌ REMOVED: import { upsertPlayerProfile } from './utils/playerSync'; - nieużywane
import DailyCheckIn from './components/DailyCheckIn';
import { useEffect, useState, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { useSnakeGame } from './hooks/useSnakeGame';
import { GRID_SIZE, SKINS, MISSIONS } from './utils/constants';
import {
  getBestScore, updatePlayerStats, checkUnlocks, getUnlockedSkins,
  getSelectedSkin, setSelectedSkin, getPlayerStats, syncProfile,
  syncPlayerProfile, saveGameSession
} from './utils/storage';
import { resolveWalletProfile } from './utils/nameResolver';

// 🔥 IMPORTUJ MANAGERA
import SoundManager from './utils/SoundManager'; 

import GameBoard from './components/GameBoard';
import HUD from './components/HUD';
import ActiveEffects from './components/ActiveEffects';
import VirtualDPad from './components/VirtualDPad';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';
import GlobalLeaderboard from './components/GlobalLeaderboard';
import SkinMissionsPanel from './components/SkinMissionsPanel';
import Particles from './components/Particles';

function App() {
  const [farcasterUser, setFarcasterUser] = useState(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [quickAuthToken, setQuickAuthToken] = useState(null);
  
  const { address, isConnected } = useAccount();
  const particlesRef = useRef();

  // UI State
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [unlockNotification, setUnlockNotification] = useState(null);
  const [showDailyCheckIn, setShowDailyCheckIn] = useState(false);
  
  // Game Data
  const [gameMode, setGameMode] = useState('classic');
  const [bestScore, setBestScore] = useState(0);
  const [playerStats, setPlayerStats] = useState({ totalApples: 0, totalGames: 0 });
  const [unlockedSkins, setUnlockedSkins] = useState(['default']);
  const [currentSkinId, setCurrentSkinId] = useState(getSelectedSkin());
  const [currentCanonicalId, setCurrentCanonicalId] = useState(null);
  const [walletProfile, setWalletProfile] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const prevWalletConnectedRef = useRef(false);
  const prevWalletAddressRef = useRef(null);

  // Game State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifiedMissions, setNotifiedMissions] = useState(() => {
    try {
      const saved = localStorage.getItem('snake_notified_missions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // ============================================
  // 🔥 SEKCJA 1: Zarządzanie Stanem Muzyki (Efekt)
  // ============================================
  useEffect(() => {
    // Inicjalizacja jednorazowa
    SoundManager.init();
    SoundManager.setMute(!soundEnabled);

    // Obliczamy intencję: Czy muzyka powinna grać?
    const shouldPlayMusic = isPlaying && gameMode === 'chill' && !isPaused;

    // ✅ Używamy nowego API opartego na intencjach
    SoundManager.setMusicIntent(shouldPlayMusic);

    // Cleanup przy odmontowaniu
    return () => {
      SoundManager.stopMusic();
    };
  }, [isPlaying, gameMode, soundEnabled, isPaused]);


  // --- Profile & Storage Sync ---
  useEffect(() => {
    let isActive = true;

    const loadWalletProfile = async () => {
      if (!address) {
        if (isActive) setWalletProfile(null);
        return;
      }
      const profile = await resolveWalletProfile(address);
      if (isActive) setWalletProfile(profile);
    };

    loadWalletProfile();
    return () => { isActive = false; };
  }, [address]);

 useEffect(() => {
  const initProfile = async () => {
    // 🔥 CRITICAL: In Farcaster mini-app (web), SDK context can arrive a bit later.
    // If we create a guest profile before SDK resolves, we end up saving sessions as `guest:*`
    // which then show up as duplicate "Anonymous" entries with the same best score.
    // So: if wallet isn't connected and SDK isn't loaded yet, wait.
    if (!address && !isSDKLoaded) {
      console.log('⏳ Waiting for Farcaster SDK context before creating guest identity...');
      return;
    }

    // Stary system (zachowany dla misji i daily rewards)
    if (address) {
      const lastAddress = localStorage.getItem('snake_last_wallet');
      if (lastAddress && lastAddress !== address) {
        ['snake_unlocked_skins', 'snake_total_apples', 'snake_total_games',
         'snake_best_score', 'snake_best_score_walls', 'snake_best_score_chill'
        ].forEach(k => localStorage.removeItem(k));
        
        setIsPlaying(false);
        setIsPaused(true);
        setUnlockedSkins(['default']);
        setPlayerStats({ totalApples: 0, totalGames: 0, bestScore: 0, bestScoreClassic: 0, bestScoreWalls: 0, bestScoreChill: 0 });
      }
      localStorage.setItem('snake_last_wallet', address);
      
      // 1. Stara synchronizacja (zostawiamy dla bezpieczeństwa - stary system)
      await syncProfile(address);
    }

    // 🔥 NOWY SYSTEM: Sync do player_profiles (TEXT-based identity)
    // Utrzymujemy guestId w localStorage, ale przy logowaniu NAJPIERW scalamy sesje guest -> konto główne,
    // a dopiero potem czyścimy guestId (inaczej zostają sieroty w DB i w rankingu widać "Anonymous").
    const savedGuestId = localStorage.getItem('snake_guest_id');
    const isLoggedIn = Boolean(address || farcasterUser?.fid);
    let guestId = null;
    let previousGuestId = null;
    
    if (!isLoggedIn) {
      guestId = savedGuestId || crypto.randomUUID();
      if (!savedGuestId) localStorage.setItem('snake_guest_id', guestId);
    } else {
      // jeśli wcześniej grał jako guest na tym urządzeniu, przekaż do merge
      previousGuestId = savedGuestId || null;
    }
    
    const canonicalId = await syncPlayerProfile({
      farcasterFid: farcasterUser?.fid,
      walletAddress: address,
      guestId: guestId,
      previousGuestId: previousGuestId,
      username: farcasterUser?.username,
      avatarUrl: farcasterUser?.fid ? farcasterUser?.pfpUrl : walletProfile?.avatarUrl,
      displayName: farcasterUser?.fid ? farcasterUser?.username : walletProfile?.displayName,
    });
    
    console.log('🔑 Current Canonical ID set to:', canonicalId);
    setCurrentCanonicalId(canonicalId);
    
    // dopiero po udanym sync/merge czyścimy guestId, żeby nie tworzyć kolejnych guest profili po zalogowaniu
    if (isLoggedIn && canonicalId) {
      localStorage.removeItem('snake_guest_id');
    }

    // Pobierz statystyki (używamy canonicalId jeśli dostępny, inaczej address)
    // Total Apples i Total Games są globalne i nie zależą od trybu
    const stats = await getPlayerStats(address, canonicalId);
    setPlayerStats(stats);
    const skins = await getUnlockedSkins(address);
    setUnlockedSkins(skins);
    setBestScore(getBestScore(gameMode));
  };
  initProfile();
}, [isConnected, address, farcasterUser, isSDKLoaded, walletProfile]); // ❌ USUNIĘTE gameMode - nie resetuj statystyk przy zmianie trybu

  // ============================================
  // 🔒 SECURITY FIX: Reset Guest Identity on Wallet Disconnect
  // ============================================
  // Exploit prevented:
  // - Guest plays, gets high score, connects Wallet A -> merges
  // - Disconnect Wallet A -> app becomes guest but reuses old snake_guest_id
  // - Connect Wallet B -> merges the same old guest sessions into Wallet B
  //
  // Desired behavior:
  // - On wallet disconnect (and no Farcaster login), create a fresh guest identity
  // - Reset local progress to avoid "score farming" via repeated merges
  useEffect(() => {
    const wasConnected = prevWalletConnectedRef.current;
    const wasAddress = prevWalletAddressRef.current;
    const isNowDisconnected = wasConnected && !isConnected && Boolean(wasAddress);
    const hasFarcasterLogin = Boolean(farcasterUser?.fid);

    if (isNowDisconnected && !hasFarcasterLogin) {
      console.log('🧹 Wallet disconnected: resetting guest identity + local progress (anti-exploit)');

      // 1) Fresh guest identity
      localStorage.removeItem('snake_guest_id');
      const newGuestId = crypto.randomUUID();
      localStorage.setItem('snake_guest_id', newGuestId);

      // 2) Reset local progress (treat as a brand new guest)
      [
        'snake_total_apples',
        'snake_total_games',
        'snake_best_score',
        'snake_best_score_walls',
        'snake_best_score_chill',
        'snake_leaderboard',
        'snake_leaderboard_60s',
        'snake_leaderboard_chill'
      ].forEach(k => localStorage.removeItem(k));

      // 3) Reset in-memory UI/game state
      setIsPlaying(false);
      setIsPaused(true);
      setUnlockedSkins(['default']);
      setPlayerStats({ totalApples: 0, totalGames: 0, bestScore: 0, bestScoreClassic: 0, bestScoreWalls: 0, bestScoreChill: 0 });
      setBestScore(0);
      setCurrentCanonicalId(null);
    }

    prevWalletConnectedRef.current = isConnected;
    prevWalletAddressRef.current = address || null;
  }, [isConnected, address, farcasterUser]);

  // Osobny useEffect tylko dla aktualizacji bestScore przy zmianie trybu
  useEffect(() => {
    // Aktualizuj tylko bestScore dla wybranego trybu, nie resetuj całych statystyk
    setBestScore(getBestScore(gameMode));
  }, [gameMode]);

  // --- Farcaster Context ---
  useEffect(() => {
  const load = async () => {
    try {
      await sdk.actions.ready({ disableNativeGestures: true });
      const context = await sdk.context;
      const user = context?.user || { username: 'PlayerOne', pfpUrl: 'https://i.imgur.com/Kbd74kI.png' };
      setFarcasterUser(user);

      // Quick Auth (token for future backend verification)
      if (sdk?.quickAuth?.getToken) {
        try {
          const token = await sdk.quickAuth.getToken();
          setQuickAuthToken(token);
        } catch (err) {
          console.warn('Quick Auth token fetch failed:', err);
        }
      }

      // ❌ REMOVED: Stara synchronizacja do player_profiles_v2 (nieużywana)
      // Używamy tylko syncPlayerProfile() w initProfile useEffect

    } catch (e) { 
      setFarcasterUser({ username: 'Player', pfpUrl: 'https://via.placeholder.com/40' }); 
    } finally {
      setIsSDKLoaded(true);
    }
  };
  if (sdk && !isSDKLoaded) load();
}, [isSDKLoaded, address]);

  // --- Game Logic ---
  const {
    snake, food, score, applesCollected, gameOver, activePowerUps, gamePowerUpItem,
    combo, maxCombo, timeLeft, currentSpeed,
    startGame, resetGame, changeDirection, snakeDirection 
  } = useSnakeGame(isPaused);

  const prevApplesRef = useRef(applesCollected);
  const prevFoodRef = useRef(food);
  const prevPowerUpsLengthRef = useRef(activePowerUps.length);

  // --- FX & Sound Triggers ---
  useEffect(() => {
    if (!isPlaying) return;
    
    if (applesCollected > 0 && applesCollected > prevApplesRef.current) {
      if (particlesRef.current && prevFoodRef.current) {
        particlesRef.current.explode(prevFoodRef.current.x, prevFoodRef.current.y, '#ff3333');
      }
      SoundManager.play('eat');
    }

    if (activePowerUps.length > 0 && activePowerUps.length > prevPowerUpsLengthRef.current) {
      const newEffect = activePowerUps[activePowerUps.length - 1];
      if (newEffect && newEffect.id !== 'ghost') {
        SoundManager.play('powerup');
      }
    }

    prevApplesRef.current = applesCollected;
    prevFoodRef.current = food;
    prevPowerUpsLengthRef.current = activePowerUps.length;
  }, [applesCollected, food, activePowerUps, isPlaying]);

  // --- AUTO-PAUSE ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying && !isPaused && !gameOver) {
        setIsPaused(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const handleBlur = () => {
       if (isPlaying && !isPaused && !gameOver) setIsPaused(true);
    };
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isPlaying, isPaused, gameOver]);

  // Game Over Handler
  useEffect(() => {
    if (gameOver) {
      setIsPlaying(false);
      const handleGameOver = async () => {
        // 🔥 NOWY SYSTEM: Zapisz sesję do game_sessions NAJPIERW (żeby checkUnlocks widział nowe dane)
        if (currentCanonicalId) {
          await saveGameSession({
            userId: currentCanonicalId,
            mode: gameMode,
            score: score,
            applesEaten: applesCollected,
          });
        }

        // Aktualizuj best score
        await updatePlayerStats(applesCollected, score, address, gameMode);
        
        // Pobierz świeże statystyki z bazy (z game_sessions) - to jest jedyne źródło prawdy
        const freshStats = await getPlayerStats(address, currentCanonicalId);
        setPlayerStats(freshStats);
        
        // Sprawdź odblokowywanie skinów (z aktualnymi statystykami z bazy)
        const newUnlocks = await checkUnlocks(freshStats, address);
        
        if (newUnlocks.length > 0) {
          const updatedSkins = await getUnlockedSkins(address);
          setUnlockedSkins(updatedSkins);
          
          setUnlockNotification(newUnlocks);
        }
        if (score > bestScore) setBestScore(score);
      };
      handleGameOver();
    }
  }, [gameOver, score, applesCollected, address, gameMode, currentCanonicalId]);

  // Notification Auto-close
  useEffect(() => {
    if (unlockNotification) {
      const timer = setTimeout(() => setUnlockNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [unlockNotification]);

  // ============================================
  // 🔥 SEKCJA 2: Zmodyfikowana funkcja START
  // ============================================
  const handleStart = () => {
    // ✅ KROK 1: Wywołujemy to PIERWSZE, synchronicznie w handlerze kliknięcia
    if (gameMode === 'chill') {
      SoundManager.startMusicOnUserGesture();
    }

    SoundManager.play('click'); // To też pomaga odblokować audio
    
    // Reszta logiki
    setIsPlaying(true);
    setIsPaused(false);
    setNotifiedMissions([]);
    startGame(gameMode);
  };

  // ============================================
  // 🔥 SEKCJA 3: Zmodyfikowana Pauza/Wznowienie
  // ============================================
  const togglePause = () => {
    if (isPaused) {
       // Wznawianie gry - też traktujemy jako gest użytkownika
       if (gameMode === 'chill') {
          SoundManager.startMusicOnUserGesture();
       }
       SoundManager.play('click');
    }
    setIsPaused(!isPaused);
  };

  // Keyboard
  useEffect(() => {
    const handleKey = (e) => {
      if (!isPlaying || isPaused) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      switch(e.key) {
        case 'ArrowUp': case 'w': changeDirection({x: 0, y: -1}); break;
        case 'ArrowDown': case 's': changeDirection({x: 0, y: 1}); break;
        case 'ArrowLeft': case 'a': changeDirection({x: -1, y: 0}); break;
        case 'ArrowRight': case 'd': changeDirection({x: 1, y: 0}); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, isPaused, changeDirection]);

  // Touch handlers
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const onTouchStart = (e) => { touchEnd.current = null; touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; };
  const onTouchMove = (e) => { touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const dx = touchStart.current.x - touchEnd.current.x;
    const dy = touchStart.current.y - touchEnd.current.y;
    if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
    if (Math.abs(dx) > Math.abs(dy)) changeDirection({x: dx > 0 ? -1 : 1, y: 0});
    else changeDirection({x: 0, y: dy > 0 ? -1 : 1});
  };

  // --- Mission System ---
  useEffect(() => {
    if (!isPlaying) return;
    const currentTotalApples = (playerStats.totalApples || 0) + applesCollected;
    
    MISSIONS.forEach(mission => {
      const storedNotified = localStorage.getItem('snake_notified_missions');
      const alreadyNotified = storedNotified ? JSON.parse(storedNotified) : [];
      if (alreadyNotified.includes(mission.id)) return;
      if (mission.rewardType === 'skin' && unlockedSkins.includes(mission.rewardId)) return;
      if (mission.type === 'score') {
        let previousBest = 0;
        if (mission.mode === 'classic') previousBest = playerStats.bestScoreClassic || 0;
        else if (mission.mode === 'walls') previousBest = playerStats.bestScoreWalls || 0;
        else if (mission.mode === 'chill') previousBest = playerStats.bestScoreChill || 0;
        if (previousBest >= mission.target) return;
      }

      let isCompleted = false;
      if (mission.type === 'apples' && currentTotalApples >= mission.target) isCompleted = true;
      if (mission.type === 'score') {
        if (mission.mode && mission.mode !== gameMode) return;
        if (score >= mission.target) isCompleted = true;
      }
      if (mission.type === 'games' && (playerStats.totalGames + 1) >= mission.target) isCompleted = true;

      if (isCompleted) {
        const doubleCheck = localStorage.getItem('snake_notified_missions');
        const doubleCheckArray = doubleCheck ? JSON.parse(doubleCheck) : [];
        if (doubleCheckArray.includes(mission.id)) return;
        
        let rewardText = mission.title;
        if(mission.rewardType === 'skin') {
          const s = SKINS.find(sk => sk.id === mission.rewardId);
          if(s) rewardText = s.name;
        } else if (mission.rewardType === 'badge') {
          rewardText = `Badge: ${mission.title}`;
        }
        
        const updatedNotified = [...doubleCheckArray, mission.id];
        localStorage.setItem('snake_notified_missions', JSON.stringify(updatedNotified));
        
        setUnlockNotification([rewardText]);
        SoundManager.play('unlock');
        setNotifiedMissions(updatedNotified);
      }
    });
  }, [score, applesCollected, isPlaying, playerStats, unlockedSkins, gameMode]);

  // Responsive Grid
  const getCellSize = () => {
    const w = window.innerWidth; 
    const h = window.innerHeight; 
    const isDesktop = w > 1024;
    const maxW = Math.min(w - 32, isDesktop ? 500 : 420);
    const maxH = isDesktop ? 600 : (h * 0.45);
    return Math.min(Math.floor(maxW / GRID_SIZE), Math.floor(maxH / GRID_SIZE));
  };
  
  const [cellSize, setCellSize] = useState(getCellSize());
  
  useEffect(() => {
    const handleResize = () => setCellSize(getCellSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeSkinObj = SKINS.find(s => s.id === currentSkinId) || SKINS[0];

  if (!isSDKLoaded) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[#0A0E27] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
          <div className="text-neon-blue font-bold tracking-widest animate-pulse">LOADING ARENA...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-[#0A0E27] text-white overflow-hidden touch-none relative">
      
      {/* DESKTOP LEFT PANEL */}
      <div className="hidden lg:flex flex-col justify-center gap-6 w-72 h-[80vh] p-6 glass rounded-l-2xl border-r-0 border-white/10 z-10 transition-all hover:translate-x-1">
         <div className="text-neon-blue font-bold tracking-widest text-sm mb-2">YOUR CAREER</div>
        <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-4">
           <div><div className="text-xs text-gray-400">Total Apples</div><div className="text-2xl font-bold text-red-400">{playerStats.totalApples} 🍎</div></div>
           <div><div className="text-xs text-gray-400">Games Played</div><div className="text-2xl font-bold text-purple-400">{playerStats.totalGames} 🎮</div></div>
           <div><div className="text-xs text-gray-400">Skins Unlocked</div><div className="text-2xl font-bold text-yellow-400">{unlockedSkins.length} / {SKINS.length}</div></div>
           <div className="pt-2 border-t border-white/10">
             <div className="text-[10px] text-gray-500 mb-1">CLOUD SAVE STATUS</div>
             <div className={`text-xs font-bold ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
               {isConnected ? '🟢 ONLINE (Saved)' : '⚪ OFFLINE (Local)'}
             </div>
           </div>
        </div>
      </div>

      {/* CENTER GAME AREA */}
      <div className="h-full w-full max-w-lg lg:max-w-2xl lg:h-[85vh] lg:border-2 lg:border-neon-blue/30 lg:rounded-2xl lg:shadow-[0_0_50px_rgba(0,240,255,0.15)] lg:bg-black/40 flex flex-col relative z-20 overflow-hidden">
        
        <AnimatePresence>
          {unlockNotification && (
            <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="absolute top-4 left-0 right-0 z-[100] flex justify-center px-4">
               <div className="bg-black/90 border border-neon-blue rounded-xl p-4 shadow-[0_0_30px_rgba(0,240,255,0.3)] flex items-center gap-4 max-w-sm">
                 <div className="text-3xl">🎁</div>
                 <div>
                   <div className="text-neon-blue font-bold text-sm uppercase tracking-wider">Mission Complete!</div>
                   <div className="text-white text-xs">Unlocked: <span className="text-yellow-400 font-bold">{unlockNotification.join(', ')}</span></div>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN MENU */}
        {!isPlaying && !gameOver && (
          <div className="flex flex-col h-full w-full px-4 py-6 overflow-y-auto animate-fadeIn scrollbar-hide">
            <h1 className="text-3xl sm:text-4xl font-bold neon-text mb-4 text-center shrink-0">SNAKE NEON ARENA</h1>
            
            <div className="text-center text-neon-blue font-bold tracking-widest text-sm mb-4 -mt-2 animate-pulse">
               HELLO, {(farcasterUser?.username || walletProfile?.displayName || 'PLAYER').toUpperCase()}! 👾
            </div>

            <div className="mb-4 flex justify-center shrink-0">
              <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
                  const ready = mounted && authenticationStatus !== 'loading';
                  const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');
                  return (
                    <div {...(!ready && { 'aria-hidden': true, 'style': { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                      {(() => {
                        if (!connected) return <button onClick={openConnectModal} className="px-6 py-2 rounded-xl bg-neon-blue/10 border border-neon-blue text-neon-blue font-bold tracking-wider shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:bg-neon-blue/20 hover:scale-105 transition-all animate-pulse">🔌 CONNECT WALLET</button>;
                        if (chain.unsupported) return <button onClick={openChainModal} className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500 text-red-500 font-bold">⚠️ WRONG NETWORK</button>;
                        return (
                          <div className="flex gap-2">
                            <button onClick={openChainModal} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold flex items-center gap-2 hover:bg-white/10 transition-all">{chain.name}</button>
                            <button onClick={openAccountModal} className="px-4 py-2 rounded-xl bg-gradient-to-r from-neon-blue/20 to-purple-500/20 border border-neon-blue/50 text-white font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)] hover:scale-105 transition-all flex items-center gap-2">
                              {(() => {
                                const avatarUrl = farcasterUser?.pfpUrl || walletProfile?.avatarUrl;
                                if (avatarUrl) {
                                  return <img src={avatarUrl} alt="avatar" className="w-5 h-5 rounded-full border border-white/20 object-cover" />;
                                }
                                return <span aria-hidden>👤</span>;
                              })()}
                              <span>{farcasterUser?.username || walletProfile?.displayName || 'Wallet Player'}</span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>

            {showSkinSelector ? (
              <SkinMissionsPanel
                unlockedSkins={unlockedSkins} currentSkinId={currentSkinId} playerStats={playerStats}
                onClose={() => setShowSkinSelector(false)}
                onSelectSkin={(id) => { 
                   setCurrentSkinId(id); 
                   setSelectedSkin(id); 
                   SoundManager.play('click'); 
                }}
              />
            ) : (
              <>
                <div className="relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl rounded-2xl p-4 border border-white/10 mb-4 w-full shrink-0">
                  <div className="grid grid-cols-3 gap-2 relative z-10">
                    <div className="bg-white/5 rounded-lg p-2 border border-white/10 text-center"><div className="text-lg font-bold text-cyan-400">{bestScore}</div><div className="text-[10px] text-gray-400">Best</div></div>
                    <div className="bg-white/5 rounded-lg p-2 border border-white/10 text-center"><div className="text-lg font-bold text-purple-400">{playerStats.totalGames}</div><div className="text-[10px] text-gray-400">Games</div></div>
                    <div className="bg-white/5 rounded-lg p-2 border border-white/10 text-center"><div className="text-lg font-bold text-red-400">{playerStats.totalApples}</div><div className="text-[10px] text-gray-400">Total Apples</div></div>
                  </div>
                </div>

                <div className="space-y-2 w-full mb-4 shrink-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest text-center">Select Mode</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: 'classic', name: '🏆 Neon Ranked', sub: 'Classic Snake', color: 'cyan' },
                      { id: 'walls', name: '⚡ Time Blitz', sub: '60s Survival', color: 'pink' },
                      { id: 'chill', name: '🧘 Zen Flow', sub: 'No Stress', color: 'green' }
                    ].map(m => (
                      <button key={m.id} onClick={() => { setGameMode(m.id); SoundManager.play('click'); }} className={`p-3 rounded-xl border flex justify-between ${gameMode === m.id ? `bg-${m.color}-500/20 border-${m.color}-400` : 'bg-transparent border-white/10'}`}>
                        <div className="text-left"><div className="font-bold text-sm">{m.name}</div><div className="text-[10px] text-gray-400">{m.sub}</div></div>
                        {gameMode === m.id && <span className={`text-${m.color}-400 text-xs`}>Selected</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto w-full pb-4 space-y-2">
                    <button onClick={handleStart} className="btn-primary w-full py-3 text-lg shadow-lg">🎮 START GAME</button>
                    <button onClick={() => { setShowDailyCheckIn(true); SoundManager.play('click'); }} className="w-full py-2 rounded-lg border border-neon-blue/30 bg-neon-blue/10 text-neon-blue font-bold tracking-widest hover:bg-neon-blue/20 transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(0,240,255,0.2)] animate-pulse">
                        <span>🎁</span> DAILY REWARDS
                    </button>
                    <button onClick={() => { setShowSkinSelector(true); SoundManager.play('click'); }} className="btn-secondary w-full py-2 border-neon-blue/30 text-neon-blue">🎨 SKINS & MISSIONS</button>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowTutorial(true); SoundManager.play('click'); }} className="btn-secondary flex-1 py-2 text-sm">❓ Help</button>
                      <button onClick={() => { setShowLeaderboard(true); SoundManager.play('click'); }} className="btn-secondary flex-1 py-2 text-sm">🏆 Ranks</button>
                    </div>
                  </div>
              </>
            )}
          </div>
        )}

        {/* GAME ACTIVE */}
        {(isPlaying || gameOver) && (
          <div className="h-[100dvh] w-full flex flex-col items-center bg-[#0A0E27]" 
               onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            
            <HUD 
              score={score} applesCollected={applesCollected} 
              isPaused={isPaused} onPause={togglePause} 
              soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled(!soundEnabled)} 
              gameMode={gameMode} timeLeft={timeLeft} 
            />

            <ActiveEffects combo={combo} activePowerUps={activePowerUps} />

            <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 z-0">
                  <Particles ref={particlesRef} />
                </div>

                <div className="relative z-10">
                   <GameBoard 
                     snake={snake} food={food} powerUp={gamePowerUpItem} gridSize={GRID_SIZE} cellSize={cellSize}
                     userPfp={farcasterUser?.pfpUrl} activePowerUps={activePowerUps} speed={currentSpeed} score={score}
                     activeSkinColor={activeSkinObj.color} 
                   />
                </div>

                {isPaused && !gameOver && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
                      <div className="text-center p-6 glass rounded-xl border border-white/20 shadow-xl min-w-[200px]">
                        <h2 className="text-3xl font-bold mb-6 text-neon-blue tracking-widest">PAUSED</h2>
                        <button onClick={togglePause} className="btn-primary w-full py-3 mb-3">RESUME</button>
                        <button onClick={() => { setIsPlaying(false); setIsPaused(false); resetGame(); SoundManager.stopMusic(); }} className="btn-secondary w-full py-3">QUIT</button>
                      </div>
                   </div>
                )}
            </div>

            <div className="shrink-0 w-full flex justify-center pb-[max(20px,env(safe-area-inset-bottom))] lg:hidden z-20">
               <VirtualDPad isVisible={!gameOver} onDirectionChange={changeDirection} size={Math.min(160, window.innerWidth * 0.45)} currentDirection={snakeDirection} />
            </div>

          </div>
        )}

       {gameOver && (
          <GameOver
            score={score} 
            maxCombo={maxCombo} 
            bestScore={bestScore} 
            isNewRecord={score >= bestScore && score > 0}
            onRestart={handleStart} 
            onBackToMenu={() => { setIsPlaying(false); resetGame(); SoundManager.stopMusic(); }}
            
            onShare={() => { 
              const modeName = gameMode === 'walls' ? '⚡ Time Blitz' : gameMode === 'chill' ? '🧘 Zen Flow' : '🏆 Classic';      
              const text = `🐍 Just scored ${score} points in Snake Neon Arena!\n\nMode: ${modeName}\nSkin: ${activeSkinObj.name}\n\nCan you beat my high score? 👇`;          
              const gameUrl = "https://snake-neon-arena.vercel.app";
              const shareText = `${text}\n\n${gameUrl}`;
              (async () => {
                try {
                  if (navigator?.share) {
                    await navigator.share({ text, url: gameUrl });
                    return;
                  }
                } catch (err) {
                  console.warn('Web Share failed:', err);
                }
                try {
                  if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(shareText);
                    setShareCopied(true);
                    setSharePayload({ text, url: gameUrl });
                    setShowShareModal(true);
                    return;
                  }
                } catch (err) {
                  console.warn('Clipboard copy failed:', err);
                }
                setShareCopied(false);
                setSharePayload({ text, url: gameUrl });
                setShowShareModal(true);
              })();
            }}            
            applesCollected={applesCollected}
          />
        )}

        {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
        {showLeaderboard && (
          <GlobalLeaderboard 
            onClose={() => setShowLeaderboard(false)} 
            defaultTab={gameMode}
            currentCanonicalId={currentCanonicalId}
            farcasterUser={farcasterUser}
          />
        )}
        {showDailyCheckIn && (
          <DailyCheckIn
            walletAddress={address} 
            canonicalId={currentCanonicalId}
            onClose={() => setShowDailyCheckIn(false)}
            onRewardClaimed={(amount) => {
              
              setUnlockNotification([`Daily Reward: +${amount} 🍎`]);
              setPlayerStats(prev => ({ ...prev, totalApples: (prev.totalApples || 0) + amount }));
            }}
            onStatsUpdated={async () => {
              const stats = await getPlayerStats(address, currentCanonicalId);
              setPlayerStats(stats);
            }}
          />
        )}

        {showShareModal && sharePayload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="glass rounded-2xl p-5 w-full max-w-md border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
              <h3 className="text-xl font-bold neon-text mb-2 text-center">Share Your Score</h3>
              <p className="text-xs text-gray-400 text-center mb-3">
                Copy the text below and share anywhere.
              </p>
              <textarea
                readOnly
                value={`${sharePayload.text}\n\n${sharePayload.url}`}
                className="w-full h-32 p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-200 resize-none"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={async () => {
                    const payload = `${sharePayload.text}\n\n${sharePayload.url}`;
                    try {
                      if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(payload);
                        setShareCopied(true);
                      } else {
                        setShareCopied(false);
                      }
                    } catch {
                      setShareCopied(false);
                    }
                  }}
                  className="btn-primary flex-1 py-2 text-sm"
                >
                  {shareCopied ? 'Copied!' : 'Copy Text'}
                </button>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setShareCopied(false);
                    setSharePayload(null);
                  }}
                  className="btn-secondary flex-1 py-2 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
      <div className="hidden lg:block w-72 h-[80vh] p-6 glass rounded-r-2xl border-l-0 border-white/10"></div>
    </div>
  );
}

export default App;