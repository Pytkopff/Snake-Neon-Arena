import { Howl, Howler } from 'howler';
import { SOUNDS } from './constants';

class SoundManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.isMuted = false;
    this.initialized = false;
    this.fadeTimer = null;
  }

  init() {
    if (this.initialized) return;

    // SFX
    this.sounds['eat'] = new Howl({ src: [SOUNDS.EAT], volume: 0.5 });
    this.sounds['powerup'] = new Howl({ src: [SOUNDS.POWERUP], volume: 0.7 });
    this.sounds['unlock'] = new Howl({ src: [SOUNDS.UNLOCK], volume: 0.6 });
    this.sounds['click'] = new Howl({ src: [SOUNDS.EAT], volume: 0.2, rate: 2.0 });

    // MUSIC
    // 🔥 ZMIANA: Startujemy od razu z normalną głośnością (0.3), nie od zera!
    // html5: false jest kluczowe dla mobile (zapobiega lagom i problemom z streamowaniem)
    this.music = new Howl({
      src: [SOUNDS.CHILL_MUSIC],
      loop: true,
      volume: 0.3, 
      html5: false,
      preload: true,
    });

    this.initialized = true;
  }

  // 🔥 NOWA METODA: Brutalne budzenie audio
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
    // Zawsze próbujemy obudzić kontekst przed graniem
    this.unlock();

    if (this.isMuted || !this.music) return;
    
    // Czyścimy stare fadery
    if (this.fadeTimer) clearTimeout(this.fadeTimer);

    // Jeśli już gra, upewnij się tylko co do głośności
    if (this.music.playing()) {
       this.music.volume(0.3);
       return;
    }

    // 🔥 ZMIANA: Gramy natychmiast, bez fade-in.
    // To zapobiega "gubieniu" dźwięku przez przeglądarki mobilne.
    this.music.volume(0.3);
    this.music.play();
  }

  stopMusic() {
    if (!this.music || !this.music.playing()) return;

    if (this.fadeTimer) clearTimeout(this.fadeTimer);

    // Fade-out przy wyłączaniu jest bezpieczny
    const currentVol = this.music.volume();
    this.music.fade(currentVol, 0, 800);

    this.fadeTimer = setTimeout(() => {
      this.music.pause();
    }, 800);
  }

  setMute(muted) {
    this.isMuted = muted;
    Howler.mute(muted);
    
    // Jeśli odmutujemy, a powinniśmy grać - przywróć głośność
    if (!muted && this.music && this.music.playing()) {
        this.music.fade(0, 0.3, 500);
    }
  }
}

export default new SoundManager();