// src/components/VirtualDPad.jsx
import { useState, useRef, memo } from 'react';
import { DIRECTIONS } from '../utils/constants';

// Usuwamy 'currentDirection' z propsów - D-Pad nie musi tego wiedzieć
const VirtualDPad = ({ onDirectionChange, isVisible, size = 160 }) => {
  const [activeButton, setActiveButton] = useState(null);
  const lastInputTime = useRef(0);

  if (!isVisible) return null;

  // Ukryj D-pad na Desktopie: renderujemy go tylko na urządzeniach z dotykiem.
  // Heurystyka: maxTouchPoints + pointer coarse + ontouchstart (fallback).
  const isTouchDevice =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 ||
      ('ontouchstart' in window) ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches));

  if (!isTouchDevice) return null;

  const handleDirection = (e, direction, buttonId) => {
    // 1. Blokujemy domyślne zachowania przeglądarki (scroll, zoom)
    if (e.cancelable && e.preventDefault) {
        e.preventDefault();
    }
    // 2. Blokujemy "wyciekanie" dotyku do App.jsx (żeby nie wykryło swipa)
    e.stopPropagation();

    // 3. ULTRA-KRÓTKI DEBOUNCE (50ms)
    // Tylko tyle, żeby wyciąć błędy sprzętowe (ghost touch).
    // Nie blokujemy gracza, jeśli ma szybki kciuk.
    const now = Date.now();
    if (now - lastInputTime.current < 50) {
        return;
    }
    lastInputTime.current = now;

    // 4. Wysyłamy sygnał - bez pytania o pozwolenie
    // Niech useSnakeGame.js martwi się o logikę.
    setActiveButton(buttonId);
    onDirectionChange(direction);
    
    // Szybki reset wizualny
    setTimeout(() => setActiveButton(null), 100); 
  };

  const buttonSize = size * 0.35;
  const iconSize = size * 0.15;

  const getButtonClass = (buttonId) => {
    const isActive = activeButton === buttonId;
    return `
      rounded-xl flex items-center justify-center transition-all duration-75 touch-none select-none
      backdrop-blur-sm cursor-pointer
      ${isActive 
        ? 'bg-neon-blue text-black shadow-[0_0_25px_rgba(0,240,255,0.8)] scale-95 border-transparent' 
        : 'bg-[#0f1535]/80 border border-neon-blue/30 text-neon-blue shadow-lg active:bg-neon-blue/20'
      }
    `;
  };

  const ArrowIcon = ({ rotation }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={iconSize} 
      height={iconSize} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );

  return (
    <div
      className="relative flex justify-center shrink-0"
      style={{
        touchAction: 'none',        // Krytyczne dla mobile
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        width: `${size}px`, 
        height: `${size}px` 
      }}
    >
        {/* TŁO */}
        <div 
            className="absolute inset-0 rounded-full border border-neon-blue/10 bg-gradient-to-b from-transparent to-neon-blue/5 pointer-events-none"
            style={{ transform: 'scale(0.9)' }}
        />

        {/* --- PRZYCISKI --- */}
        {/* Używamy onPointerDown dla lepszej reakcji niż onTouchStart/onMouseDown */}
        
        {/* UP */}
        <button
          onPointerDown={(e) => handleDirection(e, DIRECTIONS.UP, 'up')}
          className={`${getButtonClass('up')} absolute top-0 left-1/2 transform -translate-x-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <ArrowIcon rotation={0} />
        </button>

        {/* LEFT */}
        <button
          onPointerDown={(e) => handleDirection(e, DIRECTIONS.LEFT, 'left')}
          className={`${getButtonClass('left')} absolute top-1/2 left-0 transform -translate-y-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <ArrowIcon rotation={270} />
        </button>

        {/* RIGHT */}
        <button
          onPointerDown={(e) => handleDirection(e, DIRECTIONS.RIGHT, 'right')}
          className={`${getButtonClass('right')} absolute top-1/2 right-0 transform -translate-y-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <ArrowIcon rotation={90} />
        </button>

        {/* DOWN */}
        <button
          onPointerDown={(e) => handleDirection(e, DIRECTIONS.DOWN, 'down')}
          className={`${getButtonClass('down')} absolute bottom-0 left-1/2 transform -translate-x-1/2`}
          style={{ width: `${buttonSize}px`, height: `${buttonSize}px` }}
        >
          <ArrowIcon rotation={180} />
        </button>

        {/* ŚRODEK (Ozdoba) */}
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30"
          style={{
            width: `${size * 0.25}px`,
            height: `${size * 0.25}px`,
            background: 'radial-gradient(circle, rgba(0,240,255,0.4) 0%, transparent 70%)',
          }}
        />
    </div>
  );
};

export default memo(VirtualDPad);