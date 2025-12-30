// src/components/HUD.jsx
import { motion, AnimatePresence } from 'framer-motion';

const HUD = ({ score, applesCollected, bestScore, combo, activePowerUps, isPaused, onPause, soundEnabled, onToggleSound, gameMode, timeLeft }) => {
  
  const formatTime = (timeInput) => {
    if (!timeInput && timeInput !== 0) return "0:00";
    let seconds = timeInput;
    if (seconds > 600) seconds = Math.floor(timeInput / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isZen = gameMode === 'chill';
  const showTimer = gameMode === 'walls' || gameMode === 'chill';

  return (
    // Zmieniamy kontener: max-w-md (szerokość telefonu), mx-auto (środek), px-2 (margines od krawędzi)
    <div className="w-full max-w-md mx-auto mb-4 px-2 pointer-events-none relative z-50">
      
      {/* --- GŁÓWNY KOKPIT (Ciemny pasek na górze) --- */}
      <div className="pointer-events-auto bg-[#0f1535]/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-2 mt-2">
        
        {/* LEWA STRONA: Wynik i Jabłka */}
        <div className="flex flex-col gap-0.5 min-w-[80px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Score</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-white leading-none drop-shadow-md">{score}</span>
            {/* Mały licznik jabłek */}
            <div className="flex items-center bg-white/5 px-2 py-0.5 rounded text-xs text-red-400 font-bold border border-white/5">
               🍎 {applesCollected}
            </div>
          </div>
        </div>

        {/* ŚRODEK: Zegar (Tylko jeśli gra tego wymaga) */}
        {showTimer && timeLeft > 0 && (
          <div className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg border transition-colors duration-300 ${
            timeLeft <= 10000 && !isZen 
              ? 'bg-red-500/20 border-red-500 animate-pulse' 
              : 'bg-black/40 border-neon-blue/20'
          }`}>
             <span className={`text-[9px] font-bold uppercase tracking-widest ${
               timeLeft <= 10000 && !isZen ? 'text-red-300' : (isZen ? 'text-green-400' : 'text-neon-blue')
             }`}>
               {isZen ? 'Zen Time' : 'Time'}
             </span>
             <span className="text-xl font-mono font-bold text-white shadow-neon-blue tabular-nums">
               {formatTime(timeLeft)}
             </span>
          </div>
        )}

        {/* PRAWA STRONA: Przyciski (Dźwięk i Pauza) */}
        <div className="flex items-center gap-2">
           <button 
             onClick={onToggleSound} 
             className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${
               soundEnabled 
                 ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' 
                 : 'bg-red-500/10 border-red-500/30 text-red-500'
             }`}
           >
             {soundEnabled ? '🔊' : '🔇'}
           </button>
           
           <button 
             onClick={onPause} 
             className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${
                isPaused 
                ? 'bg-neon-blue text-black border-neon-blue font-bold shadow-[0_0_10px_#00F0FF]' 
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
             }`}
           >
             {isPaused ? '▶' : 'II'}
           </button>
        </div>
      </div>
      
      {/* --- DRUGI RZĄD: Combo i Powerupy (Pod spodem) --- */}
      <div className="flex justify-between items-start mt-2 px-1 h-8">
        
        {/* Combo (po lewej) */}
        <div className="flex items-center">
            <AnimatePresence>
                {combo > 1 && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0, x: -10 }}
                        animate={{ scale: 1, opacity: 1, x: 0 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="text-yellow-400 font-black text-sm animate-bounce tracking-wide drop-shadow-lg bg-black/50 px-2 py-1 rounded-lg border border-yellow-400/30"
                    >
                        🔥 COMBO x{combo}!
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Powerupy (po prawej) */}
        <div className="flex gap-1 pointer-events-auto justify-end">
            <AnimatePresence>
            {activePowerUps.map(p => (
              <motion.div 
                layout
                initial={{ scale: 0, x: 10, opacity: 0 }}
                animate={{ scale: 1, x: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                key={p.id} 
                className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-sm shadow-lg backdrop-blur-sm"
              >
                {p.id === 'shield' && '🛡️'}
                {p.id === 'magnet' && '🧲'}
                {p.id === 'speed' && '⚡'}
                {p.id === 'score_x2' && '⭐'}
                {p.id === 'ghost' && '👻'}
              </motion.div>
            ))}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default HUD;