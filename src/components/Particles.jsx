// src/components/Particles.jsx
import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { GRID_SIZE } from '../utils/constants';

// 🔥 1. GLOBALNY LICZNIK (To gwarantuje, że ID nigdy się nie powtórzy)
let globalParticleId = 0;

const Particles = forwardRef((props, ref) => {
  const [particles, setParticles] = useState([]);
  const reqRef = useRef();
  const cleanupTimeout = useRef();

  const explode = (x, y, color) => {
    // 🔥 2. BEZPIECZNIK: Jeśli coś wisi, czyścimy stare przed nowym wybuchem
    if (cleanupTimeout.current) clearTimeout(cleanupTimeout.current);

    const newParticles = [];
    const count = 20 + Math.random() * 10; 

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.8 + 0.2;
      globalParticleId++; // Zwiększamy licznik

      newParticles.push({
        id: globalParticleId, // Pancerne ID
        x: x + 0.5, 
        y: y + 0.5,
        vx: Math.cos(angle) * speed, 
        vy: Math.sin(angle) * speed,
        life: 1.0, 
        color: color,
        size: Math.random() < 0.3 ? 4 : 2, // Troszkę większe niż w starym kodzie
        decay: 0.03 + Math.random() * 0.03 // Szybsze znikanie
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);

    // 🔥 3. OSTATECZNE CZYSZCZENIE: Za 1.5 sekundy kasujemy WSZYSTKO.
    // To jest gwarancja, że kropka nie zostanie na zawsze.
    cleanupTimeout.current = setTimeout(() => {
      setParticles([]);
    }, 1500);
  };

  useImperativeHandle(ref, () => ({ explode }));

  useEffect(() => {
    const update = () => {
      setParticles(prev => {
        if (prev.length === 0) return prev;

        return prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.95,      // Fizyka ze starego kodu (opór)
            vy: p.vy * 0.95 + 0.02, // Fizyka ze starego kodu (grawitacja)
            life: p.life - p.decay
          }))
          // 🔥 4. FILTR: Usuwamy jak życie spadnie poniżej 10% (nie 0!)
          .filter(p => p.life > 0.1);
      });
      reqRef.current = requestAnimationFrame(update);
    };

    reqRef.current = requestAnimationFrame(update);
    
    return () => {
      cancelAnimationFrame(reqRef.current);
      if (cleanupTimeout.current) clearTimeout(cleanupTimeout.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            willChange: 'transform, opacity',
            // 🔥 5. OPTYMALIZACJA: Skalujemy życie do 0
            transform: `translate3d(-50%, -50%, 0) scale(${p.life})`,
            width: `${p.size * 3}px`, // Większe pudełko na gradient
            height: `${p.size * 3}px`,
            left: `${(p.x / GRID_SIZE) * 100}%`, 
            top: `${(p.y / GRID_SIZE) * 100}%`,
            
            // 🔥 6. TRICK DLA IPHONE: Zamiast cienia (box-shadow) używamy gradientu.
            // Wygląda jak glow, ale działa 10x szybciej.
            background: `radial-gradient(circle, ${p.color} 0%, transparent 70%)`,
            
            opacity: p.life,
          }}
        />
      ))}
    </div>
  );
});

Particles.displayName = 'Particles';
export default Particles;