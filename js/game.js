
"use strict";

/* ===============================================
   GAME CONFIGURATION & CONSTANTS
   =============================================== */
const CONFIG = {
  CANVAS_WIDTH: 420,
  CANVAS_HEIGHT: 640,
  
  DIFFICULTIES: {
    EASY: {
      name: "FÁCIL",
      enemySpeedMult: 0.7,
      enemyHealthMult: 0.7,
      bossHealthMult: 0.6,
      enemyFireRate: 0.4,
      playerDamage: 1.3,
      powerupChance: 0.25,
      description: "Para iniciantes - Inimigos mais fracos, mais power-ups"
    },
    NORMAL: {
      name: "NORMAL",
      enemySpeedMult: 1.0,
      enemyHealthMult: 1.0,
      bossHealthMult: 1.0,
      enemyFireRate: 0.6,
      playerDamage: 1.0,
      powerupChance: 0.18,
      description: "Experiência equilibrada - Desafio padrão"
    },
    HARD: {
      name: "DIFÍCIL",
      enemySpeedMult: 1.4,
      enemyHealthMult: 1.5,
      bossHealthMult: 1.8,
      enemyFireRate: 0.85,
      playerDamage: 0.8,
      powerupChance: 0.12,
      description: "Para veteranos - Inimigos mais rápidos e resistentes"
    },
    NIGHTMARE: {
      name: "PESADELO",
      enemySpeedMult: 1.8,
      enemyHealthMult: 2.0,
      bossHealthMult: 2.5,
      enemyFireRate: 1.0,
      playerDamage: 0.7,
      powerupChance: 0.08,
      description: "Modo extremo - Apenas para os melhores pilotos!"
    }
  },
  
  // Full stage definitions are loaded on demand by StageLoader.
  LEVELS: {},
  
  MAX_LEVEL: 10,
  KILLS_PER_BOSS: 20,
  COMBO_TIMEOUT: 180,
  INVULN_FRAMES: 120,

  // Gameplay feel
  PLAYER_ACCEL: 0.88,
  PLAYER_FRICTION: 0.80,
  PLAYER_MAX_SPEED: 5.6,
  PLAYER_FOCUS_SPEED: 3.0,
  DASH_SPEED: 12.5,
  DASH_FRAMES: 8,
  DASH_COOLDOWN: 90,
  OVERDRIVE_FRAMES: 480,

  // Stage transition pacing (~2.7 s at 60 FPS)
  STAGE_CLEAR_FRAMES: 42,
  STAGE_FADE_OUT_FRAMES: 24,
  STAGE_BLACK_FRAMES: 10,
  STAGE_FADE_IN_FRAMES: 28,
  STAGE_INTRO_FRAMES: 58
};

/* ===============================================
   AUDIO SYSTEM
   =============================================== */
const AudioSystem = {
  enabled: true,
  context: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  currentMusic: null,
  musicVolume: 0.3,
  sfxVolume: 0.15,
  
  init() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master gain
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      
      // Music channel
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);
      
      // SFX channel
      this.sfxGain = this.context.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
      
    } catch(e) {
      console.warn("Web Audio não suportado");
      this.enabled = false;
    }
  },
  
  // Resume audio context (needed for iOS/Safari)
  resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  },
  
  // SFX functions
  play(frequency, duration, type = 'sine', volume = 0.1) {
    if (!this.enabled || !this.context) return;
    
    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
      osc.stop(this.context.currentTime + duration);
    } catch(e) {
      console.warn("Erro ao tocar som");
    }
  },
  
  shoot() {
    this.play(800, 0.1, 'square', 0.05);
  },
  
  explosion() {
    this.play(100, 0.3, 'sawtooth', 0.15);
  },
  
  powerup() {
    this.play(600, 0.2, 'sine', 0.1);
    setTimeout(() => this.play(800, 0.2, 'sine', 0.1), 100);
  },
  
  hit() {
    this.play(200, 0.15, 'square', 0.1);
  },
  
  bossExplode() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.play(80 - i * 10, 0.3, 'sawtooth', 0.2), i * 100);
    }
  },
  
  // Music system
  playMusic(type) {
    if (!this.enabled || !this.context) return;
    
    this.stopMusic();
    
    if (type === 'menu') {
      this.currentMusic = new MenuMusic(this.context, this.musicGain);
    } else if (type === 'level1') {
      this.currentMusic = new Level1Music(this.context, this.musicGain);
    } else if (type === 'level2') {
      this.currentMusic = new Level2Music(this.context, this.musicGain);
    } else if (type === 'level3') {
      this.currentMusic = new Level3Music(this.context, this.musicGain);
    } else if (type === 'level4') {
      this.currentMusic = new Level4Music(this.context, this.musicGain);
    } else if (type === 'boss') {
      this.currentMusic = new BossMusic(this.context, this.musicGain);
    } else if (type === 'victory') {
      this.currentMusic = new VictoryMusic(this.context, this.musicGain);
    }
    
    if (this.currentMusic) {
      this.currentMusic.start();
    }
  },
  
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
    }
  },
  
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopMusic();
    }
    return this.enabled;
  }
};

/* ===============================================
   MUSIC CLASSES - Procedural Music Generator
   =============================================== */

// Base Music Class
class ProceduralMusic {
  constructor(context, destination) {
    this.context = context;
    this.destination = destination;
    this.oscillators = [];
    this.gains = [];
    this.isPlaying = false;
  }
  
  createOscillator(freq, type, volume, detune = 0) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.value = volume;
    
    osc.connect(gain);
    gain.connect(this.destination);
    
    this.oscillators.push(osc);
    this.gains.push(gain);
    
    return { osc, gain };
  }
  
  stop() {
    this.isPlaying = false;
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    this.oscillators = [];
    this.gains = [];
  }
}

// Menu Music - Ambient atmospheric
class MenuMusic extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    const now = this.context.currentTime;
    
    // Ambient pad
    const pad1 = this.createOscillator(110, 'sine', 0.03);
    const pad2 = this.createOscillator(165, 'sine', 0.02, 5);
    const pad3 = this.createOscillator(220, 'sine', 0.02, -5);
    
    pad1.osc.start(now);
    pad2.osc.start(now);
    pad3.osc.start(now);
    
    // Arpeggio
    this.playArpeggio([110, 138.59, 164.81, 220], 0.8);
  }
  
  playArpeggio(notes, beatLength) {
    if (!this.isPlaying) return;
    
    let time = this.context.currentTime;
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const note = this.context.createOscillator();
        const noteGain = this.context.createGain();
        
        note.type = 'triangle';
        note.frequency.value = freq;
        noteGain.gain.value = 0.04;
        
        note.connect(noteGain);
        noteGain.connect(this.destination);
        
        note.start();
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.5);
        note.stop(this.context.currentTime + 0.5);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playArpeggio(notes, beatLength), notes.length * beatLength * 1000);
  }
}

// Level 1 Music - Energetic synthwave
class Level1Music extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    const bpm = 140;
    const beatLength = 60 / bpm;
    
    // Bass line
    this.playBassline([110, 110, 146.83, 110], beatLength);
    
    // Lead melody
    setTimeout(() => {
      this.playMelody([
        440, 493.88, 523.25, 587.33,
        523.25, 493.88, 440, 392
      ], beatLength / 2);
    }, beatLength * 4 * 1000);
    
    // Kick drum simulation
    this.playKick(beatLength);
  }
  
  playBassline(notes, beatLength) {
    if (!this.isPlaying) return;
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const bass = this.context.createOscillator();
        const bassGain = this.context.createGain();
        
        bass.type = 'sawtooth';
        bass.frequency.value = freq;
        bassGain.gain.value = 0.08;
        
        bass.connect(bassGain);
        bassGain.connect(this.destination);
        
        bass.start();
        bassGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength);
        bass.stop(this.context.currentTime + beatLength);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playBassline(notes, beatLength), notes.length * beatLength * 1000);
  }
  
  playMelody(notes, beatLength) {
    if (!this.isPlaying) return;
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const lead = this.context.createOscillator();
        const leadGain = this.context.createGain();
        
        lead.type = 'square';
        lead.frequency.value = freq;
        leadGain.gain.value = 0.03;
        
        lead.connect(leadGain);
        leadGain.connect(this.destination);
        
        lead.start();
        leadGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength * 1.5);
        lead.stop(this.context.currentTime + beatLength * 1.5);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playMelody(notes, beatLength), notes.length * beatLength * 1000);
  }
  
  playKick(beatLength) {
    if (!this.isPlaying) return;
    
    const kick = this.context.createOscillator();
    const kickGain = this.context.createGain();
    
    kick.type = 'sine';
    kick.frequency.value = 80;
    kickGain.gain.value = 0.15;
    
    kick.connect(kickGain);
    kickGain.connect(this.destination);
    
    kick.start();
    kick.frequency.exponentialRampToValueAtTime(40, this.context.currentTime + 0.1);
    kickGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);
    kick.stop(this.context.currentTime + 0.3);
    
    setTimeout(() => this.playKick(beatLength), beatLength * 1000);
  }
}

// Level 2 Music - Desert/Middle Eastern vibe
class Level2Music extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    const bpm = 130;
    const beatLength = 60 / bpm;
    
    // Drone bass
    const drone = this.createOscillator(73.42, 'sawtooth', 0.06); // D
    drone.osc.start();
    
    // Exotic scale melody
    this.playExoticMelody([
      293.66, 311.13, 349.23, 369.99, 392, 415.30, 466.16, 493.88
    ], beatLength / 1.5);
    
    // Percussion
    this.playPercussion(beatLength);
  }
  
  playExoticMelody(notes, beatLength) {
    if (!this.isPlaying) return;
    
    const pattern = [0, 2, 4, 5, 4, 2, 3, 1, 0];
    
    pattern.forEach((noteIndex, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const note = this.context.createOscillator();
        const noteGain = this.context.createGain();
        
        note.type = 'triangle';
        note.frequency.value = notes[noteIndex];
        noteGain.gain.value = 0.05;
        
        note.connect(noteGain);
        noteGain.connect(this.destination);
        
        note.start();
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength);
        note.stop(this.context.currentTime + beatLength);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playExoticMelody(notes, beatLength), pattern.length * beatLength * 1000);
  }
  
  playPercussion(beatLength) {
    if (!this.isPlaying) return;
    
    // Simple percussion hit
    const perc = this.context.createOscillator();
    const percGain = this.context.createGain();
    
    perc.type = 'square';
    perc.frequency.value = 100;
    percGain.gain.value = 0.08;
    
    perc.connect(percGain);
    percGain.connect(this.destination);
    
    perc.start();
    percGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.1);
    perc.stop(this.context.currentTime + 0.1);
    
    setTimeout(() => this.playPercussion(beatLength), beatLength * 1000);
  }
}

// Level 3 Music - Space ambient
class Level3Music extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    
    // Deep space drone
    const drone1 = this.createOscillator(55, 'sine', 0.04);
    const drone2 = this.createOscillator(82.5, 'sine', 0.03, 8);
    const drone3 = this.createOscillator(110, 'sine', 0.02, -8);
    
    drone1.osc.start();
    drone2.osc.start();
    drone3.osc.start();
    
    // Cosmic bleeps
    this.playCosmicBleeps();
  }
  
  playCosmicBleeps() {
    if (!this.isPlaying) return;
    
    const frequencies = [220, 277.18, 329.63, 440, 554.37];
    const randomFreq = frequencies[Math.floor(Math.random() * frequencies.length)];
    
    const bleep = this.context.createOscillator();
    const bleepGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    
    bleep.type = 'sine';
    bleep.frequency.value = randomFreq;
    bleepGain.gain.value = 0.04;
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    bleep.connect(filter);
    filter.connect(bleepGain);
    bleepGain.connect(this.destination);
    
    bleep.start();
    bleepGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.8);
    bleep.stop(this.context.currentTime + 0.8);
    
    setTimeout(() => this.playCosmicBleeps(), Math.random() * 2000 + 1000);
  }
}

// Level 4 Music - Final level intensity
class Level4Music extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    const bpm = 160;
    const beatLength = 60 / bpm;
    
    // Intense bassline
    this.playIntenseBass([
      65.41, 65.41, 87.31, 65.41,
      73.42, 73.42, 98, 73.42
    ], beatLength);
    
    // Fast arpeggio
    this.playFastArp([261.63, 329.63, 392, 523.25], beatLength / 4);
    
    // Driving kick
    this.playDrivingKick(beatLength / 2);
  }
  
  playIntenseBass(notes, beatLength) {
    if (!this.isPlaying) return;
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const bass = this.context.createOscillator();
        const bassGain = this.context.createGain();
        
        bass.type = 'sawtooth';
        bass.frequency.value = freq;
        bassGain.gain.value = 0.1;
        
        bass.connect(bassGain);
        bassGain.connect(this.destination);
        
        bass.start();
        bassGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength * 0.8);
        bass.stop(this.context.currentTime + beatLength * 0.8);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playIntenseBass(notes, beatLength), notes.length * beatLength * 1000);
  }
  
  playFastArp(notes, beatLength) {
    if (!this.isPlaying) return;
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const arp = this.context.createOscillator();
        const arpGain = this.context.createGain();
        
        arp.type = 'square';
        arp.frequency.value = freq;
        arpGain.gain.value = 0.025;
        
        arp.connect(arpGain);
        arpGain.connect(this.destination);
        
        arp.start();
        arpGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength);
        arp.stop(this.context.currentTime + beatLength);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playFastArp(notes, beatLength), notes.length * beatLength * 1000);
  }
  
  playDrivingKick(beatLength) {
    if (!this.isPlaying) return;
    
    const kick = this.context.createOscillator();
    const kickGain = this.context.createGain();
    
    kick.type = 'sine';
    kick.frequency.value = 90;
    kickGain.gain.value = 0.2;
    
    kick.connect(kickGain);
    kickGain.connect(this.destination);
    
    kick.start();
    kick.frequency.exponentialRampToValueAtTime(30, this.context.currentTime + 0.15);
    kickGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.2);
    kick.stop(this.context.currentTime + 0.2);
    
    setTimeout(() => this.playDrivingKick(beatLength), beatLength * 1000);
  }
}

