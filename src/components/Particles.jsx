// src/components/Particles.jsx
import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';

const Particles = forwardRef((props, ref) => {
  const [particles, setParticles] = useState([]);
  const reqRef = useRef();

  // Tę funkcję wywołujemy z App.jsx: "Zrób wybuch w punkcie X, Y"
  const explode = (x, y, color) => {
    const newParticles = [];
    // Generujemy 12 cząsteczek
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12; // Rozkładamy je w kółku
      const speed = Math.random() * 0.5 + 0.3; // Losowa prędkość
      
      newParticles.push({
        id: Math.random(),
        x: x + 0.5, // Startujemy ze środka kratki (gridu)
        y: y + 0.5,
        vx: Math.cos(angle) * speed, // Wektor prędkości X
        vy: Math.sin(angle) * speed, // Wektor prędkości Y
        life: 1.0, // Życie od 1.0 (pełne) do 0.0 (zniknięcie)
        color: color
      });
    }
    
    // Dodajemy nowe cząsteczki do istniejących (jeśli jakieś jeszcze latają)
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Udostępniamy funkcję rodzicowi (App.jsx)
  useImperativeHandle(ref, () => ({
    explode
  }));

  // Pętla animacji (działa niezależnie od pętli gry!)
  useEffect(() => {
    const update = () => {
      setParticles(prev => {
        if (prev.length === 0) return prev; // Jak pusto, to nic nie robimy

        return prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,      // Przesuń X
            y: p.y + p.vy,      // Przesuń Y
            life: p.life - 0.04 // Zmniejsz życie (szybkość znikania)
          }))
          .filter(p => p.life > 0); // Usuń martwe cząsteczki
      });
      reqRef.current = requestAnimationFrame(update);
    };

    reqRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqRef.current);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" // Dodajemy GLOW!
          style={{
            // Przeliczamy pozycję z Gridu na % (zakładając planszę 21x21)
            // Jeśli masz inny rozmiar siatki niż 21, zmień liczbę poniżej!
            left: `${(p.x / 21) * 100}%`, 
            top: `${(p.y / 21) * 100}%`,
            backgroundColor: p.color,
            color: p.color, // Do shadow-color
            opacity: p.life,
            transform: `scale(${p.life}) translate(-50%, -50%)`, // Centrujemy i skalujemy
          }}
        />
      ))}
    </div>
  );
});

Particles.displayName = 'Particles';
export default Particles;