// src/hooks/useSnakeGame.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  GRID_SIZE, INITIAL_SNAKE, DIRECTIONS, INITIAL_SPEED, 
  POWERUP_TYPES, FRUITS, SOUNDS
} from '../utils/constants';
import { getRandomPosition, checkSelfCollision, positionsEqual } from '../utils/gameLogic';
import { Howl } from 'howler';

export const useSnakeGame = (isPaused) => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 15, y: 10, type: FRUITS[0] });
  const [score, setScore] = useState(0);
  const [applesCollected, setApplesCollected] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [activePowerUps, setActivePowerUps] = useState([]);
  const [gamePowerUpItem, setGamePowerUpItem] = useState(null);
  
  const [combo, setCombo] = useState(1); 
  const [maxCombo, setMaxCombo] = useState(0);

  const [timeLeft, setTimeLeft] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(INITIAL_SPEED);
  
  const soundsRef = useRef({});
  const gameState = useRef({
    snake: INITIAL_SNAKE,
    direction: DIRECTIONS.RIGHT,
    directionQueue: [],
    speed: INITIAL_SPEED,
    lastMoveTime: 0,
    lastLoopTime: 0, 
    scoreMultiplier: 1,
    lastAppleTime: 0,
    activeEffects: [],
    mode: 'classic', 
    blitzEndTime: 0,
    isRunning: false 
  });

  useEffect(() => {
    Object.keys(SOUNDS).forEach(key => {
      if(key !== 'CHILL_MUSIC') {
        soundsRef.current[key] = new Howl({ src: [SOUNDS[key]], volume: 0.4 });
      }
    });
  }, []);

  const playSound = (key) => {
    if (soundsRef.current[key]) soundsRef.current[key].play();
  };

  const startGame = (mode = 'classic') => {
    setSnake(INITIAL_SNAKE);
    setScore(0);
    setApplesCollected(0);
    setGameOver(false);
    setActivePowerUps([]);
    setGamePowerUpItem(null);
    setCombo(1);
    setMaxCombo(0);

    setFood({ ...getRandomPosition(INITIAL_SNAKE), type: FRUITS[0] });

    let startSpeed = 150; 
    let initialTime = 0;
    let blitzEnd = 0;
    let startEffects = [];

    if (mode === 'classic') {
      startSpeed = 100;
    } else if (mode === 'walls') { 
      startSpeed = 100; 
      initialTime = 30000;
      blitzEnd = Date.now() + initialTime;
    } else if (mode === 'chill') { 
      startSpeed = 70;
      initialTime = 120000; 
      blitzEnd = Date.now() + initialTime;
    }
    
    setTimeLeft(initialTime);
    setCurrentSpeed(startSpeed);
    gameState.current = {
      snake: INITIAL_SNAKE,
      direction: DIRECTIONS.RIGHT,
      directionQueue: [],
      speed: startSpeed,
      lastMoveTime: 0,
      lastLoopTime: Date.now(),
      scoreMultiplier: 1,
      lastAppleTime: Date.now(), 
      activeEffects: startEffects,
      mode: mode,
      blitzEndTime: blitzEnd,
      isRunning: true 
    };
    updateActivePowerUpsUI();
  };

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    setSnake(INITIAL_SNAKE);
    setActivePowerUps([]);
    gameState.current.isRunning = false;
  };

  // 🔥🔥🔥 NAPRAWIONA FUNKCJA changeDirection 🔥🔥🔥
  const changeDirection = useCallback((newDir) => {
    const state = gameState.current;
    
    // Pobierz ostatni zaplanowany kierunek (albo aktualny jeśli kolejka pusta)
    const lastScheduledDirection = state.directionQueue.length > 0
      ? state.directionQueue[state.directionQueue.length - 1]
      : state.direction;

    // ✅ BLOKADA 1: Przeciwne kierunki (180°)
    // Nie można zawrócić: prawo->lewo, lewo->prawo, góra->dół, dół->góra
    const isOpposite = (
      lastScheduledDirection.x + newDir.x === 0 && 
      lastScheduledDirection.y + newDir.y === 0
    );
    
    if (isOpposite) {
      console.log('🚫 Zablokowano przeciwny kierunek');
      return;
    }

    // ✅ BLOKADA 2: Ten sam kierunek (spam)
    // Jeśli wąż już idzie w tym kierunku, ignoruj
    const isSame = (
      lastScheduledDirection.x === newDir.x && 
      lastScheduledDirection.y === newDir.y
    );
    
    if (isSame) {
      console.log('🚫 Ten sam kierunek - ignoruję spam');
      return;
    }

    // ✅ BLOKADA 3: Maksymalnie 2 ruchy w kolejce (dla szybkich combo)
    // Było 4, zmniejszam do 2 - wystarczy dla najszybszych palców
    if (state.directionQueue.length >= 2) {
      console.log('🚫 Kolejka pełna - poczekaj na wykonanie ruchu');
      return;
    }

    // ✅ Wszystko OK - dodaj do kolejki
    console.log('✅ Dodano kierunek do kolejki:', newDir);
    state.directionQueue.push(newDir);
  }, []);

  const activatePowerUp = (powerUpConfig) => {
    const state = gameState.current;
    const now = Date.now();
    const endTime = now + powerUpConfig.duration;
    const type = powerUpConfig.type;

    state.activeEffects = state.activeEffects.filter(e => e.type !== type);
    
    state.activeEffects.push({ 
        type, 
        endTime, 
        duration: powerUpConfig.duration,
        config: powerUpConfig 
    });

    if (type === 'SPEED') {
      state.speed = state.mode === 'chill' ? 50 : 60; 
      setCurrentSpeed(state.speed);
    }
    if (type === 'SCORE_X2') state.scoreMultiplier = 2;

    updateActivePowerUpsUI();
  };

  const updateActivePowerUpsUI = () => {
    const uiList = gameState.current.activeEffects.map(e => ({
      id: e.config.id,
      emoji: e.config.emoji,
      expiresAt: e.endTime,
      duration: e.duration || e.config.duration || 5000
    }));
    setActivePowerUps(uiList);
  };

  useEffect(() => {
    if (gameOver || isPaused) return; 
    
    gameState.current.lastMoveTime = performance.now();
    gameState.current.lastLoopTime = Date.now();

    let requestID;
    const loop = (timestamp) => {
      const state = gameState.current;
      
      if (!state.isRunning) return; 

      const now = Date.now();
      const delta = now - state.lastLoopTime;
      state.lastLoopTime = now;

      if (combo > 1 && (now - state.lastAppleTime > 3000)) {
         setCombo(1);
      }

      if (state.mode === 'walls' || state.mode === 'chill') {
        if (state.mode === 'walls') {
            const isFrozen = state.activeEffects.some(e => e.type === 'FREEZE');
            if (isFrozen) state.blitzEndTime += delta; 
        }
        const remaining = Math.max(0, state.blitzEndTime - now);
        setTimeLeft(remaining);
          
        if (remaining <= 0) {
          state.isRunning = false; 
          playSound('GAMEOVER'); 
          if (window.navigator.vibrate) window.navigator.vibrate(state.mode === 'chill' ? 500 : 200);
          setGameOver(true); 
          return;
        }
      }
      
      const isInvincible = state.activeEffects.some(e => e.type === 'SHIELD');

      const activeCount = state.activeEffects.length;
      state.activeEffects = state.activeEffects.filter(e => {
        if (e.endTime > now) return true;
        
        if (e.type === 'SPEED') {
           let baseSpeed = 150;
           if (state.mode === 'classic') baseSpeed = Math.max(50, 100 - Math.floor(score/50));
           if (state.mode === 'walls') baseSpeed = 100;
           if (state.mode === 'chill') baseSpeed = 70;
           state.speed = baseSpeed;
           setCurrentSpeed(baseSpeed);
        }
        if (e.type === 'SCORE_X2') state.scoreMultiplier = 1;
        return false;
      });
      
      if (activeCount !== state.activeEffects.length) {
          updateActivePowerUpsUI();
      }

      if (timestamp - state.lastMoveTime > state.speed) {
        
        if (state.directionQueue.length > 0) {
            state.direction = state.directionQueue.shift();
        }

        const head = { 
          x: state.snake[0].x + state.direction.x, 
          y: state.snake[0].y + state.direction.y 
        };

        const isOutOfBounds = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
        if (isOutOfBounds) {
          if (state.mode === 'classic') {
             if (!isInvincible) {
                state.isRunning = false;
                playSound('GAMEOVER');
                if (window.navigator.vibrate) window.navigator.vibrate(200);
                setGameOver(true);
                return;
             } else {
                if (head.x < 0) head.x = GRID_SIZE - 1;
                if (head.x >= GRID_SIZE) head.x = 0;
                if (head.y < 0) head.y = GRID_SIZE - 1;
                if (head.y >= GRID_SIZE) head.y = 0;
             }
          } 
          else {
            if (head.x < 0) head.x = GRID_SIZE - 1;
            if (head.x >= GRID_SIZE) head.x = 0;
            if (head.y < 0) head.y = GRID_SIZE - 1;
            if (head.y >= GRID_SIZE) head.y = 0;
          }
        }

        if (!isInvincible && checkSelfCollision(head, state.snake)) {
          if (state.mode === 'chill') {
             // Chill mode - no death on tail
          } 
          else {
            state.isRunning = false;
            playSound('GAMEOVER');
            if (window.navigator.vibrate) window.navigator.vibrate(200);
            setGameOver(true);
            return;
          }
        }

        const newSnake = [head, ...state.snake];
        const isMagnetActive = state.activeEffects.some(e => e.type === 'MAGNET');
        
        const distToFood = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
        const shouldEatFood = positionsEqual(head, food) || (isMagnetActive && distToFood <= 3);

        if (shouldEatFood) {
          if (window.navigator.vibrate) window.navigator.vibrate(50);
          if (state.mode === 'walls') state.blitzEndTime += 1000; 

          setApplesCollected(prev => prev + 1);

          let currentCombo = 1;
          if (now - state.lastAppleTime < 3000) {
            currentCombo = combo + 1;
            setCombo(currentCombo);
            setMaxCombo(prev => Math.max(prev, currentCombo));
            if (currentCombo === 3) playSound('COMBO');
          } else {
            setCombo(1);
          }
          state.lastAppleTime = now; 

          let comboMultiplier = 1;
          if (currentCombo > 2) comboMultiplier = 1 + (currentCombo - 2) * 0.5;
          const basePoints = 10;
          const pts = Math.floor(basePoints * state.scoreMultiplier * comboMultiplier);
          setScore(s => s + pts);

          if (state.mode === 'classic') {
             const newSpeed = Math.max(50, state.speed - 1);
             state.speed = newSpeed;
             setCurrentSpeed(newSpeed);
          }

          const randomFruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
          setFood({ ...getRandomPosition(newSnake), type: randomFruit });

          if (!gamePowerUpItem) {
             let chance = 0;
             let allowedTypes = [];
             if (state.mode === 'walls') {
               chance = 0.4;
               allowedTypes = ['FREEZE', 'SCORE_X2', 'SPEED', 'SHIELD', 'MAGNET'];
             } else if (state.mode === 'classic') {
               chance = 0.15;
               allowedTypes = ['SPEED', 'SCORE_X2', 'MAGNET']; 
             } else if (state.mode === 'chill') {
               chance = 0.3;
               allowedTypes = ['SPEED', 'SCORE_X2', 'MAGNET']; 
             }
             if (Math.random() < chance && allowedTypes.length > 0) {
               const key = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
               const pConfig = POWERUP_TYPES[key];
               setGamePowerUpItem({ ...getRandomPosition(newSnake), ...pConfig });
             }
          }
        } 
        else if (gamePowerUpItem) {
           const distToPowerUp = Math.abs(head.x - gamePowerUpItem.x) + Math.abs(head.y - gamePowerUpItem.y);
           const shouldCollectPowerUp = positionsEqual(head, gamePowerUpItem) || (isMagnetActive && distToPowerUp <= 3);

           if (shouldCollectPowerUp) {
             activatePowerUp(gamePowerUpItem);
             setGamePowerUpItem(null);
           } else {
             newSnake.pop();
           }
        }
        else {
          newSnake.pop();
        }
        
        state.snake = newSnake;
        state.lastMoveTime = timestamp;
        setSnake(newSnake);
      }
      requestID = requestAnimationFrame(loop);
    };

    requestID = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestID);
  }, [gameOver, food, gamePowerUpItem, combo, isPaused]);

  return {
    snake, food, score, applesCollected, gameOver, activePowerUps, gamePowerUpItem, 
    combo, maxCombo, timeLeft, currentSpeed,
    startGame, resetGame, changeDirection,
    snakeDirection: gameState.current.direction
  
  };
};