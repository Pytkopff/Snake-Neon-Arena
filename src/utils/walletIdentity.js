const ADJECTIVES = [
  'Neon', 'Electric', 'Cyber', 'Cosmic', 'Turbo', 'Quantum', 'Pixel', 'Plasma',
  'Chrome', 'Nova', 'Orbit', 'Pulse', 'Vivid', 'Hyper', 'Solar', 'Lunar'
];

const ANIMALS = [
  'Snake', 'Viper', 'Cobra', 'Python', 'Dragon', 'Falcon', 'Wolf', 'Tiger',
  'Panther', 'Raven', 'Fox', 'Hawk', 'Jaguar', 'Shark', 'Mantis', 'Leopard'
];

const hashString = (input) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
};

export const generateWalletPseudonym = (address) => {
  const seed = hashString(String(address).toLowerCase());
  const adjectiveIndex = ADJECTIVES.length > 0 ? seed % ADJECTIVES.length : -1;
  const animalIndex = ANIMALS.length > 0 ? (seed >>> 8) % ANIMALS.length : -1;
  const adjective = ADJECTIVES[adjectiveIndex] || 'Player';
  const animal = ANIMALS[animalIndex] || 'Snake';
  const code = (seed ^ (seed >>> 16)).toString(16).slice(-4).toUpperCase().padStart(4, '0');
  return `${adjective} ${animal} #${code}`;
};

export const getDefaultWalletAvatar = (address) =>
  `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${address}&backgroundColor=0a0e27`;
