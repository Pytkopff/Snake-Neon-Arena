import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const GameOver = ({ score, maxCombo, bestScore, isNewRecord, onRestart, onShare, onBackToMenu, endReason, applesCollected }) => {
  const [displayScore, setDisplayScore] = useState(0);
  
  // 🔥 FIX 1: Stan blokady przycisków (Anti-Rage Click)
  const [canInteract, setCanInteract] = useState(false);

  // 1. EFEKT KASYNA (Ticker)
  useEffect(() => {
    let start = 0;
    const duration = 1500; 
    const steps = 60;
    const increment = score / steps;
    const stepTime = duration / steps;

    if (score === 0) return;

    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [score]);

  // 🔥 FIX 2: Timer odblokowujący przyciski (1.5 sekundy opóźnienia)
  useEffect(() => {
    setCanInteract(false);
    const timer = setTimeout(() => {
      setCanInteract(true);
    }, 1500); // 1500ms czasu na "ochłonięcie"

    return () => clearTimeout(timer);
    }, [score]);
  

  // 2. OBLICZENIA PASKA "CHASE"
  const progressToBest = bestScore > 0 ? Math.min(100, (score / bestScore) * 100) : 100;
  const missingPoints = bestScore - score;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="glass rounded-2xl p-6 w-full max-w-sm text-center border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        
        {/* Tło dla Nowego Rekordu */}
        {isNewRecord && (
           <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 via-purple-500/10 to-transparent animate-pulse pointer-events-none" />
        )}

        {/* --- NAGŁÓWEK --- */}
        <div className="mb-6 relative z-10">
          {isNewRecord ? (
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <div className="text-5xl mb-2 drop-shadow-lg">🏆</div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] uppercase italic">
                New Record!
              </h2>
              <p className="text-sm text-yellow-200 font-bold mt-1">LEGENDARY RUN!</p>
            </motion.div>
          ) : (
            <div>
              <div className="text-5xl mb-2 grayscale opacity-80">
                 {endReason === 'timeup' ? "⏱️" : "💀"}
              </div>
              <h2 className="text-3xl font-black text-white drop-shadow-md uppercase">
                 {endReason === 'timeup' ? "Time's Up" : "Game Over"}
              </h2>
              <p className="text-sm text-gray-400 mt-1">Don't give up! Try again.</p>
            </div>
          )}
        </div>

        {/* --- WYNIK GŁÓWNY (Licznik) --- */}
        <div className="mb-6 relative z-10">
          <div className="text-6xl font-black text-white drop-shadow-[0_0_20px_rgba(0,240,255,0.4)] font-mono tracking-tighter">
            {displayScore.toLocaleString()}
          </div>
          <div className="text-xs text-neon-blue font-bold tracking-widest uppercase mt-1">Final Score</div>
        </div>

        {/* --- PASEK POŚCIGU (Tylko jak przegrasz) --- */}
        {!isNewRecord && bestScore > 0 && (
          <div className="mb-6 bg-black/40 rounded-xl p-3 border border-white/5 relative z-10 mx-2">
             <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">
                <span>Progress to Best</span>
                <span className="text-white">{Math.floor(progressToBest)}%</span>
             </div>
             <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${progressToBest}%` }} 
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-gray-600 via-gray-400 to-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                />
             </div>
             <p className="text-[10px] text-gray-400 mt-2">
                You were only <span className="text-red-400 font-bold">{missingPoints} pts</span> away from glory!
             </p>
          </div>
        )}

        {/* --- STATYSTYKI --- */}
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-bold text-red-400 drop-shadow-sm">{applesCollected}</div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Apples</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-bold text-yellow-400 drop-shadow-sm">x{maxCombo || 0}</div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Max Combo</div>
          </div>
        </div>

        {/* --- PRZYCISKI Z OCHRONĄ PRZED RAGE-CLICK --- */}
        <div 
            className="space-y-3 relative z-10"
            style={{
                opacity: canInteract ? 1 : 0,           // Niewidoczne -> Widoczne
                pointerEvents: canInteract ? 'auto' : 'none', // Klikalne -> Nieklikalne
                filter: canInteract ? 'none' : 'grayscale(100%)', // Opcjonalnie: Szare na start
                transition: 'opacity 0.5s ease-in, filter 0.5s ease-in' // Płynne wejście
            }}
        >
          <button
            onClick={onRestart}
            className="w-full py-3 rounded-xl bg-neon-blue text-black font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            🔄 PLAY AGAIN
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onBackToMenu}
              className="flex-1 py-3 rounded-xl bg-white/5 text-white font-bold text-sm border border-white/10 hover:bg-white/10 transition-colors"
            >
              ↩️ Menu
            </button>
            <button
              onClick={onShare}
              className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2
                ${isNewRecord 
                  ? 'bg-purple-600 border-purple-400 text-white animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                  : 'bg-transparent border-white/10 text-gray-300 hover:bg-white/5'
                }`}
            >
              🚀 Share
            </button>
          </div>
        </div>

        {/* Tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-[10px] text-gray-500 mt-4"
        >
          💡 Tip: Grab magnets to collect apples from a distance!
        </motion.p>

      </motion.div>
    </motion.div>
  );
};

export default GameOver;