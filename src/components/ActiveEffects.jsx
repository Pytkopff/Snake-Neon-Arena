import { motion, AnimatePresence } from 'framer-motion';
import { memo, useEffect, useState } from 'react';

// --- SAMODZIELNA IKONA (Sama liczy swój czas) ---
const PowerUpIcon = ({ type, expiresAt, duration }) => {
  // Stan lokalny dla płynnej animacji
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    let animationFrameId;

    const updateProgress = () => {
      const now = Date.now();
      // Obliczamy ile czasu zostało
      const timeLeft = Math.max(0, expiresAt - now);
      // Przeliczamy na procent (0.0 do 1.0)
      const newProgress = Math.min(1, Math.max(0, timeLeft / duration));
      
      setProgress(newProgress);

      if (timeLeft > 0) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    // Start pętli
    updateProgress();

    // Sprzątanie po odmontowaniu
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [expiresAt, duration]);

  // --- RYSOWANIE SVG ---
  const size = 32;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  // Offset to "ile paska uciąć"
  const offset = circumference - (progress * circumference);

  const colors = {
    shield: '#3b82f6', magnet: '#ef4444', speed: '#eab308',
    score_x2: '#a855f7', ghost: '#10b981', freeze: '#06b6d4'
  };
  
  const normalizedType = type ? type.toLowerCase() : '';
  const color = colors[normalizedType] || '#ffffff';

  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="relative flex-shrink-0" 
      style={{ width: size, height: size }}
    >
      <svg className="absolute inset-0 transform -rotate-90" width={size} height={size}>
        {/* Tło paska (szare kółko) */}
        <circle stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        
        {/* Pasek postępu (Kolorowy) */}
        <motion.circle
          stroke={color} strokeWidth={stroke} fill="rgba(0,0,0,0.5)" r={radius} cx={size / 2} cy={size / 2}
          strokeDasharray={circumference} 
          // Używamy animate tutaj, żeby React płynnie zmieniał wartości DOM
          animate={{ strokeDashoffset: offset }}
          // transition={{ duration: 0 }} oznacza "natychmiast", bo sami sterujemy klatkami
          transition={{ duration: 0 }} 
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs z-10">
        {normalizedType === 'shield' && '🛡️'} {normalizedType === 'magnet' && '🧲'}
        {normalizedType === 'speed' && '⚡'} {normalizedType === 'score_x2' && '⭐'}
        {normalizedType === 'ghost' && '👻'} {normalizedType === 'freeze' && '❄️'}
      </div>
    </motion.div>
  );
};

const ActiveEffects = ({ combo, activePowerUps }) => {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '420px',
        height: '40px',
        marginTop: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingLeft: '12px',
        paddingRight: '12px',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        flexShrink: 0,
        zIndex: 40
      }}
    >
      {/* COMBO (LEWA STRONA) */}
      <div className="flex items-center">
        <AnimatePresence>
          {combo > 1 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="whitespace-nowrap text-yellow-400 font-black text-sm italic tracking-widest drop-shadow-lg bg-black/60 px-3 py-1 rounded-r-full border-l-4 border-yellow-400"
            >
              COMBO x{combo}!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* POWERUPS (PRAWA STRONA) */}
      <div className="flex items-center justify-end gap-2 pointer-events-auto">
        <AnimatePresence>
          {activePowerUps.map((p) => {
            // Przekazujemy tylko expiresAt i duration - ikona sama policzy resztę
            const duration = p.duration || 5000;
            return (
              <PowerUpIcon
                key={p.id}
                type={p.id}
                expiresAt={p.expiresAt} // 🔥 Kluczowa zmiana: przekazujemy timestamp końca
                duration={duration}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default memo(ActiveEffects);