// src/utils/constants.js

export const GRID_SIZE = 20;
export const INITIAL_SPEED = 150;

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

export const FRUITS = [
  { type: 'APPLE', color: '#ff3333', emoji: '🍎', points: 10 },
  { type: 'BANANA', color: '#ffe135', emoji: '🍌', points: 15 },
  { type: 'GRAPE', color: '#bc98f3', emoji: '🍇', points: 20 },
];

export const POWERUP_TYPES = {
  SPEED: { id: 'speed', type: 'SPEED', emoji: '⚡', color: '#FFD700', duration: 5000 },
  SCORE_X2: { id: 'score_x2', type: 'SCORE_X2', emoji: '⭐', color: '#FFA500', duration: 10000 },
  SHIELD: { id: 'shield', type: 'SHIELD', emoji: '🛡️', color: '#00FF00', duration: 5000 },
  FREEZE: { id: 'freeze', type: 'FREEZE', emoji: '❄️', color: '#00FFFF', duration: 5000 },
  MAGNET: { id: 'magnet', type: 'MAGNET', emoji: '🧲', color: '#9D4EDD', duration: 8000 }, 
};

// --- SKINY (Tylko wygląd) ---
export const SKINS = [
  { 
    id: 'default', 
    name: 'Neon Cyan', 
    color: ['#00F0FF', '#0099FF'], 
    glow: '0 0 20px #00F0FF',
  },
  { 
    id: 'punk', 
    name: 'Cyber Punk', 
    color: ['#FF00FF', '#9D4EDD'], 
    glow: '0 0 25px #FF00FF, inset 0 0 10px #9D4EDD', 
  },
  { 
    id: 'toxic', 
    name: 'Toxic Waste', 
    color: ['#39FF14', '#008000'], 
    glow: '0 0 20px #39FF14, 0 0 40px #39FF14', 
  },
  { 
    id: 'plasma', 
    name: 'Plasma Storm', 
    color: ['#FF4D4D', '#FF0000'], 
    glow: '0 0 30px #FF0000',
  },
  { 
    id: 'galaxy', 
    name: 'Galaxy Void', 
    color: ['#FFFFFF', '#000000'], 
    glow: '0 0 15px #FFFFFF, inset 0 0 5px #000000',
  },
  { 
    id: 'gold', 
    name: 'Golden Viper', 
    color: ['#FFD700', '#FDB931'], 
    glow: '0 0 25px #FFD700, inset 0 0 10px #FFFF00', 
  },
];

// --- NOWOŚĆ: MISJE (Logika) ---
// type: 'games' | 'apples' | 'score'
export const MISSIONS = [
  // --- TIER 1: ONBOARDING ---
  {
    id: 'm_newbie',
    title: 'Hello World',
    desc: 'Play your first game',
    type: 'games',
    target: 1,
    rewardType: 'badge',
    rewardId: 'badge_rookie'
  },
  {
    id: 'm_classic_novice',
    title: 'Neon Rookie',
    desc: 'Score 200 in Classic Mode',
    type: 'score',
    mode: 'classic',
    target: 200,
    rewardType: 'skin',
    rewardId: 'punk'
  },
  {
    id: 'm_blitz_survivor',
    title: 'Speed Demon',
    desc: 'Score 300 in Time Blitz',
    type: 'score',
    mode: 'walls',
    target: 300,
    rewardType: 'badge',
    rewardId: 'badge_speed'
  },

  // --- TIER 2: CHALLENGE ---
  {
    id: 'm_zen_master',
    title: 'Zen Master',
    desc: 'Score 2000 in Zen Flow',
    type: 'score',
    mode: 'chill',
    target: 2000,
    rewardType: 'skin',
    rewardId: 'toxic'
  },
  {
    id: 'm_classic_pro',
    title: 'Classic Pro',
    desc: 'Score 800 in Classic Mode',
    type: 'score',
    mode: 'classic',
    target: 800,
    rewardType: 'skin',
    rewardId: 'plasma'
  },
  {
    id: 'm_apple_eater',
    title: 'Vitamin C',
    desc: 'Eat 1000 Apples (Total)',
    type: 'apples',
    target: 1000,
    rewardType: 'skin',
    rewardId: 'galaxy'
  },

  // --- TIER 3: GODLIKE ---
  {
    id: 'm_godlike',
    title: 'GODLIKE',
    desc: 'Eat 2000 Apples (Total)',
    type: 'apples',
    target: 2000,
    rewardType: 'skin',
    rewardId: 'gold'
  },

  // --- TIER 4: SUPPORTER (To dodajemy) ---
  {
    id: 'm_supporter',           // To ID musi pasować do kodu w React (i pasuje)
    title: 'Supporter Badge',    // Tytuł kafelka
    desc: 'Play 1 game & Support Dev', // Opis
    type: 'games',               // Wystarczy zagrać...
    target: 1,                   // ...tylko 1 raz
    rewardType: 'badge',         // Typ badge oznacza, że to NFT
    rewardId: 'supporter_nft'    // ID techniczne (bez znaczenia, ważne jest id misji)
  }
];

export const SOUNDS = {
  // ✅ TE LINKI DZIAŁAJĄ NA 100% (Sprawdzone):
  EAT: 'https://commondatastorage.googleapis.com/codeskulptor-assets/week7-bounce.m4a',
  POWERUP: 'https://commondatastorage.googleapis.com/codeskulptor-assets/week7-brrring.m4a',
  GAMEOVER: 'https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/explosion.mp3',
  UNLOCK: 'https://commondatastorage.googleapis.com/codeskulptor-assets/week7-brrring.m4a', // Zmienione z soundtrack.mp3 na bardziej neonowy dźwięk
  COMBO: 'https://commondatastorage.googleapis.com/codeskulptor-assets/week7-brrring.m4a', // Tymczasowo to samo co powerup

  // Muzyka (Pixabay zazwyczaj nie blokuje, więc może zostać)
 CHILL_MUSIC: 'https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg',  
};

export const PARTICLE_LIFETIME = 1000;

export const STORAGE_KEYS = {
  BEST_SCORE: 'snake_best_score',
  LEADERBOARD: 'snake_leaderboard',
  LEADERBOARD_60S: 'snake_leaderboard_60s',
  LEADERBOARD_CHILL: 'snake_leaderboard_chill',
  TOTAL_APPLES: 'snake_total_apples',     
  TOTAL_GAMES: 'snake_total_games',       
  UNLOCKED_SKINS: 'snake_unlocked_skins', 
  SELECTED_SKIN: 'snake_selected_skin'    
};