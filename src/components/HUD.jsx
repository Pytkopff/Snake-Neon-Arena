import { memo } from 'react';

const HUD = ({ score, applesCollected, isPaused, onPause, soundEnabled, onToggleSound, gameMode, timeLeft }) => {
  
  const formatTime = (timeInput) => {
    if (!timeInput && timeInput !== 0) return '0:00';
    let seconds = timeInput;
    if (seconds > 1000) seconds = Math.floor(timeInput / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isZen = gameMode === 'chill';
  const showTimer = gameMode === 'walls' || gameMode === 'chill';

  return (
    // Zmieniamy na zwykły kontener (flex item), który zajmuje górę ekranu
    <div
      style={{
        width: '100%',
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Zachowujemy Twój padding na notcha
        paddingTop: 'max(env(safe-area-inset-top) + 8px, 48px)',
        paddingLeft: '12px',
        paddingRight: '12px',
        boxSizing: 'border-box',
        flexShrink: 0, // Nie zgniataj się
      }}
    >
      {/* ================= CONTENT WRAPPER ================= */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          minWidth: 0, // 🔴 iOS FIX zachowany
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* ================= GÓRNA BELKA ================= */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '64px',
            backgroundColor: 'rgba(15, 21, 53, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'auto',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: '12px',
            paddingRight: '12px',
            boxSizing: 'border-box',
          }}
        >
          {/* -------- LEWA STRONA -------- */}
          <div
            style={{
              flex: '1 1 0%',
              minWidth: 0, // 🔴 iOS FIX zachowany
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-0.5 block">
              Score
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white leading-none drop-shadow-md tabular-nums block">
                {score}
              </span>
              <div className="flex items-center bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-red-400 font-bold border border-white/5">
                🍎 {applesCollected}
              </div>
            </div>
          </div>

          {/* -------- ŚRODEK (ABSOLUTE) -------- */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '30%', // 🔴 iOS FIX zachowany
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              display: 'flex', 
              justifyContent: 'center'
            }}
          >
            {showTimer && timeLeft > 0 ? (
              <div
                className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg border transition-colors duration-300 ${
                  timeLeft <= 10000 && !isZen
                    ? 'bg-red-500/20 border-red-500 animate-pulse'
                    : 'bg-black/40 border-neon-blue/20'
                }`}
              >
                <span
                  className={`text-[8px] font-bold uppercase tracking-widest whitespace-nowrap block ${
                    timeLeft <= 10000 && !isZen
                      ? 'text-red-300'
                      : isZen
                      ? 'text-green-400'
                      : 'text-neon-blue'
                  }`}
                >
                  {isZen ? 'Zen' : 'Time'}
                </span>
                <span className="text-lg font-mono font-bold text-white tabular-nums leading-none block">
                  {formatTime(timeLeft)}
                </span>
              </div>
            ) : (
              <div className="text-center opacity-50">
                <div className="text-[8px] text-gray-500 font-bold tracking-widest block">
                  MODE
                </div>
                <div className="text-xs font-bold text-neon-blue block">
                  RANKED
                </div>
              </div>
            )}
          </div>

          {/* -------- PRAWA STRONA -------- */}
          <div
            style={{
              flex: '0 0 auto',
              minWidth: 0, // 🔴 iOS FIX zachowany
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <button
              onClick={onToggleSound}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all active:scale-95 flex-shrink-0 ${
                soundEnabled
                  ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue'
                  : 'bg-red-500/10 border-red-500/30 text-red-500'
              }`}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <button
              onClick={onPause}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all active:scale-95 flex-shrink-0 ${
                isPaused
                  ? 'bg-neon-blue text-black border-neon-blue font-bold shadow-[0_0_10px_#00F0FF]'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              {isPaused ? '▶' : 'II'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(HUD);