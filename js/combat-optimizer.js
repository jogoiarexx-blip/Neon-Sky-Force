"use strict";
/**
 * Neon Sky Force v1.9 — combat rendering fast-path.
 *
 * Enemy hitboxes, attack patterns, movement, boss AI and progression stay
 * entirely in the original simulation. Rendering alone is accelerated for
 * the Balanced / Performance presets; High Quality remains the legacy path.
 */
(() => {
  const originalDrawEnemies = Game.drawEnemies;
  const originalDrawEnemyBullets = Game.drawEnemyBullets;
  const originalCreateExplosion = Game.createExplosion;
  const textures = new Map();
  const cachedTypes = new Set([1, 2, 3, 4, 5, 7]);
  const mainWidth = CONFIG.CANVAS_WIDTH;
  const mainHeight = CONFIG.CANVAS_HEIGHT;
  const spriteSize = 80;
  const spriteScale = 2;
  const byId = id => document.getElementById(id);
  const isFastPath = () => byId('graphicsQuality')?.value !== 'high' ||
    !!byId('reducedEffects')?.checked;
  const quality = () => byId('graphicsQuality')?.value || 'balanced';

  function spriteFor(game, enemy) {
    const flash = enemy.hit > 0;
    const key = enemy.type + ':' + (flash ? 1 : 0);
    if (textures.has(key)) return textures.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = spriteSize * spriteScale;
    canvas.height = spriteSize * spriteScale;
    const offscreen = canvas.getContext('2d', {alpha: true});
    if (!offscreen) return null;

    const savedContext = game.ctx;
    const savedEnemies = game.enemies;
    const source = {
      ...enemy, x: 0, y: 0, r: enemy.r || 15,
      age: 0, buffed: false, formation: '',
      h: Math.max(1, enemy.maxH || enemy.h || 1),
      maxH: Math.max(1, enemy.maxH || enemy.h || 1),
      hit: flash ? 4 : 0,
      fireCooldown: 9999,
      // The charged sniper beam is drawn dynamically outside the sprite.
      aimX: 0, aimY: 0
    };
    try {
      offscreen.setTransform(spriteScale, 0, 0, spriteScale,
        spriteSize * spriteScale / 2, spriteSize * spriteScale / 2);
      game.ctx = offscreen;
      game.enemies = [source];
      originalDrawEnemies.call(game);
    } finally {
      game.ctx = savedContext;
      game.enemies = savedEnemies;
    }
    textures.set(key, canvas);
    return canvas;
  }

  function drawStatus(ctx, e, game) {
    if (e.h < e.maxH && e.maxH > 0) {
      const ratio = Math.max(0, Math.min(1, e.h / e.maxH));
      const y = e.y - 22, x = e.x - 14;
      ctx.fillStyle = 'rgba(2,6,15,.85)';
      ctx.fillRect(x - 1, y - 1, 30, 6);
      ctx.fillStyle = '#fa4d63';
      ctx.fillRect(x, y, 28, 4);
      ctx.fillStyle = ratio > .35 ? '#64ffb0' : '#ffe47e';
      ctx.fillRect(x, y, 28 * ratio, 4);
    }

    if (e.type === 4 && e.fireCooldown <= 34 && e.fireCooldown > 0) {
      const aimX = e.aimX ?? game.player?.x ?? e.x;
      const aimY = e.aimY ?? game.player?.y ?? e.y;
      ctx.save();
      ctx.globalAlpha = .2 + (34 - e.fireCooldown) / 65;
      ctx.strokeStyle = '#6defff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.lineTo(aimX, aimY); ctx.stroke();
      ctx.restore();
    }

    if (e.buffed) {
      ctx.strokeStyle = 'rgba(188,133,255,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, (e.r||16)+6+
        Math.sin((e.age||0)*.08)*2, 0, Math.PI*2); ctx.stroke();
    }
  }

  Game.drawEnemies = function() {
    if (!isFastPath() || !this.enemies?.length) {
      return originalDrawEnemies.call(this);
    }
    const ctx = this.ctx;
    const direct = [];
    ctx.save();

    for (const e of this.enemies) {
      if (e.dead || e.x < -75 || e.x > mainWidth + 75 ||
          e.y < -90 || e.y > mainHeight + 90) continue;
      if (!cachedTypes.has(e.type)) {
        direct.push(e);
        continue;
      }
      const sprite = spriteFor(this, e);
      if (!sprite) { direct.push(e); continue; }
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.type === 5) ctx.rotate(Math.sin((e.age || 0) * .08) * .12);
      ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
      if (e.type === 3) {
        ctx.globalAlpha = .25 + .3 * Math.abs(Math.sin(this.frameCount * .12));
        ctx.fillStyle = '#55ff86';
        ctx.fillRect(-2, 13, 4, 8);
      }
      ctx.restore();
      drawStatus(ctx, e, this);
    }
    ctx.restore();

    // Shield guardians and quantum enemies retain their full custom artwork
    // and animated state, even in low quality.
    if (direct.length) {
      const all = this.enemies;
      try {
        this.enemies = direct;
        originalDrawEnemies.call(this);
      } finally { this.enemies = all; }
    }
  };

  // Draw enemy bullets as two batched vector paths per color instead of
  // applying shadowBlur and constructing three paths to every projectile.
  const bulletGroups = new Map();
  Game.drawEnemyBullets = function() {
    if (!isFastPath()) return originalDrawEnemyBullets.call(this);
    const ctx = this.ctx;
    for (const bullets of bulletGroups.values()) bullets.length = 0;
    for (const b of this.enemyBullets) {
      if (b.dead || b.x < -20 || b.x > mainWidth + 20 ||
          b.y < -25 || b.y > mainHeight + 25) continue;
      const key = b.color || '#ff436c';
      let group = bulletGroups.get(key);
      if (!group) { group = []; bulletGroups.set(key, group); }
      group.push(b);
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (const [color, group] of bulletGroups) {
      if (!group.length) continue;
      ctx.beginPath();
      for (const b of group) {
        ctx.moveTo(b.x - (b.vx||0)*2.5, b.y - (b.vy??5)*2.5);
        ctx.lineTo(b.x, b.y);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = .36;
      ctx.lineWidth = 4.2;
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const b of group) {
        const r = Math.max(3.4, Math.min(5.4, b.r || 4.5));
        ctx.moveTo(b.x + r, b.y);
        ctx.arc(b.x, b.y, r, 0, Math.PI*2);
      }
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (const b of group) {
        ctx.moveTo(b.x+1.4, b.y-1);
        ctx.arc(b.x-0.7, b.y-1, 1.4, 0, Math.PI*2);
      }
      ctx.fill();
    }
    ctx.restore();
  };

  // Restrict particle bursts as they are created, not only at the beginning
  // of the next frame. The original damage/combo effects remain unchanged.
  Game.createExplosion = function(x, y, color, amount=30, type='normal') {
    if (!isFastPath()) return originalCreateExplosion.call(this,x,y,color,amount,type);
    const low = quality() === 'low';
    const limit = low ? 130 : 230;
    const fraction = low ? .52 : .75;
    const available = Math.max(0, limit - (this.particles?.length || 0));
    const visualCount = Math.max(0,Math.min(available,Math.round(amount*fraction)));
    if (visualCount) originalCreateExplosion.call(this,x,y,color,visualCount,type);
  };

  // Provides immutable counters for regression tests without touching input
  // or simulation behavior.
  window.NSFCombatRenderer = Object.freeze({
    get cachedSprites() { return textures.size; },
    get fastMode() { return isFastPath(); },
    get spriteTypes() { return Array.from(cachedTypes); }
  });
})();
