"use strict";
/*
 * Neon Sky Force v1.9 — 'rasante' (graze) rewards deliberate dodging.
 * A non-lethal near miss awards a small score bonus only once per projectile.
 * Damage, collision radii, movement and rank calculations are untouched.
 */
(() => {
  const oldStartGame = Game.startGame;
  const oldCollisions = Game.checkCollisions;
  const oldHUD = Game.drawHUD;
  Game.grazeCount = 0;

  Game.startGame = function(...args) {
    if (!this._stageStartPending) this.grazeCount = 0;
    return oldStartGame.apply(this, args);
  };

  Game.checkCollisions = function() {
    oldCollisions.call(this); // Register lethal hits before near-miss rewards.
    const p = this.player;
    if (!p || p.invuln > 0 || p.dashFrames > 0 || this.stageTransition) return;
    const hitRadius = p.focus ? CONFIG.PLAYER_FOCUS_HIT_RADIUS : CONFIG.PLAYER_HIT_RADIUS;
    for (const bullet of this.enemyBullets) {
      if (bullet.dead || bullet._grazeAwarded) continue;
      const dx = p.x - bullet.x, dy = p.y - bullet.y;
      const radius = bullet.r || 4.5;
      const safe = hitRadius + radius + 2;
      const outer = safe + 11;
      const d2 = dx*dx+dy*dy;
      if (d2 <= safe*safe || d2 >= outer*outer) continue;
      bullet._grazeAwarded = true;
      this.grazeCount = (this.grazeCount||0)+1;
      this.score += p.focus ? 20 : 12;
      if (this.grazeCount % 8 === 0) {
        this.showFeedback('RASANTES x' + this.grazeCount + '!', '#90fff2');
        AudioSystem.play(680, .075, 'sine', .028);
      }
    }
  };

  Game.drawHUD = function() {
    oldHUD.call(this);
    if (!this.grazeCount) return;
    const ctx=this.ctx;
    ctx.save();
    ctx.textAlign='center';
    ctx.font='bold 9px monospace';
    ctx.fillStyle='#a1ffec';
    ctx.fillText('RASANTES ' + this.grazeCount, 210, 81);
    ctx.restore();
  };
})();
