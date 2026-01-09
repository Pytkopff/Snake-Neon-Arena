import { Howl, Howler } from 'howler';
import { SOUNDS } from './constants';

class SoundManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.isMuted = false;
    this.initialized = false;
    this.lastPlay = {};
    // 🔥 NOWOŚĆ: Magazyn czasu dla Debounce'a
    this.lastPlayTime = {};

    this.musicState = {
      shouldPlay: false,  // Intencja (czy gra ma grać?)
      isPlaying: false,   // Rzeczywistość (czy słychać?)
      pendingPlay: false  // Czy czekamy na unlock?
    };
  }

  init() {
    if (this.initialized) return;

    // SFX - ZMIANY TUTAJ (dodano pool: 1)
    // pool: 1 sprawia, że Howler nie może grać dwóch tych samych dźwięków naraz
    this.sounds['eat'] = new Howl({ src: [SOUNDS.EAT], volume: 0.5, pool: 1 });
    this.sounds['powerup'] = new Howl({ src: [SOUNDS.POWERUP], volume: 0.6, pool: 1 });
    this.sounds['unlock'] = new Howl({ src: [SOUNDS.UNLOCK], volume: 0.6, pool: 1 });
    this.sounds['click'] = new Howl({ src: [SOUNDS.EAT], volume: 0.2, rate: 2.0, pool: 1 });

    // MUSIC (Bez zmian, tu logika jest dobra)
    this.music = new Howl({
      src: [SOUNDS.CHILL_MUSIC],
      loop: true,
      volume: 0.3,
      html5: true,
      preload: 'metadata',
      onplay: () => {
        this.musicState.isPlaying = true;
        this.musicState.pendingPlay = false;
      },
      onpause: () => {
        this.musicState.isPlaying = false;
      },
      onstop: () => {
        this.musicState.isPlaying = false;
      },
      onend: () => {
        this.musicState.isPlaying = false;
      },
      onloaderror: (id, err) => {
        console.error('Music load error:', err);
        this.musicState.pendingPlay = false;
      },
      onplayerror: (id, err) => {
        console.error('Music play error:', err);
        this.music.once('unlock', () => {
          if (this.musicState.shouldPlay) {
            this.music.play();
          }
        });
      }
    });

    this.initialized = true;
  }

  unlockAudioContext() {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().then(() => {
        if (this.musicState.pendingPlay && this.musicState.shouldPlay) {
          this._attemptMusicPlay();
        }
      }).catch(err => {
        console.error('Audio unlock failed:', err);
      });
    }
  }

  // 🔥 CAŁKOWICIE NOWA METODA PLAY (Fix Dźwięku Ducha)
  play(id) {
  if (this.isMuted || !this.sounds[id]) return;

  const now = performance.now();
  // Blokada: jeśli ten sam dźwięk chce zagrać szybciej niż co 60ms - ignoruj
  if (this.lastPlay[id] && now - this.lastPlay[id] < 60) return;

  this.lastPlay[id] = now;
  this.unlockAudioContext();
  
  // Opcjonalnie dodaj stop(), aby uniknąć nakładania się ogonów dźwięku
  this.sounds[id].stop(); 
  this.sounds[id].play();
}

  // ✅ METODA WEWNĘTRZNA (Bez zmian)
  _attemptMusicPlay() {
    if (!this.music || this.isMuted) {
      this.musicState.pendingPlay = false;
      return;
    }

    if (this.music.playing()) {
      this.musicState.isPlaying = true;
      this.musicState.pendingPlay = false;
      return;
    }

    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      this.musicState.pendingPlay = true;
      return;
    }

    this.music.volume(0.3);
    this.music.play();
  }

  setMusicIntent(shouldPlay) {
    this.musicState.shouldPlay = shouldPlay;

    if (shouldPlay) {
      this._attemptMusicPlay();
    } else {
      this.stopMusic();
    }
  }

  startMusicOnUserGesture() {
    this.unlockAudioContext();
    this.musicState.shouldPlay = true;
    setTimeout(() => {
      this._attemptMusicPlay();
    }, 50);
  }

  stopMusic() {
    if (!this.music) return;
    
    this.musicState.shouldPlay = false;
    this.musicState.pendingPlay = false;
    
    if (this.music.playing()) {
      this.music.pause();
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    Howler.mute(muted);
    
    if (!muted && this.musicState.shouldPlay && !this.music.playing()) {
      this._attemptMusicPlay();
    }
  }
}

export default new SoundManager();