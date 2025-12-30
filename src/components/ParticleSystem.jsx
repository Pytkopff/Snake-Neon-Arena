// src/components/ParticleSystem.jsx
import { useEffect, useRef, memo } from 'react'; // <--- Dodano memo
import { PARTICLE_LIFETIME } from '../utils/constants';

const ParticleSystem = ({ particles = [], gridSize, cellSize }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Ustawiamy canvas na pełny ekran, żeby nie było problemów ze skalowaniem
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = w * ratio;
    canvas.height = h * ratio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }, []); // Pusty array - tylko raz przy starcie

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;

    const animate = () => {
      // Czyścimy cały ekran
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (particles.length === 0) return; // Optymalizacja: jak nie ma cząsteczek, nie rysuj

      const now = Date.now();
      for (const p of particles) {
        const age = now - p.createdAt;
        const life = 1 - age / PARTICLE_LIFETIME;
        if (life <= 0) continue;

        const x = p.x + p.vx * (age / 100);
        const y = p.y + p.vy * (age / 100);
        const size = p.size * life;

        ctx.fillStyle = `rgba(${p.color}, ${Math.max(0, life)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.2, size), 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [particles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none z-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default memo(ParticleSystem);