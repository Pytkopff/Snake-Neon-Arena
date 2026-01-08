import { Howl, Howler } from 'howler';
import { SOUNDS } from './constants';

class SoundManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.isMuted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // SFX
    this.sounds['eat'] = new Howl({ src: [SOUNDS.EAT], volume: 0.5 });
    this.sounds['powerup'] = new Howl({ src: [SOUNDS.POWERUP], volume: 0.7 });
    this.sounds['unlock'] = new Howl({ src: [SOUNDS.UNLOCK], volume: 0.6 });
    this.sounds['click'] = new Howl({ src: [SOUNDS.EAT], volume: 0.2, rate: 2.0 });

    // MUSIC
    this.music = new Howl({
      src: [SOUNDS.CHILL_MUSIC],
      loop: true,
      volume: 0.3, 
      html5: false,
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

  // 🔥 NOWOŚĆ: parametr force
  playMusic(force = false) {
    this.unlock(); // Zawsze próbuj obudzić audio

    if (this.isMuted || !this.music) return;

    // JEŚLI NIE WYMUSZAMY (useEffect):
    // Sprawdzamy czy gra. Jeśli tak -> nic nie rób (ochrona przed duchem).
    if (!force && this.music.playing()) {
        return; 
    }

    // JEŚLI WYMUSZAMY (Kliknięcie START) LUB NIE GRA:
    // Resetujemy i odpalamy.
    this.music.stop(); 
    this.music.volume(0.3);
    this.music.play();
  }

  stopMusic() {
    if (!this.music) return;
    this.music.stop();
  }

  setMute(muted) {
    this.isMuted = muted;
    Howler.mute(muted);
    // Usunęliśmy stąd auto-play, żeby nie robił pętli
  }
}

export default new SoundManager();