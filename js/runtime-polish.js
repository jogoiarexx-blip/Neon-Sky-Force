"use strict";
/**
 * Neon Sky Force v1.8 — stability, responsive audio and gameplay polish.
 * Patch layer: no stage scripting, damage, checkpoint, scoring or boss tuning changes.
 */
(() => {
  const originalPlayMusic = AudioSystem.playMusic;
  AudioSystem.playMusic = function(type) {
    // startGame initializes level1 through two compatibility layers.
    // Reusing the current soundtrack avoids two sets of timers and an audible reset.
    if (this.enabled && this.currentMusic?.isPlaying && this.currentMusic._nsfTrack === type) return;
    originalPlayMusic(type);
    if (this.currentMusic) this.currentMusic._nsfTrack = type;
  };

  const originalShoot = AudioSystem.shoot;
  AudioSystem.shoot = function() {
    const now = this.context?.currentTime ?? 0;
    // Dense triple shots / overdrive should not stack 15+ separate
    // synth voices per second. Projectiles, cooldowns and damage are unchanged.
    if (this._lastShotSoundTime != null && now - this._lastShotSoundTime < .095) return;
    this._lastShotSoundTime = now;
    originalShoot.call(this);
  };

  const originalTogglePause = Game.togglePause;
  const originalUnpause = Game.unpause;
  function suspendMusic() {
    const current = AudioSystem.currentMusic;
    if (current) {
      Game._musicBeforePause = current._nsfTrack || ('level' + Game.level);
      AudioSystem.stopMusic(); // cancels all pending timers (v1.8)
    }
  }
  function restoreMusic() {
    if (!Game._musicBeforePause) return;
    const track = Game._musicBeforePause;
    Game._musicBeforePause = null;
    if (AudioSystem.enabled && Game.state === 'playing') {
      AudioSystem.resumeContext();
      AudioSystem.playMusic(track);
    }
  }
  Game.togglePause = function() {
    const wasPaused = this.paused;
    originalTogglePause.call(this);
    if (this.state !== 'playing' || wasPaused === this.paused) return;
    if (this.paused) suspendMusic(); else restoreMusic();
  };
  Game.unpause = function() {
    const wasPaused = this.paused;
    originalUnpause.call(this);
    if (wasPaused) restoreMusic();
  };

  // Users must not be shot while switching applications or browser tabs.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.state === 'playing' && !Game.paused) Game.togglePause();
  });

  // Play ambient menu music after the user's first deliberate interaction.
  // Never create an autoplay-blocked AudioContext on silent page load.
  const beginMenuAudio = event => {
    if (Game.state !== 'menu' || !AudioSystem.enabled || AudioSystem.currentMusic) return;
    if (event.target?.closest?.('#launchGameBtn, #menuContinueBtn')) return;
    AudioSystem.resumeContext();
    AudioSystem.playMusic('menu');
  };
  document.addEventListener('pointerdown', beginMenuAudio, { passive:true });
  document.addEventListener('keydown', beginMenuAudio);

  // Small accessibility / gameplay fix: nearby upgrades drift gently to
  // the player, making pickups less frustrating during bullet-heavy waves.
  const originalFixedStep = Game.fixedStep;
  Game.fixedStep = function() {
    if (this.state === 'playing' && !this.paused && !this.stageTransition && this.player) {
      for (const upgrade of this.powerups) {
        if (upgrade.collected) continue;
        const dx = this.player.x - upgrade.x;
        const dy = this.player.y - upgrade.y;
        const distance2 = dx*dx + dy*dy;
        if (distance2 > 225 && distance2 < 68*68) {
          const speed = Math.min(2.0, 1.3 + (68 - Math.sqrt(distance2))*.017);
          const invDistance = 1 / Math.sqrt(distance2);
          upgrade.x += dx * invDistance * speed;
          upgrade.y += dy * invDistance * speed;
        }
      }
    }
    return originalFixedStep.call(this);
  };

  // Keep menu overlay accessible after ending a game: avoid carrying
  // a stale paused-track restore into a new campaign.
  const originalReturnToMenu = Game.returnToMenu;
  Game.returnToMenu = function() {
    this._musicBeforePause = null;
    return originalReturnToMenu.call(this);
  };
})();
