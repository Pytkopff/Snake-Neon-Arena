import { Howl, Howler } from 'howler';
import { SOUNDS } from './constants';

class SoundManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.isMuted = false;
    this.initialized = false;
    
    // 🔥 MASZYNA STANÓW: Oddzielamy zamiar (shouldPlay) od rzeczywistości (isPlaying)
    this.musicState = {
      shouldPlay: false,  // Czy logika gry chce muzyki?
      isPlaying: false,   // Czy muzyka faktycznie leci?
      pendingPlay: false  // Czy czekamy na odblokowanie audio?
    };
  }

  init() {
    if (this.initialized) return;

    // SFX
    this.sounds['eat'] = new Howl({ src: [SOUNDS.EAT], volume: 0.5 });
    this.sounds['powerup'] = new Howl({ src: [SOUNDS.POWERUP], volume: 0.7 });
    this.sounds['unlock'] = new Howl({ src: [SOUNDS.UNLOCK], volume: 0.6 });
    this.sounds['click'] = new Howl({ src: [SOUNDS.EAT], volume: 0.2, rate: 2.0 });

    // MUSIC - Ustawienia pod Mobile
    this.music = new Howl({
      src: [SOUNDS.CHILL_MUSIC],
      loop: true,
      volume: 0.3,
      html5: true,  // ✅ KLUCZOWE DLA MOBILE: Używa natywnego <audio>, mniej lagów
      preload: 'metadata', // Ładujemy tylko metadane na start
      onplay: () => {
        this.musicState.isPlaying = true;
        this.musicState.pendingPlay = false;
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
        // Automatyczna próba naprawy po odblokowaniu (częste na iOS)
        this.music.once('unlock', () => {
          if (this.musicState.shouldPlay) {
            this.music.play();
          }
        });
      }
    });

    this.initialized = true;
  }

  // ✅ METODA KRYTYCZNA: Wywoływana przy kliknięciu, żeby odblokować audio
  unlockAudioContext() {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().then(() => {
        // console.log('Audio Context unlocked'); // Debug
        // Jeśli mieliśmy zamiar grać, a czekaliśmy na unlock - GRAJ TERAZ
        if (this.musicState.pendingPlay && this.musicState.shouldPlay) {
          this._attemptMusicPlay();
        }
      }).catch(err => {
        console.error('Audio unlock failed:', err);
      });
    }
  }

  play(id) {
    if (this.isMuted || !this.sounds[id]) return;
    
    // SFX też korzystają z odblokowania przy pierwszym kliknięciu
    this.unlockAudioContext();
    this.sounds[id].play();
  }

  // ✅ METODA WEWNĘTRZNA: Faktyczna logika odpalania muzyki
  _attemptMusicPlay() {
    if (!this.music || this.isMuted) {
      this.musicState.pendingPlay = false;
      return;
    }

    // Jeśli już gra, oznaczamy stan i wychodzimy (nie dublujemy!)
    if (this.music.playing()) {
      this.musicState.isPlaying = true;
      this.musicState.pendingPlay = false;
      return;
    }

    // Sprawdzamy czy AudioContext jest gotowy
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      this.musicState.pendingPlay = true;
      return; // Spróbujemy ponownie po unlocku
    }

    // Czyścimy stan i gramy
    this.music.stop();
    this.music.volume(0.3);
    this.music.play();
  }

  // ✅ PUBLICZNE API: Ustawiamy ZAMIAR (używane w useEffect)
  setMusicIntent(shouldPlay) {
    this.musicState.shouldPlay = shouldPlay;

    if (shouldPlay) {
      this._attemptMusicPlay();
    } else {
      this.stopMusic();
    }
  }

  // ✅ PUBLICZNE API: Wymuś start przy kliknięciu (używane w handleStart)
  startMusicOnUserGesture() {
    // TO MUSI BYĆ WYWOŁANE SYNCHRONICZNIE PRZY KLIKNIĘCIU
    this.unlockAudioContext();
    
    this.musicState.shouldPlay = true;
    
    // Dajemy malutki timeout, żeby unlock zdążył zadziałać
    setTimeout(() => {
      this._attemptMusicPlay();
    }, 50);
  }

  stopMusic() {
    if (!this.music) return;
    
    this.musicState.shouldPlay = false;
    this.musicState.pendingPlay = false;
    
    if (this.music.playing()) {
      this.music.stop();
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    Howler.mute(muted);
    
    // Jeśli odmutujemy, a muzyka miała grać - wznów ją
    if (!muted && this.musicState.shouldPlay && !this.music.playing()) {
      this._attemptMusicPlay();
    }
  }
}

export default new SoundManager();