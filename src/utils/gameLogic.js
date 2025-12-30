// src/utils/gameLogic.js
import { GRID_SIZE } from './constants';

// Pomoc: Sprawdź czy dwie pozycje są takie same
export const positionsEqual = (pos1, pos2) => {
  return pos1.x === pos2.x && pos1.y === pos2.y;
};

// Pomoc: Wylosuj pozycję unikając węża
export const getRandomPosition = (excludePositions = []) => {
  let position;
  let isColliding;
  // Próbujemy 100 razy znaleźć wolne miejsce
  for (let i = 0; i < 100; i++) {
    position = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    isColliding = excludePositions.some(pos => positionsEqual(pos, position));
    if (!isColliding) return position;
  }
  return { x: 0, y: 0 }; // Awaryjnie 0,0 jak nie znajdzie
};

// Pomoc: Sprawdź kolizję z własnym ciałem
export const checkSelfCollision = (head, body) => {
  // Zaczynamy od indeksu 1, bo głowa (0) nie może uderzyć samej siebie
  for (let i = 1; i < body.length; i++) {
    if (positionsEqual(head, body[i])) return true;
  }
  return false;
};

// Pomoc: Wykrywanie urządzenia mobilnego
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};