// Boss Music - Epic battle theme
class BossMusic extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    const bpm = 145;
    const beatLength = 60 / bpm;
    
    // Epic bass
    this.playEpicBass([
      55, 55, 73.42, 82.41,
      55, 55, 65.41, 73.42
    ], beatLength);
    
    // Power chords
    this.playPowerChords(beatLength * 2);
    
    // War drums
    this.playWarDrums(beatLength);
  }
  
  playEpicBass(notes, beatLength) {
    if (!this.isPlaying) return;
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const bass = this.context.createOscillator();
        const bassGain = this.context.createGain();
        const distortion = this.context.createWaveShaper();
        
        bass.type = 'sawtooth';
        bass.frequency.value = freq;
        bassGain.gain.value = 0.12;
        
        bass.connect(bassGain);
        bassGain.connect(this.destination);
        
        bass.start();
        bassGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength);
        bass.stop(this.context.currentTime + beatLength);
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playEpicBass(notes, beatLength), notes.length * beatLength * 1000);
  }
  
  playPowerChords(beatLength) {
    if (!this.isPlaying) return;
    
    const chords = [
      [110, 165, 220],
      [146.83, 220, 293.66]
    ];
    
    chords.forEach((chord, i) => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        chord.forEach(freq => {
          const note = this.context.createOscillator();
          const noteGain = this.context.createGain();
          
          note.type = 'sawtooth';
          note.frequency.value = freq;
          noteGain.gain.value = 0.03;
          
          note.connect(noteGain);
          noteGain.connect(this.destination);
          
          note.start();
          noteGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + beatLength * 0.9);
          note.stop(this.context.currentTime + beatLength * 0.9);
        });
      }, i * beatLength * 1000);
    });
    
    setTimeout(() => this.playPowerChords(beatLength), chords.length * beatLength * 1000);
  }
  
  playWarDrums(beatLength) {
    if (!this.isPlaying) return;
    
    const drum = this.context.createOscillator();
    const drumGain = this.context.createGain();
    
    drum.type = 'sine';
    drum.frequency.value = 100;
    drumGain.gain.value = 0.25;
    
    drum.connect(drumGain);
    drumGain.connect(this.destination);
    
    drum.start();
    drum.frequency.exponentialRampToValueAtTime(35, this.context.currentTime + 0.2);
    drumGain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);
    drum.stop(this.context.currentTime + 0.3);
    
    setTimeout(() => this.playWarDrums(beatLength), beatLength * 1000);
  }
}

// Victory Music - Triumphant fanfare
class VictoryMusic extends ProceduralMusic {
  start() {
    this.isPlaying = true;
    
    // Fanfare melody
    const fanfare = [
      { freq: 523.25, time: 0, duration: 0.3 },
      { freq: 659.25, time: 0.3, duration: 0.3 },
      { freq: 783.99, time: 0.6, duration: 0.3 },
      { freq: 1046.50, time: 0.9, duration: 0.6 },
      { freq: 783.99, time: 1.5, duration: 0.2 },
      { freq: 1046.50, time: 1.7, duration: 0.8 }
    ];
    
    fanfare.forEach(note => {
      setTimeout(() => {
        if (!this.isPlaying) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = note.freq;
        gain.gain.value = 0.08;
        
        osc.connect(gain);
        gain.connect(this.destination);
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + note.duration);
        osc.stop(this.context.currentTime + note.duration);
      }, note.time * 1000);
    });
    
    // Play once, then ambient
    setTimeout(() => {
      if (!this.isPlaying) return;
      const pad = this.createOscillator(261.63, 'sine', 0.04);
      pad.osc.start();
    }, 2500);
  }
}

/* ===============================================
   PARTICLE SYSTEM
   =============================================== */
class Particle {
  constructor(x, y, color, type = "normal") {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;
    this.life = 40;
    this.maxLife = 40;
    this.color = color;
    this.size = Math.random() * 3 + 1;
    this.type = type;
    
    if (type === "spark") {
      this.vx = (Math.random() - 0.5) * 12;
      this.vy = (Math.random() - 0.5) * 12;
      this.life = 20;
      this.maxLife = 20;
    } else if (type === "trail") {
      this.life = 15;
      this.maxLife = 15;
      this.size = 2;
    }
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.vx *= 0.95;
    this.vy *= 0.95;
    if (this.type === "spark") {
      this.vy += 0.2;
    }
  }
  
  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    
    if (this.type === "spark") {
      ctx.fillRect(this.x - 1, this.y - 1, 3, 3);
      ctx.fillStyle = "#fff";
      ctx.fillRect(this.x, this.y, 1, 1);
    } else {
      ctx.fillRect(this.x, this.y, this.size, this.size);
    }
    
    ctx.globalAlpha = 1;
  }
}

/* ===============================================
   FLOATING TEXT
   =============================================== */
class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 60;
    this.maxLife = 60;
    this.vy = -2;
  }
  
  update() {
    this.y += this.vy;
    this.life--;
    this.vy *= 0.95;
  }
  
  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

/* ===============================================
   GAME STATE MANAGER
   =============================================== */
