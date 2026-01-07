// src/components/GameBoard.jsx
import { useEffect, useState, useRef, memo } from 'react';
import { SKINS } from '../utils/constants';

const GameBoard = memo(({ snake, food, powerUp, gridSize, cellSize, userPfp, activePowerUps = [], speed, score, activeSkinColor }) => {
  
  const prevScoreRef = useRef(score);
  const prevSnakeRef = useRef([]); 
  
  const [floatingTexts, setFloatingTexts] = useState([]);
  const currentSkin = SKINS.find(s => s.color[0] === (activeSkinColor ? activeSkinColor[0] : '')) || SKINS[0];

  // LOGIKA TEKSTÓW (PUNKTY)
  useEffect(() => {
    if (score > prevScoreRef.current && snake && snake.length > 0) {
      const gained = score - prevScoreRef.current;
      const head = snake[0];

      if (head) {
        setFloatingTexts(prev => {
            const newText = {
                id: Date.now(), 
                x: head.x, 
                y: head.y,
                value: gained > 20 ? `🔥+${gained}` : `+${gained}`, 
                color: gained > 20 ? '#FF4D4D' : '#FFF' 
            };
            const updated = [...prev, newText];
            if (updated.length > 3) updated.shift(); 
            return updated;
        });

        setTimeout(() => setFloatingTexts(prev => prev.slice(1)), 600);
      }
    }
    prevScoreRef.current = score;
  }, [score, snake]);

  // ŚLEDZENIE RUCHU WĘŻA
  useEffect(() => {
    if (snake) {
        prevSnakeRef.current = snake.map(s => ({...s}));
    }
  }, [snake]);

  const hasShield = activePowerUps.some(p => p.id === 'shield');
  const hasMagnet = activePowerUps.some(p => p.id === 'magnet');
  
  const safeSnake = snake || [];
  const head = safeSnake[0] || {x:0, y:0};
  const neck = safeSnake[1] || head;

  const gradientColors = hasShield ? ['#06FFA5', '#04D98B'] : currentSkin.color;
  const glowColor = hasShield ? '#06FFA5' : (currentSkin.glow.match(/#[0-9a-fA-F]{6}/) || ['#00F0FF'])[0]; 

  const getHeadRotation = () => {
    if (safeSnake.length < 2) return 0;
    const dx = head.x - neck.x;
    const dy = head.y - neck.y;
    if (Math.abs(dx) > 1) return dx > 0 ? 180 : 0;
    if (Math.abs(dy) > 1) return dy > 0 ? -90 : 90;
    if (head.x > neck.x) return 0;
    if (head.x < neck.x) return 180;
    if (head.y > neck.y) return 90;
    if (head.y < neck.y) return -90;
    return 0;
  };

  const prevHead = prevSnakeRef.current[0];
  let isHeadWrapping = false;
  if (prevHead) {
    const dx = Math.abs(head.x - prevHead.x);
    const dy = Math.abs(head.y - prevHead.y);
    if (dx > 1 || dy > 1) isHeadWrapping = true;
  }

  // 🔥 TWOJA POPRAWKA PŁYNNOŚCI (+20ms buffer)
  const animDuration = speed; 
  const transitionString = `transform ${animDuration + 20}ms linear`;

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-slate-900 border border-white/5"
      style={{
        width: gridSize * cellSize,
        height: gridSize * cellSize,
        background: 'radial-gradient(circle at center, #1a103d 0%, #0A0E27 100%)',
        boxShadow: hasShield ? '0 0 15px rgba(6, 255, 165, 0.1)' : 'none',
        
        // 🔥🔥🔥 BETONOWA IZOLACJA (TO ELIMINUJE SKAKANIE) 🔥🔥🔥
        contain: 'strict',      // Przeglądarka wie, że rozmiar tego diva NIGDY się nie zmieni przez to co jest w środku
        isolation: 'isolate',   // Tworzy nową warstwę układania (stacking context)
        
        transform: 'translateZ(0)', // Wymuszenie GPU
        willChange: 'transform'
      }}
    >
      {/* PUNKTY */}
      {floatingTexts.map(text => (
        <div key={text.id} 
          className="absolute z-50 pointer-events-none flex items-center justify-center font-bold"
          style={{ 
            left: `${text.x * cellSize}px`, 
            top: `${text.y * cellSize}px`, 
            width: cellSize, 
            height: cellSize,
            color: text.color,
            textShadow: '0 2px 2px rgba(0,0,0,0.8)',
            animation: 'floatUp 0.6s ease-out forwards',
            willChange: 'transform, opacity'
          }}
        >
             {text.value}
        </div>
      ))}

      {/* MAGNES */}
      {hasMagnet && (
        <div className="absolute rounded-full pointer-events-none"
          key={isHeadWrapping ? `magnet-teleport-${Date.now()}` : 'magnet-smooth'}
          style={{ 
              transform: `translate3d(${head.x * cellSize - cellSize * 1.5}px, ${head.y * cellSize - cellSize * 1.5}px, 0)`, 
              width: cellSize * 4, 
              height: cellSize * 4, 
              background: 'radial-gradient(circle, rgba(157, 78, 221, 0.2) 0%, transparent 70%)', 
              zIndex: 5, 
              transition: isHeadWrapping ? 'none' : transitionString 
            }} 
        />
      )}

      {/* JEDZENIE */}
      <div className="absolute flex items-center justify-center z-10"
          style={{ width: cellSize, height: cellSize, transform: `translate3d(${food.x * cellSize}px, ${food.y * cellSize}px, 0)` }}>
          <div className="w-3/4 h-3/4 rounded-full flex items-center justify-center animate-bounce-subtle"
            style={{ 
                background: food.type.color, 
                boxShadow: `0 0 8px ${food.type.color}`, 
                fontSize: cellSize > 20 ? '1rem' : '0.8rem' 
            }}>
            {food.type.emoji}
          </div>
      </div>

      {/* POWER-UP */}
      {powerUp && (
         <div className="absolute flex items-center justify-center z-10"
         style={{ width: cellSize, height: cellSize, transform: `translate3d(${powerUp.x * cellSize}px, ${powerUp.y * cellSize}px, 0)` }}>
         <div className="text-xl animate-spin-slow">{powerUp.emoji}</div>
       </div>
      )}

      {/* WĄŻ */}
      {safeSnake.map((segment, index) => {
        const isHead = index === 0;
        const prevSegment = prevSnakeRef.current[index];
        let isWrapping = false;

        if (prevSegment) {
          const dx = Math.abs(segment.x - prevSegment.x);
          const dy = Math.abs(segment.y - prevSegment.y);
          if (dx > 1.5 || dy > 1.5) isWrapping = true;
        } else {
          isWrapping = true;
        }

        const renderKey = isWrapping ? `t-${index}-${Date.now()}` : index;

        return (
          <div
            key={renderKey}
            className="absolute flex items-center justify-center"
            style={{
              width: cellSize,
              height: cellSize,
              transform: `translate3d(${segment.x * cellSize}px, ${segment.y * cellSize}px, 0)`,
              zIndex: isHead ? 30 : 20,
              willChange: 'transform',
              transition: isWrapping ? 'none' : transitionString,
            }}
          >
            <div 
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
                boxShadow: isHead ? `0 0 15px ${glowColor}` : 'none',
                borderRadius: isHead ? '35%' : '30%',
                transform: isHead ? `rotate(${getHeadRotation()}deg) scale(1.1)` : 'scale(0.92)',
                transition: isHead && !isWrapping ? transitionString : 'none'
              }}
            >
              {isHead && (
                userPfp ? (
                  <img src={userPfp} alt="head" className="w-full h-full object-cover rounded-xl opacity-90" style={{ transform: 'rotate(-90deg)' }} />
                ) : (
                  <>
                    <div className="absolute top-[20%] left-[15%] w-[25%] h-[25%] bg-black/60 rounded-full"></div>
                    <div className="absolute top-[20%] right-[15%] w-[25%] h-[25%] bg-black/60 rounded-full"></div>
                  </>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default GameBoard;