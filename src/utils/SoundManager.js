import { Howl, Howler } from 'howler';
import { SOUNDS } from './constants';

class SoundManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.isMuted = false;
    this.initialized = false;
    this.fadeTimer = null;
    this.currentMusicId = null; // 🔥 Śledzimy ID konkretnego odtworzenia
  }

  init() {
    if (this.initialized) return;

    this.sounds['eat'] = new Howl({ src: [SOUNDS.EAT], volume: 0.5 });
    this.sounds['powerup'] = new Howl({ src: [SOUNDS.POWERUP], volume: 0.7 });
    this.sounds['unlock'] = new Howl({ src: [SOUNDS.UNLOCK], volume: 0.6 });
    this.sounds['click'] = new Howl({ src: [SOUNDS.EAT], volume: 0.2, rate: 2.0 });

    this.music = new Howl({
      src: [SOUNDS.CHILL_MUSIC],
      loop: true,
      volume: 0.3, 
      html5: false, // Ważne: false dla pętli bez lagów
      preload: true,
    });

    this.initialized = true;
  }

  unlock() {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume();
    }
  }

  play(id) {
    if (this.isMuted || !this.sounds[id]) return;
    this.sounds[id].play();
  }

  playMusic() {
    this.unlock(); // Zawsze próbujemy obudzić audio

    if (this.isMuted || !this.music) return;

    // 🔥🔥🔥 FIX NA OBCY DŹWIĘK 🔥🔥🔥
    // Jeśli muzyka już gra, NIE RÓB NIC.
    // To zapobiega nakładaniu się ścieżki z 'handleStart' i 'useEffect'.
    if (this.music.playing()) {
        return; 
    }

    // Dla pewności: STOPUJEMY wszystko przed startem.
    // To usuwa wszelkie "duchy" z poprzednich sesji.
    this.music.stop(); 

    this.music.volume(0.3);
    this.currentMusicId = this.music.play();
  }

  stopMusic() {
    if (!this.music) return;

    // Natychmiastowe zatrzymanie bez fade-out (bezpieczniejsze przy glitchach)
    this.music.stop();
  }

  setMute(muted) {
    this.isMuted = muted;
    Howler.mute(muted);
    
    // Jeśli odmutujemy, a gra trwa - wznów muzykę
    if (!muted && this.music && !this.music.playing()) {
        this.playMusic();
    }
  }
}

export default new SoundManager();