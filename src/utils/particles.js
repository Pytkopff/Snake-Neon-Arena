// Particle helper moved out of the React component to keep HMR stable
export const createParticles = (x, y, color = '0, 240, 255', cellSize) => {
  const particles = [];
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;

  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 1 + Math.random() * 3;

    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      size: 2 + Math.random() * 3,
      color,
      createdAt: Date.now(),
    });
  }

  return particles;
};
