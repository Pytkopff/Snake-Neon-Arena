// src/App.jsx

import { useEffect, useState, useRef } from 'react';
import { Howl } from 'howler';
import sdk from '@farcaster/frame-sdk';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
// Usunięto zduplikowany import sdk
import { useSnakeGame } from './hooks/useSnakeGame';
import { GRID_SIZE, SOUNDS, SKINS, MISSIONS } from './utils/constants';
import {
  getBestScore, updatePlayerStats, checkUnlocks, getUnlockedSkins,
  getSelectedSkin, setSelectedSkin, getPlayerStats, syncProfile
} from './utils/storage';

import GameBoard from './components/GameBoard';
import HUD from './components/HUD';
import VirtualDPad from './components/VirtualDPad';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';
import ParticleSystem from './components/ParticleSystem';
import Leaderboard from './components/Leaderboard';
import SkinMissionsPanel from './components/SkinMissionsPanel';
import Particles from './components/Particles';

function App() {
  const [farcasterUser, setFarcasterUser] = useState(null);
  // Dodano stan ładowania SDK
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  
  const { address, isConnected } = useAccount();
  const particlesRef = useRef();

  // UI State
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [unlockNotification, setUnlockNotification] = useState(null);

  // Game Data
  const [gameMode, setGameMode] = useState('classic');
  const [bestScore, setBestScore] = useState(0);
  const [playerStats, setPlayerStats] = useState({ totalApples: 0, totalGames: 0 });
  const [unlockedSkins, setUnlockedSkins] = useState(['default']);
  const [currentSkinId, setCurrentSkinId] = useState(getSelectedSkin());

  // Game State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifiedMissions, setNotifiedMissions] = useState(() => {
    try {
      const saved = localStorage.getItem('snake_notified_missions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // --- Profile & Storage Sync ---
  useEffect(() => {
    const initProfile = async () => {
      if (address) {
        const lastAddress = localStorage.getItem('snake_last_wallet');
        if (lastAddress && lastAddress !== address) {
          // New wallet detected, clear local specific data
          ['snake_unlocked_skins', 'snake_total_apples', 'snake_total_games',
           'snake_best_score', 'snake_best_score_walls', 'snake_best_score_chill'
          ].forEach(k => localStorage.removeItem(k));

          // Zabezpieczenie: Resetujemy stan gry przy zmianie portfela
          setIsPlaying(false);
          setIsPaused(true);
          setUnlockedSkins(['default']);
          setPlayerStats({
            totalApples: 0, totalGames: 0, bestScore: 0,
            bestScoreClassic: 0, bestScoreWalls: 0, bestScoreChill: 0
          });
        }
        localStorage.setItem('snake_last_wallet', address);
        await syncProfile(address);
      }

      const stats = await getPlayerStats(address);
      setPlayerStats(stats);
      const skins = await getUnlockedSkins(address);
      setUnlockedSkins(skins);
      setBestScore(getBestScore(gameMode));
    };
    initProfile();
  }, [isConnected, address, gameMode]);

  // --- Audio Setup ---
  const soundsRef = useRef({});
  const musicRef = useRef(null);

  useEffect(() => {
    soundsRef.current['EAT'] = new Howl({ src: [SOUNDS.EAT], volume: 0.5 });
    soundsRef.current['POWERUP'] = new Howl({ src: [SOUNDS.POWERUP], volume: 0.7 });
    
    musicRef.current = new Howl({ src: [SOUNDS.CHILL_MUSIC], loop: true, volume: 0.3, html5: true });
    return () => { if (musicRef.current) musicRef.current.unload(); };
  }, []);

  // Music Control
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    const shouldPlay = isPlaying && gameMode === 'chill' && soundEnabled && !isPaused;
    
    if (shouldPlay) {
      if (!music.playing()) { music.fade(0, 0.3, 1000); music.play(); }
    } else {
      if (music.playing()) music.pause();
    }
  }, [isPlaying, gameMode, soundEnabled, isPaused]);

  // --- Farcaster Context & Loading Logic ---
  useEffect(() => {
    const load = async () => {
      try {
        // Czekamy na gotowość SDK
        await sdk.actions.ready();
        const context = await sdk.context;
        setFarcasterUser(context?.user || { username: 'PlayerOne', pfpUrl: 'https://i.imgur.com/Kbd74kI.png' });
      } catch (e) { 
        setFarcasterUser({ username: 'Player', pfpUrl: 'https://via.placeholder.com/40' }); 
      } finally {
        // Zawsze odblokowujemy UI po próbie ładowania
        setIsSDKLoaded(true);
      }
    };
    if (sdk && !isSDKLoaded) {
      load();
    }
  }, [isSDKLoaded]);

  // --- Game Logic ---
  const {
    snake, food, score, applesCollected, gameOver, activePowerUps, gamePowerUpItem,
    combo, maxCombo, timeLeft, currentSpeed,
    startGame, resetGame, changeDirection
  } = useSnakeGame(isPaused);

  const prevApplesRef = useRef(applesCollected);
  const prevFoodRef = useRef(food);
  const prevPowerUpsLengthRef = useRef(activePowerUps.length);

  // FX & Sound Triggers
  useEffect(() => {
    // 🛡️ PANCERNA BLOKADA DŹWIĘKÓW 🛡️
    if (!isPlaying) return;
    
    if (applesCollected > 0 && applesCollected > prevApplesRef.current) {
      if (particlesRef.current && prevFoodRef.current) {
        particlesRef.current.explode(prevFoodRef.current.x, prevFoodRef.current.y, '#ff3333');
      }
      if (soundEnabled) soundsRef.current['EAT']?.play();
    }

    if (activePowerUps.length > 0 && activePowerUps.length > prevPowerUpsLengthRef.current) {
      const newEffect = activePowerUps[activePowerUps.length - 1];
      if (newEffect && newEffect.id !== 'ghost') {
        if (soundEnabled) soundsRef.current['POWERUP']?.play();
      }
    }

    prevApplesRef.current = applesCollected;
    prevFoodRef.current = food;
    prevPowerUpsLengthRef.current = activePowerUps.length;
  }, [applesCollected, food, activePowerUps, soundEnabled, isPlaying]);

  // Game Over Handler
  useEffect(() => {
    if (gameOver) {
      setIsPlaying(false);
      const handleGameOver = async () => {
        const newStats = await updatePlayerStats(applesCollected, score, address, gameMode);
        setPlayerStats(newStats);
        const newUnlocks = await checkUnlocks(newStats, address);
        
        if (newUnlocks.length > 0) {
          const updatedSkins = await getUnlockedSkins(address);
          setUnlockedSkins(updatedSkins);
          if (soundEnabled) soundsRef.current['UNLOCK']?.play();
          setUnlockNotification(newUnlocks);
        }
        if (score > bestScore) setBestScore(score);
      };
      handleGameOver();
    }
  }, [gameOver, score, applesCollected, address, gameMode]);

  // Notification Auto-close
  useEffect(() => {
    if (unlockNotification) {
      const timer = setTimeout(() => setUnlockNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [unlockNotification]);

  // --- Controls ---
  const handleStart = () => {
    setIsPlaying(true);
    setIsPaused(false);
    setNotifiedMissions([]);
    startGame(gameMode);
  };

  const togglePause = () => setIsPaused(!isPaused);

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

  // Touch
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

  // --- Mission System (BULLETPROOF LOCALSTORAGE FIX) ---
  useEffect(() => {
    if (!isPlaying) return;
    const currentTotalApples = (playerStats.totalApples || 0) + applesCollected;
    
    MISSIONS.forEach(mission => {
      // 🔒 KROK 1
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

      // --- Jeśli misja wykonana, robimy bezpieczny zapis ---
      if (isCompleted) {
        // 🔒 KROK 2: Double-Check
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
        
        // ✅ ATOMIC WRITE
        const updatedNotified = [...doubleCheckArray, mission.id];
        localStorage.setItem('snake_notified_missions', JSON.stringify(updatedNotified));
        
        setUnlockNotification([rewardText]);
        if (soundEnabled) soundsRef.current['UNLOCK']?.play();
        
        setNotifiedMissions(updatedNotified);
      }
    });
  }, [score, applesCollected, isPlaying, playerStats, unlockedSkins, gameMode, soundEnabled]);

  // Responsive Grid (Naprawa Mobile Layout)
  const getCellSize = () => {
    const w = window.innerWidth; 
    const h = window.innerHeight; 
    const isDesktop = w > 1024;
    
    // Mobile: szerokość - padding, max 420px
    // Desktop: max 500px
    const maxW = Math.min(w - 32, isDesktop ? 500 : 420);
    
    // Mobile: 45% wysokości (pozostaw miejsce na header + d-pad)
    // Desktop: max 600px
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

  // EKRAN ŁADOWANIA - POKAZUJEMY GO DOPÓKI SDK NIE JEST READY
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
      <ParticleSystem particles={[]} gridSize={GRID_SIZE} cellSize={cellSize} />

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
            
            {/* --- POWITANIE GRACZA (ZMIANA) --- */}
            <div className="text-center text-neon-blue font-bold tracking-widest text-sm mb-4 -mt-2 animate-pulse">
               HELLO, {farcasterUser?.username ? farcasterUser.username.toUpperCase() : 'PLAYER'}! 👾
            </div>

            <div className="mb-4 flex justify-center shrink-0"><ConnectButton showBalance={false} /></div>

            {showSkinSelector ? (
              <SkinMissionsPanel
                unlockedSkins={unlockedSkins} currentSkinId={currentSkinId} playerStats={playerStats}
                onClose={() => setShowSkinSelector(false)}
                onSelectSkin={(id) => { setCurrentSkinId(id); setSelectedSkin(id); }}
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
                      <button key={m.id} onClick={() => setGameMode(m.id)} className={`p-3 rounded-xl border flex justify-between ${gameMode === m.id ? `bg-${m.color}-500/20 border-${m.color}-400` : 'bg-transparent border-white/10'}`}>
                        <div className="text-left"><div className="font-bold text-sm">{m.name}</div><div className="text-[10px] text-gray-400">{m.sub}</div></div>
                        {gameMode === m.id && <span className={`text-${m.color}-400 text-xs`}>Selected</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto w-full pb-4 space-y-2">
                  <button onClick={handleStart} className="btn-primary w-full py-3 text-lg shadow-lg">🎮 START GAME</button>
                  <button onClick={() => setShowSkinSelector(true)} className="btn-secondary w-full py-2 border-neon-blue/30 text-neon-blue">🎨 SKINS & MISSIONS</button>
                  <div className="flex gap-2">
                    <button onClick={() => setShowTutorial(true)} className="btn-secondary flex-1 py-2 text-sm">❓ Help</button>
                    <button onClick={() => setShowLeaderboard(true)} className="btn-secondary flex-1 py-2 text-sm">🏆 Ranks</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* GAME ACTIVE */}
        {(isPlaying || gameOver) && (
          <div className="h-[100dvh] w-full flex flex-col items-center relative overflow-hidden bg-[#0A0E27]" 
               onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="shrink-0 w-full z-20 pt-2 px-2">
              <HUD score={score} applesCollected={applesCollected} bestScore={bestScore} combo={combo} 
                   activePowerUps={activePowerUps} isPaused={isPaused} onPause={togglePause} 
                   soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled(!soundEnabled)} 
                   gameMode={gameMode} timeLeft={timeLeft} />
            </div>

            <div className="flex-1 w-full flex items-center justify-center min-h-0 relative z-10 my-1">
              <div className="relative aspect-square max-h-full max-w-full">
                  <Particles ref={particlesRef} />
                  <GameBoard 
                    snake={snake} food={food} powerUp={gamePowerUpItem} gridSize={GRID_SIZE} cellSize={cellSize}
                    userPfp={farcasterUser?.pfpUrl} activePowerUps={activePowerUps} speed={currentSpeed} score={score}
                    isWalletConnected={isConnected} activeSkinColor={activeSkinObj.color} 
                  />
                  {isPaused && !gameOver && (
                    <div className="fixed inset-0 lg:absolute bg-black/40 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn">
                      <div className="text-center p-6 glass rounded-xl border border-white/20 shadow-xl">
                        <h2 className="text-3xl font-bold mb-6 text-neon-blue">PAUSED</h2>
                        <button onClick={togglePause} className="btn-primary w-full py-3 mb-3">RESUME</button>
                        <button onClick={() => { setIsPlaying(false); setIsPaused(false); resetGame(); }} className="btn-secondary w-full py-3">QUIT</button>
                      </div>
                    </div>
                  )}
              </div>
            </div>

           {/* Bezpieczny obszar iOS */}
           <div 
             className="shrink-0 w-full flex justify-center lg:hidden z-20 bg-gradient-to-t from-[#0A0E27] to-transparent"
             style={{
               paddingBottom: 'max(3.5rem, calc(env(safe-area-inset-bottom) + 2rem))'
             }}
           >
             <VirtualDPad isVisible={!gameOver} onDirectionChange={changeDirection} size={Math.min(160, window.innerWidth * 0.45)} />
           </div>
          </div>
        )}

        {gameOver && (
          <GameOver
            score={score} maxCombo={maxCombo} bestScore={bestScore} isNewRecord={score >= bestScore && score > 0}
            onRestart={handleStart} onBackToMenu={() => { setIsPlaying(false); resetGame(); }}
            onShare={() => { sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(`🐍 Scored ${score} in Snake! Skin: ${activeSkinObj.name}`)}`); }}
            applesCollected={applesCollected}
          />
        )}

        {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
        {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} defaultTab={gameMode} />}
      </div>
      <div className="hidden lg:block w-72 h-[80vh] p-6 glass rounded-r-2xl border-l-0 border-white/10"></div>
    </div>
  );
}

export default App;