const Game = {
  canvas: null,
  ctx: null,
  state: "menu",
  difficulty: "NORMAL",
  paused: false,
  
  // Game data
  score: 0,
  hiScore: 0,
  level: 1,
  levelKills: 0,
  totalKills: 0,
  maxComboReached: 0,
  
  // Entities
  player: null,
  bullets: [],
  enemies: [],
  enemyBullets: [],
  powerups: [],
  particles: [],
  floatingTexts: [],
  boss: null,
  
  // Systems
  combo: { count: 0, timer: 0, maxTime: CONFIG.COMBO_TIMEOUT, multiplier: 1 },
  screenShake: { x: 0, y: 0, intensity: 0 },
  frameCount: 0,
  spawnTimer: 30,
  dashHeld: false,
  
  // Menu
  menuParticles: [],
  titleY: -80,
  titleVy: 0,
  transition: 0,
  transitionDir: 0,
  showLevel: 0,
  stageTransition: null,
  warpStars: [],
  
  // Background
  stars: [],
  buildings: [],
  
  // Achievements
  achievements: {
    firstKill: false,
    firstBoss: false,
    weapon3: false,
    score10k: false,
    score50k: false,
    combo50: false,
    perfect: false,
    nightmare: false
  },
  
  init() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.setupCanvasResolution();
    
    // Load high score
    this.hiScore = parseInt(localStorage.getItem("hiScore") || "0");
    
    // Initialize audio
    AudioSystem.init();
    
    // Setup input and interface buttons
    this.setupInput();
    this.setupUiButtons();
    
    // Initialize background
    this.initBackground();
    
    // Start game loop
    this.update();
  },

  setupCanvasResolution() {
    // Keep the original 420x640 game coordinate system while using a
    // higher-resolution backing buffer on modern PC/retina displays.
    this.pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(CONFIG.CANVAS_WIDTH * this.pixelRatio);
    this.canvas.height = Math.round(CONFIG.CANVAS_HEIGHT * this.pixelRatio);
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  },

  toGameCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * CONFIG.CANVAS_WIDTH / rect.width,
      y: (clientY - rect.top) * CONFIG.CANVAS_HEIGHT / rect.height
    };
  },

  isKeyDown(...names) {
    return names.some(name => !!this.keys[name]);
  },
  
  setupInput() {
    const keys = Object.create(null);
    this.keys = keys;
    this.firing = false;
    this.gamepadInput = { x: 0, y: 0, fire: false, pause: false, dash: false, focus: false };
    this.gamepadPrev = { pause: false, confirm: false, up: false, down: false };

    const preventDefaultCodes = new Set([
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX'
    ]);

    const setKey = (e, down) => {
      if (e.code) keys[e.code] = down;
      if (e.key) keys[e.key.toLowerCase()] = down;
    };

    window.addEventListener('keydown', e => {
      if (preventDefaultCodes.has(e.code)) e.preventDefault();
      setKey(e, true);
      AudioSystem.resumeContext();

      if (e.repeat) return;

      if (e.code === 'KeyM') {
        this.toggleSound();
        return;
      }
      if (e.code === 'KeyF') {
        this.toggleFullscreen();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.togglePause();
        else if (this.state === 'victory') this.victoryToMenu();
        return;
      }

      if (this.state === 'menu') {
        const diffByCode = {
          Digit1: 'EASY', Numpad1: 'EASY',
          Digit2: 'NORMAL', Numpad2: 'NORMAL',
          Digit3: 'HARD', Numpad3: 'HARD',
          Digit4: 'NIGHTMARE', Numpad4: 'NIGHTMARE'
        };
        if (diffByCode[e.code]) {
          this.setDifficulty(diffByCode[e.code]);
          return;
        }
        if (e.code === 'Enter' || e.code === 'Space') {
          this.startGame();
          return;
        }
      } else if (this.state === 'playing' && this.paused && e.code === 'Enter') {
        this.unpause();
      } else if (this.state === 'victory' && (e.code === 'Enter' || e.code === 'Space')) {
        this.restartGame();
      }
    }, { passive: false });

    window.addEventListener('keyup', e => setKey(e, false), { passive: true });
    window.addEventListener('blur', () => {
      Object.keys(keys).forEach(key => keys[key] = false);
      this.firing = false;
      this.touchDir = { x: 0, y: 0 };
    });

    this.canvas.addEventListener('pointerdown', e => {
      AudioSystem.resumeContext();
      this.canvas.focus({ preventScroll: true });
      if (this.state !== 'menu') return;

      const { x, y } = this.toGameCoords(e.clientX, e.clientY);
      const diffY = 300;
      const spacing = 80;
      const difficulties = ['EASY', 'NORMAL', 'HARD', 'NIGHTMARE'];

      for (let i = 0; i < difficulties.length; i++) {
        const btnY = diffY + i * spacing;
        if (x > 110 && x < 310 && y > btnY - 25 && y < btnY + 20) {
          this.setDifficulty(difficulties[i]);
          return;
        }
      }

      this.startGame();
    });
    
    // Mobile controls
    this.setupMobileControls();
  },

  setupUiButtons() {
    const bind = (id, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    };

    bind('resumeBtn', () => this.unpause());
    bind('soundBtn', () => this.toggleSound());
    bind('fullscreenBtn', () => this.toggleFullscreen());
    bind('menuBtn', () => this.returnToMenu());
    bind('restartBtn', () => this.restartGame());
    bind('victoryMenuBtn', () => this.victoryToMenu());
  },
  
  setupMobileControls() {
    const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!hasTouch) return;

    const controls = document.getElementById('controls');
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('knob');
    const fireBtn = document.getElementById('fireBtn');
    if (!controls || !joystick || !knob || !fireBtn) return;

    this.touchCapable = true;
    this.touchDir = { x: 0, y: 0 };
    this.updateMobileControlsVisibility();
    let joystickPointer = null;

    const updateStick = e => {
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const maxDist = Math.max(1, rect.width * 0.40);
      const dist = Math.hypot(dx, dy);
      const scale = dist > maxDist ? maxDist / dist : 1;
      const px = dx * scale;
      const py = dy * scale;
      this.touchDir.x = px / maxDist;
      this.touchDir.y = py / maxDist;
      knob.style.left = `calc(50% + ${px}px)`;
      knob.style.top = `calc(50% + ${py}px)`;
    };

    const releaseStick = e => {
      if (joystickPointer !== null && e.pointerId !== joystickPointer) return;
      this.touchDir = { x: 0, y: 0 };
      knob.style.left = '50%';
      knob.style.top = '50%';
      joystickPointer = null;
    };

    joystick.addEventListener('pointerdown', e => {
      e.preventDefault();
      joystickPointer = e.pointerId;
      joystick.setPointerCapture?.(e.pointerId);
      updateStick(e);
      AudioSystem.resumeContext();
    });
    joystick.addEventListener('pointermove', e => {
      if (e.pointerId === joystickPointer) {
        e.preventDefault();
        updateStick(e);
      }
    });
    joystick.addEventListener('pointerup', releaseStick);
    joystick.addEventListener('pointercancel', releaseStick);

    const fireOn = e => {
      e.preventDefault();
      this.firing = true;
      fireBtn.setPointerCapture?.(e.pointerId);
      AudioSystem.resumeContext();
    };
    const fireOff = e => {
      e.preventDefault();
      this.firing = false;
    };
    fireBtn.addEventListener('pointerdown', fireOn);
    fireBtn.addEventListener('pointerup', fireOff);
    fireBtn.addEventListener('pointercancel', fireOff);
    fireBtn.addEventListener('pointerleave', e => {
      if (e.buttons === 0) this.firing = false;
    });
  },

  updateMobileControlsVisibility() {
    const controls = document.getElementById('controls');
    if (!controls || !this.touchCapable) return;
    controls.classList.toggle('mobile-visible', this.state === 'playing' && !this.paused);
  },

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = Array.from(navigator.getGamepads()).filter(Boolean);
    const pad = pads[0];
    if (!pad) {
      this.gamepadInput = { x: 0, y: 0, fire: false, pause: false, dash: false, focus: false };
      return;
    }

    const deadzone = 0.20;
    let x = Math.abs(pad.axes[0] || 0) > deadzone ? pad.axes[0] : 0;
    let y = Math.abs(pad.axes[1] || 0) > deadzone ? pad.axes[1] : 0;
    if (pad.buttons[14]?.pressed) x = -1;
    if (pad.buttons[15]?.pressed) x = 1;
    if (pad.buttons[12]?.pressed) y = -1;
    if (pad.buttons[13]?.pressed) y = 1;

    const fire = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed ||
      pad.buttons[2]?.pressed || pad.buttons[7]?.pressed);
    const pause = !!pad.buttons[9]?.pressed;
    const dash = !!(pad.buttons[5]?.pressed || pad.buttons[3]?.pressed);
    const focus = !!pad.buttons[6]?.pressed;
    const confirm = !!pad.buttons[0]?.pressed;
    const up = !!pad.buttons[12]?.pressed;
    const down = !!pad.buttons[13]?.pressed;

    this.gamepadInput = { x, y, fire, pause, dash, focus };

    if (this.state === 'playing' && pause && !this.gamepadPrev.pause) {
      this.togglePause();
    } else if (this.state === 'menu') {
      const order = ['EASY', 'NORMAL', 'HARD', 'NIGHTMARE'];
      let idx = Math.max(0, order.indexOf(this.difficulty));
      if (up && !this.gamepadPrev.up) this.setDifficulty(order[(idx + order.length - 1) % order.length]);
      if (down && !this.gamepadPrev.down) this.setDifficulty(order[(idx + 1) % order.length]);
      if ((confirm && !this.gamepadPrev.confirm) || (pause && !this.gamepadPrev.pause)) this.startGame();
    } else if (this.state === 'victory' && confirm && !this.gamepadPrev.confirm) {
      this.restartGame();
    }

    this.gamepadPrev = { pause, confirm, up, down };
  },

  initBackground() {
    this.stars = Array.from({length: 120}, () => ({
      x: Math.random() * 420,
      y: Math.random() * 640,
      s: Math.random() * 2 + 1,
      bright: Math.random() > 0.7,
      twinkle: Math.random() * 100
    }));
    
    this.buildings = Array.from({length: 15}, () => {
      const w = Math.random() * 40 + 20;
      const h = Math.random() * 80 + 40;
      const windows = [];
      const cols = Math.floor(w / 8);
      const rows = Math.floor(h / 12);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (Math.random() > 0.48) windows.push({ x: i * 8 + 2, y: j * 12 + 2, lit: Math.random() > 0.15 });
        }
      }
      return {
        x: Math.random() * 420,
        y: Math.random() * 640,
        w, h, windows,
        speed: Math.random() * 0.5 + 0.3,
        glow: Math.random() * 0.35 + 0.15
      };
    });
    
    this.menuParticles = Array.from({length: 80}, () => ({
      x: Math.random() * 420,
      y: Math.random() * 640,
      vx: (Math.random() - 0.5) * 1,
      vy: (Math.random() - 0.5) * 1,
      s: Math.random() * 3 + 1,
      h: Math.random() * 360
    }));
  },
  
  setDifficulty(diff) {
    if (!CONFIG.DIFFICULTIES[diff]) return;
    this.difficulty = diff;

    // Update optional HTML selectors when present. The canvas menu works too.
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.difficulty === diff);
    });
    const description = document.querySelector('.difficulty-description');
    if (description) description.textContent = CONFIG.DIFFICULTIES[diff].description;
  },
  
  startGame() {
    this.state = "playing";
    this.paused = false;
    this.updateMobileControlsVisibility();
    this.score = 0;
    this.level = 1;
    this.levelKills = 0;
    this.totalKills = 0;
    this.maxComboReached = 0;
    this.showLevel = 120;
    this.stageTransition = null;
    this.warpStars = [];
    
    // Reset achievements for this run
    Object.keys(this.achievements).forEach(key => {
      if (key !== 'nightmare') this.achievements[key] = false;
    });
    
    // Initialize player
    this.player = {
      x: 210,
      y: 540,
      w: 20,
      h: 24,
      life: 3,
      maxLife: 3,
      weapon: 1,
      shield: 0,
      invuln: 0,
      fireRate: 8,
      fireCooldown: 0,
      vx: 0,
      vy: 0,
      bank: 0,
      focus: false,
      dashFrames: 0,
      dashCooldown: 0,
      lastDx: 0,
      lastDy: -1,
      overdriveTimer: 0
    };
    
    // Clear entities
    this.bullets = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.boss = null;
    
    // Reset combo
    this.combo = { count: 0, timer: 0, maxTime: CONFIG.COMBO_TIMEOUT, multiplier: 1 };
    this.spawnTimer = 24;
    this.frameCount = 0;
    this.dashHeld = false;
    
    // Start level music
    AudioSystem.playMusic('level1');
  },
  
  togglePause() {
    if (this.state !== 'playing') return;

    this.paused = !this.paused;
    this.updateMobileControlsVisibility();
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
      overlay.style.display = this.paused ? 'flex' : 'none';
      overlay.setAttribute('aria-hidden', this.paused ? 'false' : 'true');
    }
    if (this.paused) {
      this.firing = false;
      const resume = document.getElementById('resumeBtn');
      resume?.focus({ preventScroll: true });
    } else {
      this.canvas?.focus({ preventScroll: true });
    }
  },
  
  unpause() {
    this.paused = false;
    this.updateMobileControlsVisibility();
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
    this.canvas?.focus({ preventScroll: true });
  },
  
  toggleSound() {
    const enabled = AudioSystem.toggle();
    const status = document.getElementById('soundStatus');
    if (status) status.textContent = enabled ? 'ON' : 'OFF';
    return enabled;
  },

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const target = document.documentElement;
        if (target.requestFullscreen) await target.requestFullscreen();
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Tela cheia não disponível:', err);
    }
    this.canvas?.focus({ preventScroll: true });
  },
  
  returnToMenu() {
    this.state = 'menu';
    this.paused = false;
    this.updateMobileControlsVisibility();
    this.titleY = -80;
    this.titleVy = 0;
    this.stageTransition = null;
    this.warpStars = [];
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) {
      pauseOverlay.style.display = 'none';
      pauseOverlay.setAttribute('aria-hidden', 'true');
    }
    
    // Play menu music
    AudioSystem.playMusic('menu');
  },
  
  showVictory() {
    this.updateMobileControlsVisibility();
    document.getElementById('finalScore').textContent = this.score;
    document.getElementById('finalDifficulty').textContent = CONFIG.DIFFICULTIES[this.difficulty].name;
    document.getElementById('maxCombo').textContent = this.maxComboReached;
    document.getElementById('totalKills').textContent = this.totalKills;
    const victoryOverlay = document.getElementById('victoryOverlay');
    if (victoryOverlay) {
      victoryOverlay.style.display = 'flex';
      victoryOverlay.setAttribute('aria-hidden', 'false');
      document.getElementById('restartBtn')?.focus({ preventScroll: true });
    }
    
    // Achievement for beating game on nightmare
    if (this.difficulty === 'NIGHTMARE' && !this.achievements.nightmare) {
      this.unlockAchievement('nightmare', 'Dominou o Pesadelo!');
    }
    
    // Play victory music
    AudioSystem.playMusic('victory');
  },
  
  victoryToMenu() {
    const victoryOverlay = document.getElementById('victoryOverlay');
    if (victoryOverlay) { victoryOverlay.style.display = 'none'; victoryOverlay.setAttribute('aria-hidden', 'true'); }
    this.returnToMenu();
  },
  
  restartGame() {
    const victoryOverlay = document.getElementById('victoryOverlay');
    if (victoryOverlay) { victoryOverlay.style.display = 'none'; victoryOverlay.setAttribute('aria-hidden', 'true'); }
    this.startGame();
  },
  
  addScreenShake(intensity) {
    this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
  },
  
  updateCombo() {
    if (this.combo.timer > 0) {
      this.combo.timer--;
      this.combo.multiplier = 1 + Math.floor(this.combo.count / 10) * 0.5;
    } else {
      this.combo.count = 0;
      this.combo.multiplier = 1;
    }
  },
  
  addCombo() {
    this.combo.count++;
    this.combo.timer = this.combo.maxTime;
    
    if (this.combo.count > this.maxComboReached) {
      this.maxComboReached = this.combo.count;
    }
    
    if (this.combo.count % 10 === 0) {
      this.showFeedback("COMBO x" + this.combo.count + "!", "#ff0");
      this.addScreenShake(3);
    }
  },
  
  showFeedback(text, color = "#fff") {
    const div = document.createElement("div");
    div.className = "feedback-text";
    div.textContent = text;
    div.style.color = color;
    document.getElementById("feedback").appendChild(div);
    setTimeout(() => div.remove(), 500);
  },
  
  unlockAchievement(key, text) {
    if (!this.achievements[key]) {
      this.achievements[key] = true;
      const div = document.createElement("div");
      div.className = "achievement";
      div.innerHTML = "🏆 " + text;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
      this.score += 1000;
    }
  },
  
  createExplosion(x, y, color, count = 30, type = "normal") {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, type));
    }
  },
  
  spawnEnemy() {
    const lvl = CONFIG.LEVELS[this.level] || CONFIG.LEVELS[1];
    const diff = CONFIG.DIFFICULTIES[this.difficulty];
    const pool = lvl.enemyTypes || [1, 2, 3];
    const type = pool[Math.floor(Math.random() * pool.length)];

    const stats = {
      1: {health: 30, radius: 12, speed: 2.5, fireRate: 120},
      2: {health: 50, radius: 16, speed: 1.8, fireRate: 145},
      3: {health: 40, radius: 14, speed: 2.2, fireRate: 112},
      4: {health: 46, radius: 13, speed: 2.0, fireRate: 150}, // sniper
      5: {health: 32, radius: 12, speed: 3.0, fireRate: 130}, // striker
      6: {health: 78, radius: 18, speed: 1.55, fireRate: 165} // guardian
    };
    const st = stats[type] || stats[1];
    const levelHealth = 1 + Math.max(0, this.level - 1) * 0.035;
    const baseHealth = st.health * levelHealth;

    this.enemies.push({
      x: Math.random() * 360 + 30,
      y: -30,
      r: st.radius,
      type,
      h: baseHealth * diff.enemyHealthMult,
      maxH: baseHealth * diff.enemyHealthMult,
      hit: 0,
      vx: (type === 3 || type === 5) ? (Math.random() - 0.5) * 4 : 0,
      vy: st.speed * diff.enemySpeedMult,
      pattern: Math.floor(Math.random() * 3),
      fireCooldown: Math.floor(Math.random() * 55),
      fireRate: Math.max(35, Math.floor(st.fireRate / Math.max(0.35, diff.enemyFireRate))),
      age: 0,
      phaseOffset: Math.random() * Math.PI * 2,
      burst: 0,
      shieldPulse: Math.random() * Math.PI * 2
    });
  },
  
  spawnBoss() {
    const lvl = CONFIG.LEVELS[this.level] || CONFIG.LEVELS[1];
    const diff = CONFIG.DIFFICULTIES[this.difficulty];

    this.boss = {
      x: 210,
      y: -80,
      type: lvl.bossType,
      variant: lvl.bossVariant || 1,
      name: lvl.bossName || ('BOSS ' + lvl.bossType),
      h: lvl.bossLife * diff.bossHealthMult,
      maxH: lvl.bossLife * diff.bossHealthMult,
      hit: 0,
      phase: 0,
      attackTimer: 0,
      moveTimer: 0,
      targetX: 210,
      spiralAngle: 0,
      patternIndex: 0
    };

    const returnText = this.boss.variant > 1 ? '⚠️ REVANCHE: ' + this.boss.name + ' ⚠️' : '⚠️ ' + this.boss.name + ' CHEGANDO! ⚠️';
    this.showFeedback(returnText, this.boss.variant > 1 ? '#ff7a00' : '#f00');
    this.addScreenShake(this.boss.variant > 1 ? 14 : 10);

    AudioSystem.playMusic('boss');
  },
  
  spawnPowerup(x, y) {
    const kinds = ["weapon", "weapon", "life", "shield", "overdrive", "overdrive"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    
    this.powerups.push({
      x: x,
      y: y,
      kind: kind,
      pulse: 0
    });
  },
  
  updatePlayer() {
    const p = this.player;

    // Keyboard input: arrows, WASD, IJKL and numeric keypad.
    let dx = 0, dy = 0;
    if (this.isKeyDown('ArrowLeft', 'KeyA', 'KeyJ', 'Numpad4', 'a', 'j')) dx -= 1;
    if (this.isKeyDown('ArrowRight', 'KeyD', 'KeyL', 'Numpad6', 'd', 'l')) dx += 1;
    if (this.isKeyDown('ArrowUp', 'KeyW', 'KeyI', 'Numpad8', 'w', 'i')) dy -= 1;
    if (this.isKeyDown('ArrowDown', 'KeyS', 'KeyK', 'Numpad2', 's', 'k')) dy += 1;

    if (this.touchDir) {
      dx += this.touchDir.x;
      dy += this.touchDir.y;
    }
    if (this.gamepadInput) {
      dx += this.gamepadInput.x || 0;
      dy += this.gamepadInput.y || 0;
    }

    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }
    if (Math.hypot(dx, dy) > 0.15) {
      p.lastDx = dx;
      p.lastDy = dy;
    }

    // SHIFT/LT gives precision movement for dense bullet patterns.
    p.focus = this.isKeyDown('ShiftLeft', 'ShiftRight') || !!this.gamepadInput?.focus;
    const maxSpeed = p.focus ? CONFIG.PLAYER_FOCUS_SPEED : CONFIG.PLAYER_MAX_SPEED;

    // C / RB/B performs a short dash with cooldown.
    const dashPressed = this.isKeyDown('KeyC', 'c') || !!this.gamepadInput?.dash;
    if (dashPressed && !this.dashHeld && p.dashCooldown <= 0 && Math.hypot(p.lastDx, p.lastDy) > 0.1) {
      p.dashFrames = CONFIG.DASH_FRAMES;
      p.dashCooldown = CONFIG.DASH_COOLDOWN;
      this.addScreenShake(2);
      this.showFeedback('DASH!', '#0ff');
    }
    this.dashHeld = dashPressed;

    if (p.dashFrames > 0) {
      p.dashFrames--;
      const dmag = Math.max(0.001, Math.hypot(p.lastDx, p.lastDy));
      p.vx = (p.lastDx / dmag) * CONFIG.DASH_SPEED;
      p.vy = (p.lastDy / dmag) * CONFIG.DASH_SPEED;
      if (this.frameCount % 2 === 0) {
        this.createExplosion(p.x, p.y + 8, '#0ff', 4, 'trail');
      }
    } else {
      p.vx += dx * CONFIG.PLAYER_ACCEL;
      p.vy += dy * CONFIG.PLAYER_ACCEL;
      const drag = magnitude > 0.05 ? 0.90 : CONFIG.PLAYER_FRICTION;
      p.vx *= drag;
      p.vy *= drag;
      const velocity = Math.hypot(p.vx, p.vy);
      if (velocity > maxSpeed) {
        p.vx = p.vx / velocity * maxSpeed;
        p.vy = p.vy / velocity * maxSpeed;
      }
    }

    p.x += p.vx;
    p.y += p.vy;

    // Softer edge handling avoids the ship feeling stuck against the border.
    const clampedX = Math.max(22, Math.min(398, p.x));
    const clampedY = Math.max(36, Math.min(600, p.y));
    if (clampedX !== p.x) p.vx *= -0.18;
    if (clampedY !== p.y) p.vy *= -0.18;
    p.x = clampedX;
    p.y = clampedY;

    p.bank += ((p.vx / Math.max(1, maxSpeed)) - p.bank) * 0.18;
    if (p.invuln > 0) p.invuln--;
    if (p.dashCooldown > 0) p.dashCooldown--;
    if (p.overdriveTimer > 0) p.overdriveTimer--;

    // Shooting
    p.fireCooldown--;
    const firePressed = this.isKeyDown('Space', 'KeyZ', 'KeyX', 'ControlLeft', 'ControlRight', 'Enter', ' ') ||
      this.firing || !!this.gamepadInput?.fire;
    if (firePressed && p.fireCooldown <= 0) {
      const overdrive = p.overdriveTimer > 0;
      p.fireCooldown = overdrive ? 4 : p.fireRate;
      const diff = CONFIG.DIFFICULTIES[this.difficulty];
      const dmg = 10 * diff.playerDamage * (overdrive ? 1.2 : 1);

      if (p.weapon === 1) {
        this.bullets.push({x: p.x, y: p.y - 15, dmg, overdrive});
      } else if (p.weapon === 2) {
        this.bullets.push({x: p.x - 8, y: p.y - 15, dmg, overdrive});
        this.bullets.push({x: p.x + 8, y: p.y - 15, dmg, overdrive});
      } else if (p.weapon === 3) {
        this.bullets.push({x: p.x, y: p.y - 15, dmg: dmg * 1.5, overdrive});
        this.bullets.push({x: p.x - 12, y: p.y - 10, dmg, overdrive});
        this.bullets.push({x: p.x + 12, y: p.y - 10, dmg, overdrive});
      }

      AudioSystem.shoot();
      this.createExplosion(p.x, p.y - 15, overdrive ? '#ff0' : '#0ff', overdrive ? 5 : 3, 'trail');
    }
  },

  updateEnemies() {
    const diff = CONFIG.DIFFICULTIES[this.difficulty];

    this.enemies.forEach(e => {
      e.age = (e.age || 0) + 1;
      const levelSpeed = 1 + (this.level - 1) * 0.055;
      e.y += e.vy * levelSpeed;

      if (e.type === 1) {
        e.x += Math.sin(e.age * 0.045 + e.phaseOffset) * 0.75;
      } else if (e.type === 2) {
        e.x += Math.sin(e.age * 0.025 + e.phaseOffset) * 0.45;
      } else if (e.type === 3) {
        if (e.pattern === 1) {
          e.x += Math.sin(e.age * 0.09 + e.phaseOffset) * 2.6;
        } else {
          e.x += e.vx;
          if (e.x < 30 || e.x > 390) e.vx *= -1;
        }
      } else if (e.type === 4) {
        // Sniper: slowly tracks the player horizontally and keeps distance.
        const track = Math.sign(this.player.x - e.x) * 0.62;
        e.x += track + Math.sin(e.age * 0.035 + e.phaseOffset) * 0.35;
        if (e.y > 150 && e.y < 250) e.y -= e.vy * 0.72 * levelSpeed;
      } else if (e.type === 5) {
        // Striker: aggressive S-curves with occasional dive.
        e.x += Math.sin(e.age * 0.12 + e.phaseOffset) * 3.1;
        if ((e.age % 150) > 105) e.y += 1.5 * levelSpeed;
      } else if (e.type === 6) {
        // Guardian: heavy escort that drifts side to side.
        e.x += Math.sin(e.age * 0.028 + e.phaseOffset) * 0.95;
        e.shieldPulse = (e.shieldPulse || 0) + 0.05;
      }
      e.x = Math.max(24, Math.min(396, e.x));

      if (e.hit > 0) e.hit--;

      e.fireCooldown--;
      if (e.y > 50 && e.y < 520 && e.fireCooldown <= 0 && Math.random() < diff.enemyFireRate * 0.012) {
        e.fireCooldown = e.fireRate;

        if (e.type === 1) {
          this.enemyBullets.push({x: e.x, y: e.y + 10, vx: 0, vy: 5, color: '#ff3366'});
        } else if (e.type === 2) {
          this.enemyBullets.push({x: e.x - 6, y: e.y + 10, vx: -0.4, vy: 5, color: '#ff9900'});
          this.enemyBullets.push({x: e.x + 6, y: e.y + 10, vx: 0.4, vy: 5, color: '#ff9900'});
        } else if (e.type === 3) {
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          this.enemyBullets.push({x: e.x, y: e.y + 10, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, color: '#55ff55'});
        } else if (e.type === 4) {
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          const speed = 5.7;
          this.enemyBullets.push({x: e.x, y: e.y + 8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: '#00ddff'});
          if (this.level >= 8) this.enemyBullets.push({x: e.x, y: e.y + 8, vx: Math.cos(angle + 0.12) * speed, vy: Math.sin(angle + 0.12) * speed, color: '#00ddff'});
        } else if (e.type === 5) {
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          for (let i = -1; i <= 1; i++) {
            const a = angle + i * 0.20;
            this.enemyBullets.push({x: e.x, y: e.y + 8, vx: Math.cos(a) * 4.4, vy: Math.sin(a) * 4.4, color: '#ff4dff'});
          }
        } else if (e.type === 6) {
          for (let i = -2; i <= 2; i++) {
            this.enemyBullets.push({x: e.x + i * 4, y: e.y + 12, vx: i * 0.65, vy: 4.2, color: '#ffd34d'});
          }
        }
      }
    });

    this.enemies = this.enemies.filter(e => e.y < 690 && e.h > 0);
  },

  updateBoss() {
    if (!this.boss) return;

    const b = this.boss;

    if (b.y < 82) {
      b.y += b.variant > 1 ? 2.0 : 1.5;
      return;
    }

    b.attackTimer++;
    b.moveTimer++;

    const healthPercent = b.h / b.maxH;
    b.phase = healthPercent > 0.66 ? 0 : healthPercent > 0.33 ? 1 : 2;

    // Boss movement personalities. Returning bosses are noticeably more aggressive.
    if (b.type === 5) {
      b.targetX = 210 + Math.sin(this.frameCount * 0.018) * (105 + b.phase * 22);
    } else if (b.type === 7) {
      b.targetX = 210 + Math.sin(this.frameCount * 0.026) * 145;
    } else if (b.type === 8) {
      b.targetX = 210 + Math.sin(this.frameCount * (0.02 + b.phase * 0.005)) * 155;
    } else if (b.moveTimer > Math.max(55, 120 - b.phase * 18 - (b.variant > 1 ? 25 : 0))) {
      b.targetX = Math.random() * 320 + 50;
      b.moveTimer = 0;
    }

    const moveEase = b.type === 6 ? 0.025 : b.type === 8 ? 0.07 : (b.variant > 1 ? 0.075 : 0.05);
    b.x += (b.targetX - b.x) * moveEase;

    const fire = (vx, vy, color = '#ff0033', x = b.x, y = b.y + 30) => {
      this.enemyBullets.push({x, y, vx, vy, color});
    };
    const aimed = (speed, spread = 0, color = '#ff3355') => {
      const a = Math.atan2(this.player.y - b.y, this.player.x - b.x) + spread;
      fire(Math.cos(a) * speed, Math.sin(a) * speed, color);
    };

    let interval = 62 - b.phase * 13;
    if (b.variant > 1) interval -= 10;
    if (b.type === 7) interval -= 8;
    if (b.type === 8) interval -= 12;
    interval = Math.max(22, interval);

    if (b.attackTimer > interval) {
      b.attackTimer = 0;
      b.patternIndex = (b.patternIndex + 1) % 12;

      if (b.type === 1) {
        // Destructor / Destructor MK-II.
        const spreadCount = b.variant > 1 ? 7 : 5;
        for (let i = 0; i < spreadCount; i++) {
          const centered = i - (spreadCount - 1) / 2;
          fire(centered * 1.25, 4.9 + b.phase * 0.35, b.variant > 1 ? '#ff7a00' : '#ff3355');
        }
        if (b.variant > 1 && b.patternIndex % 2 === 0) {
          const bullets = 10 + b.phase * 4;
          for (let i = 0; i < bullets; i++) {
            const a = Math.PI * 2 * i / bullets + b.spiralAngle;
            fire(Math.cos(a) * 3.2, Math.sin(a) * 3.2, '#ffb000');
          }
          b.spiralAngle += 0.22;
          aimed(5.4, 0, '#fff066');
        }
      } else if (b.type === 2) {
        // Inferno.
        const bullets = 10 + b.phase * 4;
        for (let i = 0; i < bullets; i++) {
          const a = Math.PI * 2 * i / bullets + b.spiralAngle;
          fire(Math.cos(a) * (2.7 + b.phase * 0.25), Math.sin(a) * (2.7 + b.phase * 0.25), '#ff7300');
        }
        b.spiralAngle += 0.16;
        if (b.phase > 0) { aimed(4.7, -0.16, '#ffd24d'); aimed(4.7, 0.16, '#ffd24d'); }
      } else if (b.type === 3) {
        // Void Hunter / EX.
        const shots = b.variant > 1 ? 5 : 3;
        for (let i = 0; i < shots; i++) {
          const centered = i - (shots - 1) / 2;
          aimed(5.0 + b.phase * 0.4, centered * (b.variant > 1 ? 0.16 : 0.3), b.variant > 1 ? '#a45cff' : '#00cfff');
        }
        if (b.variant > 1 && b.patternIndex % 2 === 1) {
          for (let i = 0; i < 8 + b.phase * 4; i++) {
            const a = Math.PI * 2 * i / (8 + b.phase * 4) - b.spiralAngle;
            fire(Math.cos(a) * 3.0, Math.sin(a) * 3.0, '#00e5ff');
          }
          b.spiralAngle += 0.31;
        }
      } else if (b.type === 4) {
        // Omega mixes the first three bosses.
        for (let i = -2; i <= 2; i++) fire(i * 1.4, 5.0, '#ff33dd');
        const bullets = 8 + b.phase * 4;
        for (let i = 0; i < bullets; i++) {
          const a = Math.PI * 2 * i / bullets + b.spiralAngle;
          fire(Math.cos(a) * 2.8, Math.sin(a) * 2.8, '#9b44ff');
        }
        b.spiralAngle += 0.18;
        if (b.phase >= 1) { aimed(5.2, -0.20, '#ffffff'); aimed(5.2, 0, '#ffffff'); aimed(5.2, 0.20, '#ffffff'); }
      } else if (b.type === 5) {
        // Leviathan: sweeping plasma fans.
        const sweep = Math.sin(this.frameCount * 0.04) * 1.7;
        for (let i = -3; i <= 3; i++) fire(sweep + i * 0.72, 4.2 + Math.abs(i) * 0.12, '#00ffd5');
        if (b.phase >= 1) {
          fire(-3.5, 2.0, '#00aaff', b.x - 38, b.y + 15);
          fire(3.5, 2.0, '#00aaff', b.x + 38, b.y + 15);
        }
        if (b.phase === 2 && b.patternIndex % 2 === 0) {
          for (let i = 0; i < 12; i++) {
            const a = Math.PI * 2 * i / 12 + b.spiralAngle;
            fire(Math.cos(a) * 3.1, Math.sin(a) * 3.1, '#66fff0');
          }
          b.spiralAngle += 0.28;
        }
      } else if (b.type === 6) {
        // Iron Core: heavy crossfire and turret bursts.
        for (let i = -2; i <= 2; i++) {
          fire(i * 1.15, 4.5, '#ffd24d', b.x - 34, b.y + 18);
          fire(i * 1.15, 4.5, '#ff5a5a', b.x + 34, b.y + 18);
        }
        if (b.patternIndex % 2 === 0) {
          aimed(4.8 + b.phase * 0.4, -0.12, '#ffffff');
          aimed(4.8 + b.phase * 0.4, 0.12, '#ffffff');
        }
      } else if (b.type === 7) {
        // Chronos: rotating time spiral.
        const arms = 6 + b.phase * 2;
        for (let i = 0; i < arms; i++) {
          const a = b.spiralAngle + Math.PI * 2 * i / arms;
          fire(Math.cos(a) * 3.35, Math.sin(a) * 3.35, i % 2 ? '#b15cff' : '#65d8ff');
        }
        b.spiralAngle += b.phase === 2 ? 0.48 : 0.33;
        if (b.phase >= 1 && b.patternIndex % 3 === 0) { aimed(5.5, -0.22, '#ffffff'); aimed(5.5, 0, '#ffffff'); aimed(5.5, 0.22, '#ffffff'); }
      } else if (b.type === 8) {
        // Apex Omega rotates between several boss archetypes.
        const mode = b.patternIndex % 4;
        if (mode === 0) {
          for (let i = -4; i <= 4; i++) fire(i * 0.92, 5.0, '#ff33ee');
        } else if (mode === 1) {
          const bullets = 14 + b.phase * 4;
          for (let i = 0; i < bullets; i++) {
            const a = Math.PI * 2 * i / bullets + b.spiralAngle;
            fire(Math.cos(a) * 3.25, Math.sin(a) * 3.25, '#00ffff');
          }
          b.spiralAngle += 0.25;
        } else if (mode === 2) {
          for (let i = -2; i <= 2; i++) aimed(5.6, i * 0.14, '#ffffff');
        } else {
          for (let i = 0; i < 8; i++) {
            const a = b.spiralAngle + i * Math.PI / 4;
            fire(Math.cos(a) * 3.7, Math.sin(a) * 3.7, i % 2 ? '#ff4dcc' : '#59f6ff');
          }
          b.spiralAngle -= 0.37;
        }
        if (b.phase === 2) aimed(6.1, 0, '#ffee55');
      }
    }

    if (b.hit > 0) b.hit--;
  },

  checkCollisions() {
    const diff = CONFIG.DIFFICULTIES[this.difficulty];
    
    // Bullets vs Enemies
    this.bullets.forEach(b => {
      this.enemies.forEach(e => {
        if (Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) {
          e.h -= b.dmg;
          e.hit = 5;
          b.y = -100;
          this.createExplosion(b.x, b.y, "#fff", 5, "spark");
          AudioSystem.hit();
          
          if (e.h <= 0) {
            this.levelKills++;
            this.totalKills++;
            const points = Math.floor((e.type === 1 ? 100 : e.type === 2 ? 200 : 150) * this.combo.multiplier);
            this.score += points;
            this.addCombo();
            
            this.floatingTexts.push(new FloatingText(e.x, e.y, "+" + points, "#ff0"));
            this.createExplosion(e.x, e.y, e.type === 1 ? "#f0f" : e.type === 2 ? "#ff0" : "#0f0", 40, "spark");
            this.addScreenShake(3);
            AudioSystem.explosion();
            
            if (Math.random() < diff.powerupChance) {
              this.spawnPowerup(e.x, e.y);
            }
            
            if (!this.achievements.firstKill) {
              this.unlockAchievement("firstKill", "Primeira Destruição!");
            }
          }
        }
      });
      
      // Bullets vs Boss
      if (this.boss) {
        const hitSize = ({1:50,2:52,3:45,4:55,5:58,6:60,7:52,8:62})[this.boss.type] || 50;
        if (Math.abs(b.x - this.boss.x) < hitSize && Math.abs(b.y - this.boss.y) < hitSize) {
          this.boss.h -= b.dmg;
          this.boss.hit = 5;
          b.y = -100;
          const points = Math.floor(50 * this.combo.multiplier);
          this.score += points;
          this.floatingTexts.push(new FloatingText(b.x, b.y, "+" + points, "#f80"));
          this.createExplosion(b.x, b.y, "#fff", 8, "spark");
          this.addScreenShake(2);
          AudioSystem.hit();
          
          if (this.boss.h <= 0) {
            this.createExplosion(this.boss.x, this.boss.y, "#ff0033", 80, "spark");
            this.addScreenShake(15);
            this.score += 5000;
            this.showFeedback("BOSS DERROTADO!", "#0f0");
            this.floatingTexts.push(new FloatingText(this.boss.x, this.boss.y, "+5000", "#0f0"));
            AudioSystem.bossExplode();
            
            if (!this.achievements.firstBoss) {
              this.unlockAchievement("firstBoss", "Primeiro Boss Derrotado!");
            }
            
            const clearedLevel = this.level;
            this.boss = null;
            this.levelKills = 0;
            this.beginStageTransition(clearedLevel >= CONFIG.MAX_LEVEL);
          }
        }
      }
    });
    
    // Player vs Enemies
    if (this.player.invuln <= 0 && this.player.dashFrames <= 0) {
      this.enemies.forEach(e => {
        if (Math.abs(this.player.x - e.x) < 20 && Math.abs(this.player.y - e.y) < 20) {
          e.h = 0;
          this.handlePlayerHit();
          this.createExplosion(this.player.x, this.player.y, "#0ff", 25, "spark");
        }
      });
      
      // Player vs Enemy Bullets
      this.enemyBullets.forEach(b => {
        if (Math.abs(this.player.x - b.x) < 12 && Math.abs(this.player.y - b.y) < 12) {
          this.handlePlayerHit();
          b.y = 800;
          this.createExplosion(b.x, b.y, "#f00", 15, "spark");
        }
      });
    }
    
    // Player vs Powerups
    this.powerups.forEach(p => {
      if (Math.abs(this.player.x - p.x) < 20 && Math.abs(this.player.y - p.y) < 20) {
        p.y = 800;
        
        if (p.kind === "weapon") {
          if (this.player.weapon < 3) {
            this.player.weapon++;
            this.showFeedback("ARMA UP!", "#0f0");
            this.score += 500;
            if (this.player.weapon === 3 && !this.achievements.weapon3) {
              this.unlockAchievement("weapon3", "Arma Nível 3!");
            }
          } else {
            this.score += 1000;
            this.floatingTexts.push(new FloatingText(p.x, p.y, "+1000", "#0f0"));
          }
        } else if (p.kind === "life") {
          if (this.player.life < this.player.maxLife) {
            this.player.life++;
            this.showFeedback("+1 VIDA", "#f00");
          }
          this.score += 1000;
        } else if (p.kind === "shield") {
          this.player.shield = Math.min(3, this.player.shield + 1);
          this.showFeedback("ESCUDO+", "#0af");
          this.score += 800;
        } else if (p.kind === "overdrive") {
          this.player.overdriveTimer = Math.max(this.player.overdriveTimer, CONFIG.OVERDRIVE_FRAMES);
          this.showFeedback("OVERDRIVE!", "#ff0");
          this.score += 750;
        }
        
        this.createExplosion(p.x, p.y, "#fff", 20, "spark");
        this.addScreenShake(2);
        AudioSystem.powerup();
      }
    });
  },
  
  handlePlayerHit() {
    if (this.player.shield > 0) {
      this.player.shield--;
      this.showFeedback("ESCUDO!", "#0ff");
    } else {
      this.player.life--;
      this.player.invuln = CONFIG.INVULN_FRAMES;
      this.showFeedback("DANO!", "#f00");
      this.addScreenShake(8);
      this.combo.count = 0;
      this.combo.timer = 0;
    }
    AudioSystem.hit();
  },
  
  checkAchievements() {
    if (this.score >= 10000 && !this.achievements.score10k) {
      this.unlockAchievement("score10k", "10.000 Pontos!");
    }
    
    if (this.score >= 50000 && !this.achievements.score50k) {
      this.unlockAchievement("score50k", "50.000 Pontos!");
    }
    
    if (this.combo.count >= 50 && !this.achievements.combo50) {
      this.unlockAchievement("combo50", "Combo x50!");
    }
  },
  
  drawBackground() {
    const lvl = CONFIG.LEVELS[this.level] || CONFIG.LEVELS[1];
    const ctx = this.ctx;
    
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, lvl.bg);
    grad.addColorStop(1, "#000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 420, 640);
    
    // Stars
    this.stars.forEach(s => {
      s.y += lvl.speed * (s.s / 2);
      if (s.y > 640) {
        s.y = 0;
        s.x = Math.random() * 420;
      }
      
      s.twinkle += 0.1;
      const brightness = s.bright ? Math.abs(Math.sin(s.twinkle)) : 0.5;
      ctx.globalAlpha = brightness;
      ctx.fillStyle = "#fff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    });
    ctx.globalAlpha = 1;
    
    // Buildings
    if (lvl.buildings) {
      this.buildings.forEach(b => {
        b.y += lvl.speed * b.speed;
        if (b.y > 640) {
          b.y = -b.h;
          b.x = Math.random() * 420;
        }
        
        ctx.fillStyle = "rgba(0, 30, 60, 0.4)";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        
        ctx.globalAlpha = b.glow;
        ctx.fillStyle = lvl.color1;
        b.windows.forEach(win => {
          if (win.lit) ctx.fillRect(b.x + win.x, b.y + win.y, 4, 6);
        });
        ctx.globalAlpha = 1;
      });
    }

    // Distinct lightweight scenery for every stage.
    const t = this.frameCount;
    if (this.level === 1) {
      ctx.strokeStyle = 'rgba(0,255,255,0.12)';
      ctx.lineWidth = 1;
      const horizon = 420;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(210, horizon);
        ctx.lineTo(210 + i * 55, 640);
        ctx.stroke();
      }
      for (let y = horizon + ((t * 2) % 28); y < 640; y += 28) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(420, y); ctx.stroke();
      }
    } else if (this.level === 2) {
      ctx.fillStyle = 'rgba(255,110,0,0.10)';
      for (let i = 0; i < 5; i++) {
        const y = 430 + i * 42 + ((t * (0.3 + i * 0.04)) % 42);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 420; x += 35) ctx.lineTo(x, y + Math.sin((x + t) * 0.025 + i) * 9);
        ctx.lineTo(420, 640); ctx.lineTo(0, 640); ctx.closePath(); ctx.fill();
      }
    } else if (this.level === 3) {
      const nebula = ctx.createRadialGradient(90, 180, 10, 90, 180, 220);
      nebula.addColorStop(0, 'rgba(0,140,255,0.16)');
      nebula.addColorStop(0.55, 'rgba(150,0,255,0.07)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula; ctx.fillRect(0, 0, 420, 420);
    } else if (this.level === 4) {
      ctx.save();
      ctx.translate(210, 320);
      ctx.rotate(t * 0.0015);
      for (let r = 70; r < 360; r += 55) {
        ctx.strokeStyle = `rgba(190,0,255,${0.12 - r / 5000})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r + Math.sin(t * 0.025 + r) * 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    } else if (this.level === 5) {
      // Plasma ocean: layered luminous currents.
      for (let i = 0; i < 7; i++) {
        const y = 360 + i * 42 + ((t * (0.55 + i * 0.03)) % 42);
        ctx.strokeStyle = `rgba(0,255,213,${0.08 + i * 0.008})`;
        ctx.lineWidth = 2; ctx.beginPath();
        for (let x = 0; x <= 420; x += 18) {
          const yy = y + Math.sin(x * 0.035 + t * 0.035 + i) * (8 + i * 1.5);
          x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (this.level === 6) {
      // Mechanical fortress: moving steel rails and warning lights.
      ctx.strokeStyle='rgba(210,220,230,0.12)';ctx.lineWidth=2;
      for(let x=18;x<420;x+=48){const off=(t*1.3)%48;ctx.beginPath();ctx.moveTo(x+off-48,0);ctx.lineTo(x+off-48,640);ctx.stroke();}
      for(let y=(t*2)%64;y<640;y+=64){ctx.fillStyle='rgba(255,70,70,0.08)';ctx.fillRect(0,y,420,3);}
      for(let i=0;i<6;i++){const y=(i*110+(t*1.6))%700-60;ctx.fillStyle='rgba(255,190,60,0.15)';ctx.fillRect(i%2?12:388,y,20,6);}
    } else if (this.level === 7) {
      // Crimson eclipse.
      const ex=ctx.createRadialGradient(210,170,12,210,170,120);ex.addColorStop(0,'rgba(0,0,0,0.95)');ex.addColorStop(0.45,'rgba(30,0,0,0.92)');ex.addColorStop(0.55,'rgba(255,40,70,0.22)');ex.addColorStop(1,'rgba(255,30,40,0)');ctx.fillStyle=ex;ctx.fillRect(70,30,280,280);
      ctx.strokeStyle='rgba(255,80,80,0.12)';for(let i=0;i<10;i++){ctx.beginPath();ctx.moveTo(210,170);const a=i*Math.PI/5+t*0.001;ctx.lineTo(210+Math.cos(a)*360,170+Math.sin(a)*360);ctx.stroke();}
    } else if (this.level === 8) {
      // Quantum ruins: broken geometric structures drifting past.
      ctx.save();ctx.translate(210,320);ctx.rotate(t*0.0008);ctx.strokeStyle='rgba(101,216,255,0.15)';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.strokeRect(55+i*18,-10,28,20);}ctx.restore();
      ctx.strokeStyle='rgba(177,92,255,0.13)';for(let y=(t*1.4)%70;y<640;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(420,y-30);ctx.stroke();}
    } else if (this.level === 9) {
      // Chaos zone: unstable crossing energy bands.
      ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<7;i++){ctx.strokeStyle=i%2?'rgba(0,229,255,0.10)':'rgba(157,77,255,0.12)';ctx.lineWidth=3;ctx.beginPath();for(let x=0;x<=420;x+=20){const y=80+i*85+Math.sin(x*0.04+t*0.04+i)*22;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}ctx.restore();
    } else if (this.level === 10) {
      // Neon core: converging energy tunnel.
      ctx.save();ctx.translate(210,320);for(let r=40;r<390;r+=38){const rr=r-((t*2.2)%38);ctx.strokeStyle=`rgba(${r%76<38?'255,45,220':'0,255,255'},${0.18-r/3000})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,Math.max(8,rr),0,Math.PI*2);ctx.stroke();}for(let i=0;i<12;i++){const a=i*Math.PI/6+t*0.0015;ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.moveTo(Math.cos(a)*25,Math.sin(a)*25);ctx.lineTo(Math.cos(a)*390,Math.sin(a)*390);ctx.stroke();}ctx.restore();
    }
  },

  drawPostFX() {
    const ctx = this.ctx;
    // Subtle scanlines + vignette: improves depth without external assets.
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#000';
    for (let y = 0; y < 640; y += 4) ctx.fillRect(0, y, 420, 1);
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(210, 320, 180, 210, 320, 390);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 420, 640);
    ctx.restore();
  },
  
  drawPlayer() {
    const p = this.player;
    const ctx = this.ctx;
    
    if (p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0) return;
    
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.bank || 0) * 0.12);

    // Engine glow trail (animated)
    const enginePulse = Math.sin(Date.now() * 0.02) * 0.3 + 0.7;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = (0.3 - i * 0.1) * enginePulse;
      ctx.fillStyle = "#0ff";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#0ff";
      ctx.beginPath();
      ctx.ellipse(-5, 14 + i * 4, 3, 6 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(5, 14 + i * 4, 3, 6 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Shadow below ship
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings (with gradient)
    const wingGrad = ctx.createLinearGradient(-20, 0, 0, 0);
    wingGrad.addColorStop(0, "#004d66");
    wingGrad.addColorStop(1, "#0099cc");
    ctx.fillStyle = wingGrad;
    
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(-22, -2);
    ctx.lineTo(-22, 8);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#00ccff";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Right wing
    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.lineTo(22, -2);
    ctx.lineTo(22, 8);
    ctx.lineTo(10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Wing details
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-14, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(14, 4);
    ctx.stroke();
    
    // Main body (polygon)
    const bodyGrad = ctx.createLinearGradient(0, -15, 0, 15);
    bodyGrad.addColorStop(0, "#00d9ff");
    bodyGrad.addColorStop(0.5, "#0099cc");
    bodyGrad.addColorStop(1, "#006680");
    ctx.fillStyle = bodyGrad;
    
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(8, -8);
    ctx.lineTo(10, 8);
    ctx.lineTo(6, 14);
    ctx.lineTo(-6, 14);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    
    // Body outline
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Cockpit glass (with reflection)
    const cockpitGrad = ctx.createRadialGradient(-2, -8, 0, 0, -6, 8);
    cockpitGrad.addColorStop(0, "#ffffff");
    cockpitGrad.addColorStop(0.3, "#00ffff");
    cockpitGrad.addColorStop(1, "#0099cc");
    ctx.fillStyle = cockpitGrad;
    
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(6, -6);
    ctx.lineTo(6, 2);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 2);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    
    // Cockpit reflection
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(-3, -10);
    ctx.lineTo(2, -10);
    ctx.lineTo(4, -7);
    ctx.lineTo(-2, -7);
    ctx.closePath();
    ctx.fill();
    
    // Engine cores
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0ff";
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.arc(-5, 13, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, 13, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine core highlights
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-5, 12, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, 12, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Weapon indicators based on level
    if (p.weapon >= 2) {
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(-12, 3, 2, 4);
      ctx.fillRect(10, 3, 2, 4);
    }
    if (p.weapon >= 3) {
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(0, -2, 2, 4);
    }
    
    // Shield (hexagonal)
    if (p.shield > 0) {
      const shieldAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
      ctx.strokeStyle = "#00aaff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = shieldAlpha;
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#00aaff";
      
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = Math.cos(angle) * 26;
        const y = Math.sin(angle) * 26;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Shield energy particles
      for (let i = 0; i < p.shield; i++) {
        const angle = Date.now() * 0.003 + i * (Math.PI * 2 / p.shield);
        const x = Math.cos(angle) * 24;
        const y = Math.sin(angle) * 24;
        ctx.fillStyle = "#00ddff";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    if (p.focus) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-1, -1, 2, 2);
    }

    ctx.restore();
  },
  
  drawBullets() {
    const ctx = this.ctx;
    
    this.bullets.forEach(b => {
      ctx.save();
      
      // Bullet trail
      const trailLength = 20;
      const trailGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + trailLength);
      const bulletColor = b.overdrive ? '#ffff00' : '#00ffff';
      trailGrad.addColorStop(0, b.overdrive ? "rgba(255, 255, 0, 0.9)" : "rgba(0, 255, 255, 0.8)");
      trailGrad.addColorStop(1, b.overdrive ? "rgba(255, 255, 0, 0)" : "rgba(0, 255, 255, 0)");
      ctx.fillStyle = trailGrad;
      ctx.fillRect(b.x - 3, b.y, 6, trailLength);
      
      // Main bullet glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = bulletColor;
      
      // Bullet core
      const bulletGrad = ctx.createRadialGradient(b.x, b.y + 6, 0, b.x, b.y + 6, 5);
      bulletGrad.addColorStop(0, "#ffffff");
      bulletGrad.addColorStop(0.5, b.overdrive ? "#ffff00" : "#00ffff");
      bulletGrad.addColorStop(1, b.overdrive ? "#ff9900" : "#0099cc");
      ctx.fillStyle = bulletGrad;
      
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - 3, b.y + 4);
      ctx.lineTo(b.x - 2, b.y + 12);
      ctx.lineTo(b.x + 2, b.y + 12);
      ctx.lineTo(b.x + 3, b.y + 4);
      ctx.closePath();
      ctx.fill();
      
      // Bullet outline
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Energy core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 6, 1.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  },
  
  drawEnemies() {
    const ctx = this.ctx;
    
    this.enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      
      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 4, e.r, e.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      const hitFlash = e.hit > 0;
      
      if (e.type === 1) {
        // Diamond ship with more detail
        const bodyGrad = ctx.createLinearGradient(-15, -15, 15, 15);
        bodyGrad.addColorStop(0, hitFlash ? "#ffffff" : "#cc00ff");
        bodyGrad.addColorStop(0.5, hitFlash ? "#ffccff" : "#ff00ff");
        bodyGrad.addColorStop(1, hitFlash ? "#ffffff" : "#990099");
        ctx.fillStyle = bodyGrad;
        
        // Main diamond body
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(10, -4);
        ctx.lineTo(12, 8);
        ctx.lineTo(6, 14);
        ctx.lineTo(-6, 14);
        ctx.lineTo(-12, 8);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        
        // Diamond outline
        ctx.strokeStyle = "#ff00ff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Cockpit
        ctx.fillStyle = hitFlash ? "#ffffff" : "#ffccff";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6, -2);
        ctx.lineTo(6, 4);
        ctx.lineTo(-6, 4);
        ctx.lineTo(-6, -2);
        ctx.closePath();
        ctx.fill();
        
        // Engine glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ff00ff";
        ctx.fillStyle = "#ff00ff";
        ctx.beginPath();
        ctx.arc(-4, 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Wing details
        ctx.strokeStyle = "#ffccff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-6, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(6, 6);
        ctx.stroke();
        
      } else if (e.type === 2) {
        // Heavy star ship
        const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
        bodyGrad.addColorStop(0, hitFlash ? "#ffffff" : "#ffff00");
        bodyGrad.addColorStop(0.6, hitFlash ? "#ffffcc" : "#ff9900");
        bodyGrad.addColorStop(1, hitFlash ? "#ffffff" : "#cc6600");
        ctx.fillStyle = bodyGrad;
        
        // Octagon body
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI / 4) * i - Math.PI / 2;
          const r = i % 2 === 0 ? 16 : 14;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner star
        ctx.fillStyle = hitFlash ? "#ffffff" : "#ff6600";
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? 10 : 5;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Weapon hardpoints
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ff0000";
        ctx.fillStyle = "#ff3300";
        ctx.fillRect(-14, 0, 4, 6);
        ctx.fillRect(10, 0, 4, 6);
        ctx.shadowBlur = 0;
        
        // Core lights
        ctx.fillStyle = hitFlash ? "#ffffff" : "#ffff00";
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 2) * i;
          const x = Math.cos(angle) * 8;
          const y = Math.sin(angle) * 8;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
      } else if (e.type === 3) {
        // Fast interceptor
        const bodyGrad = ctx.createLinearGradient(-12, -12, 12, 12);
        bodyGrad.addColorStop(0, hitFlash ? "#ffffff" : "#00ff00");
        bodyGrad.addColorStop(0.5, hitFlash ? "#ccffcc" : "#00cc00");
        bodyGrad.addColorStop(1, hitFlash ? "#ffffff" : "#008800");
        ctx.fillStyle = bodyGrad;
        
        // Arrow-shaped body
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(8, -6);
        ctx.lineTo(10, 6);
        ctx.lineTo(4, 12);
        ctx.lineTo(0, 10);
        ctx.lineTo(-4, 12);
        ctx.lineTo(-10, 6);
        ctx.lineTo(-8, -6);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Side thrusters
        ctx.fillStyle = hitFlash ? "#ffffff" : "#44ff44";
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-16, -4);
        ctx.lineTo(-16, 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(16, -4);
        ctx.lineTo(16, 4);
        ctx.closePath();
        ctx.fill();
        
        // Cockpit detail
        ctx.fillStyle = hitFlash ? "#ffffff" : "#ccffcc";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(4, -4);
        ctx.lineTo(4, 2);
        ctx.lineTo(-4, 2);
        ctx.lineTo(-4, -4);
        ctx.closePath();
        ctx.fill();
        
        // Engine trails (animated)
        const pulse = Math.sin(Date.now() * 0.05) * 0.5 + 0.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00ff00";
        ctx.fillStyle = `rgba(0, 255, 0, ${pulse})`;
        ctx.fillRect(-2, 12, 4, 8);
        ctx.shadowBlur = 0;
        
        // Speed lines
        ctx.strokeStyle = `rgba(0, 255, 0, 0.3)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-6 + i * 6, 8);
          ctx.lineTo(-6 + i * 6, 14);
          ctx.stroke();
        }
      }
      
      // Additional enemy classes unlocked in the extended campaign.
      if (e.type === 4) {
        // CYAN SNIPER - narrow long-range craft
        ctx.shadowBlur = 12; ctx.shadowColor = '#00ddff';
        ctx.fillStyle = hitFlash ? '#ffffff' : '#006a88';
        ctx.beginPath();
        ctx.moveTo(0, -17); ctx.lineTo(8, -4); ctx.lineTo(5, 13); ctx.lineTo(0, 8); ctx.lineTo(-5, 13); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#00eaff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#d9ffff'; ctx.fillRect(-2, -9, 4, 12);
        ctx.fillStyle = '#00eaff'; ctx.fillRect(-11, 2, 5, 3); ctx.fillRect(6, 2, 5, 3);
        ctx.shadowBlur = 0;
      } else if (e.type === 5) {
        // MAGENTA STRIKER - fast crescent interceptor
        ctx.save(); ctx.rotate(Math.sin((e.age || 0) * 0.08) * 0.12);
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff4dff';
        ctx.fillStyle = hitFlash ? '#ffffff' : '#8d1f9e';
        ctx.beginPath();
        ctx.moveTo(0,-15); ctx.lineTo(15,-2); ctx.lineTo(8,3); ctx.lineTo(13,12); ctx.lineTo(0,7); ctx.lineTo(-13,12); ctx.lineTo(-8,3); ctx.lineTo(-15,-2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffd9ff'; ctx.beginPath(); ctx.arc(0,-3,4,0,Math.PI*2); ctx.fill();
        ctx.restore(); ctx.shadowBlur = 0;
      } else if (e.type === 6) {
        // GOLD GUARDIAN - armored escort
        ctx.shadowBlur = 10; ctx.shadowColor = '#ffd34d';
        ctx.fillStyle = hitFlash ? '#ffffff' : '#6f5b18';
        ctx.beginPath();
        for (let i=0;i<8;i++) { const a=Math.PI*2*i/8-Math.PI/2; const rr=i%2===0?18:15; const xx=Math.cos(a)*rr, yy=Math.sin(a)*rr; i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#ffd34d'; ctx.lineWidth=2.5; ctx.stroke();
        if ((e.shield ?? 1) > 0) { ctx.strokeStyle='rgba(255,230,120,0.55)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,22+Math.sin(e.shieldPulse||0)*2,0,Math.PI*2); ctx.stroke(); }
        ctx.fillStyle='#fff3a0'; ctx.fillRect(-5,-5,10,10);
        ctx.fillStyle='#ff704d'; ctx.fillRect(-16,7,6,4); ctx.fillRect(10,7,6,4);
        ctx.shadowBlur=0;
      }

      // Health bar
      if (e.h < e.maxH) {
        const barWidth = 28;
        const barHeight = 4;
        
        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(-barWidth / 2, -22, barWidth, barHeight);
        
        // Red portion
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(-barWidth / 2, -22, barWidth, barHeight);
        
        // Green health
        const healthWidth = barWidth * (e.h / e.maxH);
        const healthGrad = ctx.createLinearGradient(-barWidth / 2, 0, -barWidth / 2 + healthWidth, 0);
        healthGrad.addColorStop(0, "#00ff00");
        healthGrad.addColorStop(1, "#88ff00");
        ctx.fillStyle = healthGrad;
        ctx.fillRect(-barWidth / 2, -22, healthWidth, barHeight);
        
        // Border
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(-barWidth / 2, -22, barWidth, barHeight);
      }
      
      ctx.restore();
    });
  },
  
  drawBoss() {
    if (!this.boss) return;
    
    const b = this.boss;
    const ctx = this.ctx;
    const time = Date.now() * 0.001;
    
    ctx.save();
    ctx.translate(b.x, b.y);
    
    if (b.hit > 0) ctx.globalAlpha = 0.7;
    
    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Boss aura based on phase
    const phaseColor = b.phase === 0 ? "#ff0000" : b.phase === 1 ? "#ff8800" : "#ffff00";
    ctx.shadowBlur = 30;
    ctx.shadowColor = phaseColor;
    
    if (b.type === 1) {
      // DESTRUCTOR - Diamond core with rotating shields
      const rotation = time * 0.5;
      
      // Outer rotating ring
      ctx.save();
      ctx.rotate(rotation);
      ctx.strokeStyle = "#ff3300";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.stroke();
      
      // Ring details
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const x1 = Math.cos(angle) * 50;
        const y1 = Math.sin(angle) * 50;
        const x2 = Math.cos(angle) * 60;
        const y2 = Math.sin(angle) * 60;
        ctx.strokeStyle = "#ff6600";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
      
      // Main diamond body
      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 45);
      bodyGrad.addColorStop(0, "#ff0000");
      bodyGrad.addColorStop(0.5, "#cc0000");
      bodyGrad.addColorStop(1, "#880000");
      ctx.fillStyle = bodyGrad;
      
      ctx.beginPath();
      ctx.moveTo(0, -45);
      ctx.lineTo(35, -15);
      ctx.lineTo(45, 15);
      ctx.lineTo(15, 45);
      ctx.lineTo(-15, 45);
      ctx.lineTo(-45, 15);
      ctx.lineTo(-35, -15);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Inner diamond
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(18, -8);
      ctx.lineTo(25, 8);
      ctx.lineTo(8, 25);
      ctx.lineTo(-8, 25);
      ctx.lineTo(-25, 8);
      ctx.lineTo(-18, -8);
      ctx.closePath();
      ctx.fill();
      
      // Core
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Pulsing core light
      const pulse = Math.sin(time * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Weapon ports
      const ports = [[-35, 0], [35, 0], [0, -35], [0, 35]];
      ports.forEach(([px, py]) => {
        ctx.fillStyle = "#ff3300";
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      
    } else if (b.type === 2) {
      // INFERNO - Hexagon with flame aura
      const rotation = time * 0.3;
      
      // Flame aura
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI / 6) * i + rotation;
        const dist = 50 + Math.sin(time * 2 + i) * 5;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const size = 8 + Math.sin(time * 3 + i) * 3;
        
        const flameGrad = ctx.createRadialGradient(x, y, 0, x, y, size);
        flameGrad.addColorStop(0, "#ffff00");
        flameGrad.addColorStop(0.5, "#ff6600");
        flameGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Main hexagon body
      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 45);
      bodyGrad.addColorStop(0, "#ffaa00");
      bodyGrad.addColorStop(0.5, "#ff6600");
      bodyGrad.addColorStop(1, "#cc3300");
      ctx.fillStyle = bodyGrad;
      
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const r = 45;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = "#ff9900";
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Inner hexagon
      ctx.fillStyle = "#ff3300";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const r = 28;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      
      // Rotating core
      ctx.save();
      ctx.rotate(-rotation * 2);
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const r = i % 2 === 0 ? 15 : 8;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      
      // Heat vents on sides
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = Math.cos(angle) * 38;
        const y = Math.sin(angle) * 38;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(-3, -6, 6, 12);
        ctx.fillStyle = "#ffaa00";
        ctx.fillRect(-1.5, -4, 3, 8);
        ctx.restore();
      }
      
    } else if (b.type === 3) {
      // VOID HUNTER - Octagon with energy field
      const rotation = time * 0.4;
      
      // Energy field
      ctx.save();
      ctx.rotate(rotation);
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = `rgba(0, 175, 255, ${0.3 - ring * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 48 + ring * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      
      // Main octagon body
      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
      bodyGrad.addColorStop(0, "#00ccff");
      bodyGrad.addColorStop(0.5, "#0088cc");
      bodyGrad.addColorStop(1, "#004466");
      ctx.fillStyle = bodyGrad;
      
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 2;
        const r = 40;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = "#00ddff";
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Armor plates
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 2;
        const x = Math.cos(angle) * 30;
        const y = Math.sin(angle) * 30;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2);
        
        const plateGrad = ctx.createLinearGradient(-8, -10, 8, 10);
        plateGrad.addColorStop(0, "#006699");
        plateGrad.addColorStop(1, "#00aacc");
        ctx.fillStyle = plateGrad;
        
        ctx.beginPath();
        ctx.moveTo(-8, -10);
        ctx.lineTo(8, -10);
        ctx.lineTo(6, 10);
        ctx.lineTo(-6, 10);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      
      // Central core square
      ctx.save();
      ctx.rotate(-rotation * 1.5);
      ctx.fillStyle = "#00ffff";
      ctx.fillRect(-18, -18, 36, 36);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(-18, -18, 36, 36);
      
      // Inner rotating square
      ctx.rotate(rotation * 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
      
      // Scanner beam
      ctx.save();
      ctx.rotate(rotation * 2);
      const beamGrad = ctx.createLinearGradient(0, 0, 50, 0);
      beamGrad.addColorStop(0, "rgba(0, 255, 255, 0.8)");
      beamGrad.addColorStop(1, "rgba(0, 255, 255, 0)");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, -2, 50, 4);
      ctx.restore();
      
    } else if (b.type === 4) {
      // OMEGA - Final boss - Combined nightmare
      const rotation = time * 0.6;
      
      // Outer chaos ring
      ctx.save();
      ctx.rotate(rotation);
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI / 6) * i;
        const x = Math.cos(angle) * 60;
        const y = Math.sin(angle) * 60;
        
        const spikeGrad = ctx.createRadialGradient(x, y, 0, x, y, 12);
        spikeGrad.addColorStop(0, "#ff00ff");
        spikeGrad.addColorStop(1, "#6600aa");
        ctx.fillStyle = spikeGrad;
        
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#aa00ff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
      
      // Energy tentacles
      for (let i = 0; i < 8; i++) {
        const baseAngle = (Math.PI / 4) * i;
        const wave = Math.sin(time * 2 + i * 0.5) * 0.3;
        
        ctx.strokeStyle = `rgba(160, 0, 255, 0.6)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        
        for (let j = 0; j < 5; j++) {
          const dist = 35 + j * 8;
          const angle = baseAngle + wave * j * 0.3;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          
          if (j === 0) ctx.moveTo(Math.cos(baseAngle) * 35, Math.sin(baseAngle) * 35);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      
      // Main circular body
      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
      bodyGrad.addColorStop(0, "#cc00ff");
      bodyGrad.addColorStop(0.3, "#8800cc");
      bodyGrad.addColorStop(0.7, "#440088");
      bodyGrad.addColorStop(1, "#220044");
      ctx.fillStyle = bodyGrad;
      
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = "#ff00ff";
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Rotating orbital cores
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i + rotation * (i % 2 === 0 ? 1 : -1);
        const dist = 35 + Math.sin(time * 3 + i) * 3;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, 6);
        coreGrad.addColorStop(0, "#ffffff");
        coreGrad.addColorStop(0.5, "#ff00ff");
        coreGrad.addColorStop(1, "#8800ff");
        ctx.fillStyle = coreGrad;
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Central eye
      ctx.save();
      ctx.rotate(Math.sin(time * 2) * 0.2);
      
      // Outer eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Iris
      const irisGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      irisGrad.addColorStop(0, "#ff00ff");
      irisGrad.addColorStop(0.7, "#aa00ff");
      irisGrad.addColorStop(1, "#440088");
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Pupil
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.beginPath();
      ctx.arc(-3, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
      
      // Phase indicators
      for (let i = 0; i < 3; i++) {
        const active = i <= b.phase;
        const y = -45 - i * 8;
        ctx.fillStyle = active ? "#ff0000" : "#440044";
        ctx.fillRect(-3, y, 6, 6);
        if (active) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#ff0000";
          ctx.fillRect(-3, y, 6, 6);
          ctx.shadowBlur = 30;
        }
      }
    }
    
    // Extended campaign bosses.
    if (b.type === 5) {
      // LEVIATHAN - plasma manta/serpent hybrid
      const pulse = 0.5 + Math.sin(time * 3) * 0.15;
      ctx.shadowColor = '#00ffd5'; ctx.shadowBlur = 25;
      const grad = ctx.createLinearGradient(-55, -20, 55, 30);
      grad.addColorStop(0, '#003f52'); grad.addColorStop(0.5, '#00a6a6'); grad.addColorStop(1, '#004466');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(0,-38); ctx.bezierCurveTo(25,-30,52,-10,58,18); ctx.bezierCurveTo(35,8,25,20,0,38); ctx.bezierCurveTo(-25,20,-35,8,-58,18); ctx.bezierCurveTo(-52,-10,-25,-30,0,-38); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#66fff0'; ctx.lineWidth=3; ctx.stroke();
      ctx.fillStyle='#00d9ff'; ctx.beginPath(); ctx.ellipse(-30,7,16,7,-0.4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(30,7,16,7,0.4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${pulse})`; ctx.beginPath(); ctx.arc(0,-3,11,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,255,213,0.55)'; ctx.lineWidth=2; for(let r=48;r<=62;r+=7){ctx.beginPath();ctx.arc(0,4,r,0.15*Math.PI,0.85*Math.PI);ctx.stroke();}
    } else if (b.type === 6) {
      // IRON CORE - armored mobile fortress
      ctx.shadowColor='#ff5a5a'; ctx.shadowBlur=22;
      ctx.fillStyle='#242b32'; ctx.fillRect(-47,-39,94,78);
      ctx.strokeStyle='#d6dde4'; ctx.lineWidth=4; ctx.strokeRect(-47,-39,94,78);
      ctx.fillStyle='#4b5661'; ctx.fillRect(-34,-27,68,54);
      ctx.strokeStyle='#ff5a5a'; ctx.lineWidth=2; ctx.strokeRect(-34,-27,68,54);
      for(const x of [-34,34]){ctx.fillStyle='#161a1e';ctx.beginPath();ctx.arc(x,12,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd24d';ctx.stroke();ctx.fillStyle='#ff5a5a';ctx.fillRect(x-3,8,6,17);}
      ctx.fillStyle='#fff2a6'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff3333'; ctx.fillRect(-4,-4,8,8);
      ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=1; for(let y=-30;y<=30;y+=12){ctx.beginPath();ctx.moveTo(-43,y);ctx.lineTo(43,y);ctx.stroke();}
    } else if (b.type === 7) {
      // CHRONOS - clockwork quantum core
      ctx.shadowColor='#65d8ff'; ctx.shadowBlur=26;
      for(let i=0;i<3;i++){ctx.save();ctx.rotate((i%2?1:-1)*time*(0.35+i*0.18));ctx.strokeStyle=i===1?'#b15cff':'#65d8ff';ctx.lineWidth=3-i*0.5;ctx.beginPath();ctx.arc(0,0,52-i*10,0,Math.PI*2);ctx.stroke();for(let j=0;j<8;j++){const a=j*Math.PI/4;ctx.fillStyle=i===1?'#c88cff':'#9be8ff';ctx.fillRect(Math.cos(a)*(52-i*10)-2,Math.sin(a)*(52-i*10)-2,4,4);}ctx.restore();}
      const cg=ctx.createRadialGradient(0,0,0,0,0,27);cg.addColorStop(0,'#ffffff');cg.addColorStop(0.28,'#65d8ff');cg.addColorStop(0.7,'#5b2a99');cg.addColorStop(1,'#12082c');ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,0,27,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.save();ctx.rotate(time*0.9);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-21);ctx.stroke();ctx.restore();ctx.save();ctx.rotate(-time*0.45);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(16,0);ctx.stroke();ctx.restore();
    } else if (b.type === 8) {
      // APEX OMEGA - final synthesis
      const rot=time*0.7; ctx.shadowColor='#ff33ee';ctx.shadowBlur=32;
      ctx.save();ctx.rotate(rot);for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillStyle=i%2?'#00ffff':'#ff33ee';ctx.beginPath();ctx.moveTo(Math.cos(a)*37,Math.sin(a)*37);ctx.lineTo(Math.cos(a-0.12)*68,Math.sin(a-0.12)*68);ctx.lineTo(Math.cos(a+0.12)*68,Math.sin(a+0.12)*68);ctx.closePath();ctx.fill();}ctx.restore();
      const ag=ctx.createRadialGradient(0,0,2,0,0,46);ag.addColorStop(0,'#ffffff');ag.addColorStop(0.2,'#00ffff');ag.addColorStop(0.5,'#9a2bff');ag.addColorStop(0.8,'#ff2bd6');ag.addColorStop(1,'#190026');ctx.fillStyle=ag;ctx.beginPath();ctx.arc(0,0,46,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();
      ctx.save();ctx.rotate(-rot*1.7);ctx.strokeStyle='#00ffff';ctx.lineWidth=3;ctx.strokeRect(-25,-25,50,50);ctx.restore();
      ctx.fillStyle='#05000a';ctx.beginPath();ctx.ellipse(0,1,20,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffea00';ctx.beginPath();ctx.arc(0,1,7,0,Math.PI*2);ctx.fill();
    }

    // Returning bosses get an unmistakable remix halo and extra armor marks.
    if (b.variant > 1) {
      ctx.save();
      ctx.rotate(-time * 0.9);
      ctx.strokeStyle = b.type === 3 ? 'rgba(0,229,255,0.8)' : 'rgba(255,160,0,0.85)';
      ctx.lineWidth = 3; ctx.setLineDash([8,5]);
      ctx.beginPath(); ctx.arc(0,0,64 + Math.sin(time*4)*3,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }

    ctx.shadowBlur = 0;
    
    // Health bar
    const barWidth = 140;
    const barHeight = 8;
    const barY = -75;
    
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(-barWidth / 2 - 2, barY - 2, barWidth + 4, barHeight + 4);
    
    // Red portion
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
    
    // Health gradient
    const healthWidth = barWidth * (b.h / b.maxH);
    const healthGrad = ctx.createLinearGradient(-barWidth / 2, 0, -barWidth / 2 + healthWidth, 0);
    
    if (b.h / b.maxH > 0.66) {
      healthGrad.addColorStop(0, "#00ff00");
      healthGrad.addColorStop(1, "#88ff00");
    } else if (b.h / b.maxH > 0.33) {
      healthGrad.addColorStop(0, "#ffff00");
      healthGrad.addColorStop(1, "#ffaa00");
    } else {
      healthGrad.addColorStop(0, "#ff6600");
      healthGrad.addColorStop(1, "#ff0000");
    }
    
    ctx.fillStyle = healthGrad;
    ctx.fillRect(-barWidth / 2, barY, healthWidth, barHeight);
    
    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
    
    // Health segments
    for (let i = 1; i < 4; i++) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-barWidth / 2 + (barWidth / 4) * i, barY);
      ctx.lineTo(-barWidth / 2 + (barWidth / 4) * i, barY + barHeight);
      ctx.stroke();
    }
    
    // Boss name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#000000";
    ctx.fillText(b.name || ("BOSS " + b.type), 0, -88);
    
    // Phase indicator
    ctx.font = "10px monospace";
    ctx.fillStyle = phaseColor;
    ctx.fillText(`PHASE ${b.phase + 1}`, 0, -100);
    
    ctx.shadowBlur = 0;
    ctx.restore();
  },
  
  drawPowerups() {
    const ctx = this.ctx;
    
    this.powerups.forEach(p => {
      p.pulse += 0.1;
      const scale = 1 + Math.sin(p.pulse) * 0.2;
      const rotation = p.pulse * 0.5;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);
      ctx.rotate(rotation);
      
      // Glow aura
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      
      if (p.kind === "weapon") {
        glowGrad.addColorStop(0, "rgba(0, 255, 0, 0.4)");
        glowGrad.addColorStop(1, "rgba(0, 255, 0, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Hexagon container
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00ff00";
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = Math.cos(angle) * 12;
          const y = Math.sin(angle) * 12;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Inner fill
        const fillGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        fillGrad.addColorStop(0, "#00ff00");
        fillGrad.addColorStop(1, "#008800");
        ctx.fillStyle = fillGrad;
        ctx.fill();
        
        // "W" symbol
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("W", 0, 1);
        
      } else if (p.kind === "life") {
        glowGrad.addColorStop(0, "rgba(255, 0, 0, 0.4)");
        glowGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Heart shape
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff0000";
        ctx.fillStyle = "#ff0000";
        
        // Left curve
        ctx.beginPath();
        ctx.arc(-4, -3, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Right curve
        ctx.beginPath();
        ctx.arc(4, -3, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Bottom triangle
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(9, 0);
        ctx.closePath();
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.beginPath();
        ctx.arc(-3, -5, 2, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (p.kind === "shield") {
        glowGrad.addColorStop(0, "rgba(0, 175, 255, 0.4)");
        glowGrad.addColorStop(1, "rgba(0, 175, 255, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Shield shape (pentagon)
        const shieldGrad = ctx.createLinearGradient(0, -12, 0, 12);
        shieldGrad.addColorStop(0, "#00ddff");
        shieldGrad.addColorStop(0.5, "#0099cc");
        shieldGrad.addColorStop(1, "#006699");
        ctx.fillStyle = shieldGrad;
        
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00aaff";
        
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -4);
        ctx.lineTo(8, 8);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        
        // Border
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Energy field lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1;
        for (let i = -6; i <= 6; i += 3) {
          ctx.beginPath();
          ctx.moveTo(i, -8);
          ctx.lineTo(i, 6);
          ctx.stroke();
        }
        
        // Center emblem
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "overdrive") {
        glowGrad.addColorStop(0, "rgba(255, 230, 0, 0.48)");
        glowGrad.addColorStop(1, "rgba(255, 120, 0, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ffff00";
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.moveTo(-3, -13); ctx.lineTo(7, -13); ctx.lineTo(1, -2);
        ctx.lineTo(9, -2); ctx.lineTo(-5, 14); ctx.lineTo(-1, 3);
        ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
      }
      
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  },
  
  drawEnemyBullets() {
    const ctx = this.ctx;

    this.enemyBullets.forEach(b => {
      ctx.save();
      const color = b.color || '#ff0033';

      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x - (b.vx || 0) * 2.5, b.y - (b.vy || 5) * 2.5);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - 1, b.y - 1, 1.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    });
  },

  drawHUD() {
    const ctx = this.ctx;
    const p = this.player;
    const lvl = CONFIG.LEVELS[this.level] || CONFIG.LEVELS[1];

    // Glass HUD panels
    ctx.save();
    ctx.fillStyle = 'rgba(2,10,24,0.70)';
    ctx.strokeStyle = 'rgba(0,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.fillRect(7, 8, 170, 82); ctx.strokeRect(7, 8, 170, 82);
    ctx.fillRect(243, 8, 170, 82); ctx.strokeRect(243, 8, 170, 82);

    ctx.shadowBlur = 5;
    ctx.shadowColor = '#000';
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + String(this.score).padStart(6, '0'), 15, 29);
    ctx.fillStyle = '#ff0';
    ctx.font = '11px monospace';
    ctx.fillText('HI ' + String(this.hiScore).padStart(6, '0'), 15, 45);
    ctx.fillStyle = '#0f0';
    ctx.fillText('ARMA LV.' + p.weapon, 15, 63);
    if (p.shield > 0) { ctx.fillStyle = '#0af'; ctx.fillText('ESCUDO ' + p.shield, 15, 79); }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f0f';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('FASE ' + this.level + ' · ' + lvl.name, 405, 28);
    ctx.fillStyle = '#f66';
    ctx.font = '18px monospace';
    ctx.fillText('♥'.repeat(Math.max(0, p.life)), 405, 49);

    // Boss approach / wave progress
    const progress = this.boss ? 1 : Math.min(1, this.levelKills / CONFIG.KILLS_PER_BOSS);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(265, 61, 140, 7);
    ctx.fillStyle = this.boss ? '#f33' : lvl.color1;
    ctx.fillRect(265, 61, 140 * progress, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(265, 61, 140, 7);
    ctx.fillStyle = '#aaa';
    ctx.font = '9px monospace';
    ctx.fillText(this.boss ? 'BOSS EM COMBATE' : `BOSS ${this.levelKills}/${CONFIG.KILLS_PER_BOSS}`, 405, 80);

    // Dash cooldown indicator
    const dashReady = Math.max(0, 1 - p.dashCooldown / CONFIG.DASH_COOLDOWN);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9beeff'; ctx.font = '9px monospace'; ctx.fillText('DASH', 184, 19);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(184, 24, 52, 5);
    ctx.fillStyle = dashReady >= 1 ? '#0ff' : '#16859a'; ctx.fillRect(184, 24, 52 * dashReady, 5);

    if (p.overdriveTimer > 0) {
      const od = p.overdriveTimer / CONFIG.OVERDRIVE_FRAMES;
      ctx.fillStyle = '#ff0'; ctx.font = 'bold 9px monospace'; ctx.fillText('OVERDRIVE', 184, 43);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(184, 48, 52, 5);
      ctx.fillStyle = '#ff0'; ctx.fillRect(184, 48, 52 * od, 5);
    }

    if (this.combo.count > 0) {
      const alpha = Math.max(0.2, this.combo.timer / this.combo.maxTime);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.min(28, 17 + this.combo.count / 6)}px monospace`;
      ctx.fillStyle = '#ff0';
      ctx.shadowBlur = 12; ctx.shadowColor = '#ff0';
      ctx.fillText(`COMBO x${this.combo.count}  ×${this.combo.multiplier.toFixed(1)}`, 210, 115);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    if (this.showLevel > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px monospace';
      ctx.shadowBlur = 15; ctx.shadowColor = lvl.color1; ctx.fillStyle = lvl.color1;
      const alpha = this.showLevel > 90 ? (120 - this.showLevel) / 30 : this.showLevel < 30 ? this.showLevel / 30 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillText(lvl.name, 210, 310);
      ctx.font = '11px monospace'; ctx.fillStyle = '#fff'; ctx.fillText(`MISSÃO ${this.level}/${CONFIG.MAX_LEVEL}`, 210, 333);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      this.showLevel--;
    }
    ctx.restore();
  },

  beginStageTransition(finalStage = false) {
    if (this.stageTransition) return;

    // Nothing from the previous boss fight should leak into the next stage.
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.firing = false;
    this.combo.count = 0;
    this.combo.timer = 0;
    this.combo.multiplier = 1;

    this.warpStars = Array.from({ length: 54 }, () => ({
      x: Math.random() * 420,
      y: Math.random() * 640,
      len: 6 + Math.random() * 28,
      speed: 6 + Math.random() * 13,
      alpha: 0.2 + Math.random() * 0.8
    }));

    this.stageTransition = {
      timer: 0,
      switched: false,
      finalStage,
      fromLevel: this.level,
      toLevel: finalStage ? this.level : this.level + 1
    };
  },

  switchStageAtMidpoint() {
    const tr = this.stageTransition;
    if (!tr || tr.switched) return;
    tr.switched = true;

    if (tr.finalStage) {
      if (this.score > this.hiScore) {
        this.hiScore = this.score;
        localStorage.setItem("hiScore", this.hiScore);
      }
      return;
    }

    this.level = tr.toLevel;
    this.levelKills = 0;
    this.spawnTimer = 70;
    this.bullets = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.powerups = [];

    // Keep upgrades/lives, but make the entrance safe and visually clean.
    this.player.x = 210;
    this.player.y = 555;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.bank = 0;
    this.player.dashFrames = 0;
    this.player.invuln = Math.max(this.player.invuln, 90);

    AudioSystem.playMusic('level' + (((this.level - 1) % 4) + 1));
  },

  drawWarpTransition(alpha = 1) {
    const ctx = this.ctx;
    const lvl = CONFIG.LEVELS[this.stageTransition?.toLevel || this.level] || CONFIG.LEVELS[this.level];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = '#02020a';
    ctx.fillRect(0, 0, 420, 640);

    const grad = ctx.createRadialGradient(210, 320, 8, 210, 320, 300);
    grad.addColorStop(0, 'rgba(255,255,255,0.17)');
    grad.addColorStop(0.25, lvl.color1 + '33');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 420, 640);

    for (const star of this.warpStars) {
      star.y += star.speed;
      if (star.y > 680) {
        star.y = -40;
        star.x = Math.random() * 420;
      }
      ctx.globalAlpha = star.alpha * alpha;
      ctx.strokeStyle = Math.random() < 0.35 ? lvl.color2 : lvl.color1;
      ctx.lineWidth = 1 + star.speed / 10;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y - star.len);
      ctx.lineTo(star.x, star.y + star.len);
      ctx.stroke();
    }
    ctx.restore();
  },

  updateStageTransition() {
    const tr = this.stageTransition;
    if (!tr) return false;

    const ctx = this.ctx;
    const clearEnd = CONFIG.STAGE_CLEAR_FRAMES;
    const fadeOutEnd = clearEnd + CONFIG.STAGE_FADE_OUT_FRAMES;
    const blackEnd = fadeOutEnd + CONFIG.STAGE_BLACK_FRAMES;
    const fadeInEnd = blackEnd + CONFIG.STAGE_FADE_IN_FRAMES;
    const total = fadeInEnd + CONFIG.STAGE_INTRO_FRAMES;
    tr.timer++;

    // Let the boss explosion finish, but freeze combat/spawning.
    this.particles.forEach(p => p.update());
    this.particles = this.particles.filter(p => p.life > 0);
    this.floatingTexts.forEach(t => t.update());
    this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);

    if (tr.timer <= fadeOutEnd) {
      this.drawBackground();
      this.drawPlayer();
      this.particles.forEach(p => p.draw(ctx));
      this.floatingTexts.forEach(t => t.draw(ctx));
    }

    ctx.save();
    ctx.textAlign = 'center';

    if (tr.timer <= clearEnd) {
      const pulse = 0.82 + Math.sin(tr.timer * 0.18) * 0.18;
      ctx.fillStyle = `rgba(0,0,0,${0.28 + tr.timer / clearEnd * 0.24})`;
      ctx.fillRect(0, 0, 420, 640);
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = '#7dff8a';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#00ff88';
      ctx.fillText('MISSÃO CONCLUÍDA', 210, 292);
      ctx.shadowBlur = 0;
      ctx.font = '12px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`FASE ${tr.fromLevel}/${CONFIG.MAX_LEVEL} FINALIZADA`, 210, 320);
      ctx.globalAlpha = 1;
    } else if (tr.timer <= fadeOutEnd) {
      const p = (tr.timer - clearEnd) / CONFIG.STAGE_FADE_OUT_FRAMES;
      this.drawWarpTransition(Math.min(1, p * 1.25));
      ctx.fillStyle = `rgba(0,0,0,${p})`;
      ctx.fillRect(0, 0, 420, 640);
    } else if (tr.timer <= blackEnd) {
      this.switchStageAtMidpoint();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 420, 640);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#8efcff';
      ctx.fillText(tr.finalStage ? 'MISSÃO FINAL COMPLETA' : 'SALTO NEON...', 210, 325);
    } else if (tr.finalStage) {
      // Final boss: fade into the dedicated victory screen instead of another stage.
      const p = Math.min(1, (tr.timer - blackEnd) / CONFIG.STAGE_FADE_IN_FRAMES);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 420, 640);
      ctx.globalAlpha = p;
      ctx.font = 'bold 40px monospace';
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#0ff';
      ctx.fillText('VITÓRIA!', 210, 310);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else {
      this.switchStageAtMidpoint();
      this.drawBackground();
      this.drawWarpTransition(tr.timer <= fadeInEnd ? 1 - (tr.timer - blackEnd) / CONFIG.STAGE_FADE_IN_FRAMES : 0);

      const lvl = CONFIG.LEVELS[this.level];
      const introProgress = Math.max(0, (tr.timer - blackEnd) / (CONFIG.STAGE_FADE_IN_FRAMES + CONFIG.STAGE_INTRO_FRAMES));
      const introAlpha = Math.min(1, introProgress * 3, (total - tr.timer) / 18);
      ctx.globalAlpha = Math.max(0, introAlpha);
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = lvl.color1;
      ctx.shadowBlur = 18;
      ctx.shadowColor = lvl.color1;
      ctx.fillText(lvl.name, 210, 300);
      ctx.shadowBlur = 0;
      ctx.font = '12px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`MISSÃO ${this.level}/${CONFIG.MAX_LEVEL}`, 210, 327);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('PREPARE-SE', 210, 350);
      ctx.globalAlpha = 1;
      this.drawPlayer();
    }
    ctx.restore();

    if (tr.timer >= total) {
      if (tr.finalStage) {
        this.stageTransition = null;
        this.state = 'victory';
        this.showVictory();
      } else {
        this.showLevel = 0; // transition already introduced the stage
        this.stageTransition = null;
      }
    }
    return true;
  },

  drawMenu() {
    const ctx = this.ctx;
    
    // Background with particles
    const grad = ctx.createRadialGradient(210, 320, 0, 210, 320, 400);
    grad.addColorStop(0, "#001a33");
    grad.addColorStop(1, "#000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 420, 640);
    
    // Animated particles
    this.menuParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > 420) p.vx *= -1;
      if (p.y < 0 || p.y > 640) p.vy *= -1;
      
      p.h += 0.5;
      ctx.fillStyle = `hsl(${p.h % 360}, 100%, 60%)`;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    });
    ctx.globalAlpha = 1;
    
    // Title with bounce
    this.titleVy += 0.5;
    this.titleY += this.titleVy;
    if (this.titleY > 0) {
      this.titleY = 0;
      this.titleVy *= -0.6;
    }
    
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#0ff";
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NEON SKY", 210, 100 + this.titleY);
    
    ctx.shadowColor = "#f0f";
    ctx.fillStyle = "#f0f";
    ctx.fillText("FORCE", 210, 150 + this.titleY);
    ctx.shadowBlur = 0;
    
    // Subtitle
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText("STREAMING STAGES v1.6", 210, 190);
    
    // Difficulty selector
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 20px monospace";
    ctx.fillText("SELECIONE A DIFICULDADE:", 210, 260);
    
    const difficulties = ['EASY', 'NORMAL', 'HARD', 'NIGHTMARE'];
    const diffY = 300;
    const spacing = 80;
    
    difficulties.forEach((diff, i) => {
      const config = CONFIG.DIFFICULTIES[diff];
      const isSelected = this.difficulty === diff;
      const x = 210;
      const y = diffY + i * spacing;
      
      // Button background
      if (isSelected) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.2)";
        ctx.fillRect(x - 100, y - 25, 200, 45);
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 100, y - 25, 200, 45);
      }
      
      // Button text
      ctx.fillStyle = isSelected ? "#0ff" : "#888";
      ctx.font = isSelected ? "bold 18px monospace" : "16px monospace";
      ctx.fillText(config.name, x, y);
      
      // Description hint
      if (isSelected) {
        ctx.fillStyle = "#aaa";
        ctx.font = "11px monospace";
        ctx.fillText(config.description, x, y + 18);
      }
    });
    
    // Instructions
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillText("ENTER OU CLIQUE PARA INICIAR", 210, 598);
    }
    
    // Controls hint
    ctx.fillStyle = "#888";
    ctx.font = "10px monospace";
    ctx.fillText("WASD/SETAS - MOVER | ESPAÇO/Z/X - ATIRAR | SHIFT - PRECISÃO", 210, 618);
    ctx.fillText("C - DASH | ESC/P - PAUSA | F - TELA CHEIA | GAMEPAD OK", 210, 634);
    
    // High score
    if (this.hiScore > 0) {
      ctx.fillStyle = "#ff0";
      ctx.font = "bold 16px monospace";
      ctx.fillText("RECORDE: " + this.hiScore, 210, 230);
    }
  },
  
  update() {
    const ctx = this.ctx;
    this.frameCount++;
    this.pollGamepad();
    
    if (this.state === "menu") {
      this.drawMenu();
      
      // Handle difficulty selection with keys
      if (this.keys['1']) this.setDifficulty('EASY');
      if (this.keys['2']) this.setDifficulty('NORMAL');
      if (this.keys['3']) this.setDifficulty('HARD');
      if (this.keys['4']) this.setDifficulty('NIGHTMARE');
      
    } else if (this.state === "playing") {
      if (this.paused) {
        requestAnimationFrame(() => this.update());
        return;
      }

      if (this.stageTransition) {
        this.updateStageTransition();
        requestAnimationFrame(() => this.update());
        return;
      }
      
      // Update screen shake
      if (this.screenShake.intensity > 0) {
        this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
        this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
        this.screenShake.intensity *= 0.9;
      }
      
      ctx.save();
      ctx.translate(this.screenShake.x, this.screenShake.y);
      
      // Draw background
      this.drawBackground();
      
      // Update and draw game entities
      this.updatePlayer();
      
      // Update bullets
      this.bullets.forEach(b => b.y -= 12);
      this.bullets = this.bullets.filter(b => b.y > -20);
      
      // Update enemies
      this.updateEnemies();
      
      // Wave director: steadier pacing than frame-by-frame random spawning.
      if (!this.boss) {
        this.spawnTimer--;
        const enemyCap = Math.min(11, 8 + Math.floor((this.level - 1) / 3));
        if (this.spawnTimer <= 0 && this.enemies.length < enemyCap) {
          this.spawnEnemy();
          const diffFactor = this.difficulty === 'EASY' ? 1.16 : this.difficulty === 'HARD' ? 0.86 : this.difficulty === 'NIGHTMARE' ? 0.72 : 1;
          const base = Math.max(24, 52 - this.level * 5);
          this.spawnTimer = Math.floor((base + Math.random() * 18) * diffFactor);
          if (this.level >= 3 && this.enemies.length < enemyCap - 1 && Math.random() < Math.min(0.38, 0.16 + this.level * 0.022)) this.spawnEnemy();
        }
      }
      
      // Boss logic
      if (this.levelKills >= CONFIG.KILLS_PER_BOSS && !this.boss) {
        this.spawnBoss();
      }
      
      if (this.boss) {
        this.updateBoss();
      }
      
      // Update enemy bullets
      this.enemyBullets.forEach(b => {
        b.x += b.vx || 0;
        b.y += b.vy || 5;
      });
      this.enemyBullets = this.enemyBullets.filter(b => 
        b.y < 700 && b.y > -20 && b.x > -20 && b.x < 440
      );
      
      // Update powerups
      this.powerups.forEach(p => p.y += 2);
      this.powerups = this.powerups.filter(p => p.y < 700);
      
      // Update combo
      this.updateCombo();
      
      // Check collisions
      this.checkCollisions();
      
      // Update particles
      this.particles.forEach(p => p.update());
      this.particles = this.particles.filter(p => p.life > 0);
      
      // Update floating texts
      this.floatingTexts.forEach(t => t.update());
      this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
      
      // Draw everything
      this.drawPlayer();
      this.drawBullets();
      this.drawEnemies();
      this.drawBoss();
      this.drawPowerups();
      this.drawEnemyBullets();
      
      this.particles.forEach(p => p.draw(ctx));
      this.floatingTexts.forEach(t => t.draw(ctx));

      this.drawPostFX();
      this.drawHUD();
      
      // Check achievements
      this.checkAchievements();
      
      // Game over
      if (this.player.life <= 0) {
        if (this.score > this.hiScore) {
          this.hiScore = this.score;
          localStorage.setItem("hiScore", this.hiScore);
          this.showFeedback("NOVO RECORDE!", "#ff0");
        }
        this.state = "menu";
        this.updateMobileControlsVisibility();
        this.titleY = -80;
        this.titleVy = 0;
        
        // Return to menu music
        AudioSystem.playMusic('menu');
      }
      
      ctx.restore();
      
    } else if (this.state === "victory") {
      // Draw final scene
      this.drawBackground();
      
      ctx.fillStyle = "#fff";
      ctx.font = "bold 48px monospace";
      ctx.textAlign = "center";
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#0ff";
      ctx.fillText("VITÓRIA!", 210, 320);
      ctx.shadowBlur = 0;
    }
    
    requestAnimationFrame(() => this.update());
  }
};

// Initialize game when page loads
window.addEventListener('load', () => {
  Game.init();
  
  // Handle start button for iOS audio unlock
  const startButton = document.getElementById('startButton');
  const startOverlay = document.getElementById('startOverlay');
  
  if (startButton) {
    startButton.addEventListener('click', () => {
      // Resume audio context
      AudioSystem.resumeContext();
      
      // Hide overlay
      startOverlay.style.display = 'none';
      
      // Start menu music
      setTimeout(() => {
        AudioSystem.playMusic('menu');
      }, 100);
    });
  }
});
