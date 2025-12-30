// src/components/VirtualDPad.jsx
import { useState, memo } from 'react'; // <--- Dodano memo
import { DIRECTIONS } from '../utils/constants';

const VirtualDPad = ({ onDirectionChange, isVisible, size = 160 }) => {
  const [activeButton, setActiveButton] = useState(null);

  if (!isVisible) return null;

  const handleDirection = (direction, buttonId) => {
    setActiveButton(buttonId);
    onDirectionChange(direction);
    // Usuwamy setTimeout dla lepszej wydajności (animacja CSS wystarczy)
    setTimeout(() => setActiveButton(null), 100); 
  };

  const buttonSize = size * 0.35;

  const getButtonClass = (buttonId) => {
    const isActive = activeButton === buttonId;
    return `rounded-lg flex items-center justify-center text-xl transition-all duration-75 touch-none select-none ${
      isActive 
        ? 'bg-neon-blue/40 shadow-[0_0_20px_rgba(0,240,255,0.6)] scale-95' 
        : 'bg-neon-blue/10 border border-neon-blue/20'
    }`;
  };

  return (
    <div
      className="relative flex justify-center shrink-0"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        width: `${size}px`, 
        height: `${size}px` 
      }}
    >
        {/* UP */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.UP, 'up'); }}
          onMouseDown={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.UP, 'up'); }}
          className={`${getButtonClass('up')} absolute top-0 left-1/2 transform -translate-x-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <span className="opacity-60">⬆️</span>
        </button>

        {/* LEFT */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.LEFT, 'left'); }}
          onMouseDown={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.LEFT, 'left'); }}
          className={`${getButtonClass('left')} absolute top-1/2 left-0 transform -translate-y-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <span className="opacity-60">⬅️</span>
        </button>

        {/* RIGHT */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.RIGHT, 'right'); }}
          onMouseDown={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.RIGHT, 'right'); }}
          className={`${getButtonClass('right')} absolute top-1/2 right-0 transform -translate-y-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <span className="opacity-60">➡️</span>
        </button>

        {/* DOWN */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.DOWN, 'down'); }}
          onMouseDown={(e) => { e.preventDefault(); handleDirection(DIRECTIONS.DOWN, 'down'); }}
          className={`${getButtonClass('down')} absolute bottom-0 left-1/2 transform -translate-x-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <span className="opacity-60">⬇️</span>
        </button>

        {/* Center dot */}
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: `${size * 0.2}px`,
            height: `${size * 0.2}px`,
            background: 'radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 70%)',
            border: '1px solid rgba(0,240,255,0.1)',
          }}
        />
    </div>
  );
};

// Zamykamy komponent w memo() - to blokuje niepotrzebne renderowanie
export default memo(VirtualDPad);