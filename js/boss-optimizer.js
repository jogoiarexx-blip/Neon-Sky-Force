"use strict";
/*
 * Neon Sky Force v2.0 - Boss Rendering / Telegraph / Phase-3 Patterns
 *
 * No changes to hitboxes, HP, player damage, score or save format.
 * The canonical boss art is rendered into a reusable canvas at a lower
 * cadence on balanced/low quality. Boss position is composited at 60Hz.
 */
(() => {
  const drawBossOriginal = Game.drawBoss;
  const updateBossOriginal = Game.updateBoss;
  const textureSize = 256;
  const caches = new Map();
  let renders = 0, reused = 0, bonusVolleys = 0;

  const getProfile = () => document.getElementById('graphicsQuality')?.value || 'balanced';
  const isLite = () => getProfile() !== 'high' || !!document.getElementById('reducedEffects')?.checked;
  function getInterval(b) {
    return Math.max(22, 62 - b.phase * 13 - (b.variant > 1 ? 10 : 0)
      - (b.type === 7 ? 8 : b.type === 8 ? 12 : 0));
  }
  function cacheKey(b) {
    return [
      b.type, b.variant, b.phase, b.hit > 0 ? 1 : 0,
      ...(b.parts || []).map(p => p.destroyed ? 'x' : p.h <= p.maxH * .35 ? 'low' : 'ok')
    ].join(':');
  }

  function renderBoss(game, state, entry) {
    const context = entry.canvas.getContext('2d', {alpha:true});
    if (!context) return false;
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,entry.canvas.width,entry.canvas.height);
    context.setTransform(entry.scale,0,0,entry.scale,0,0);

    // The legacy renderer reads ctx and b.x/y to draw canonical geometry.
    // Only those fields are swapped, synchronously and restored even if it
    // throws. Never run AI, update, collision or persistent state here.
    const prevCtx = game.ctx;
    const px=state.x, py=state.y;
    try {
      game.ctx=context;
      state.x=textureSize/2;
      state.y=textureSize/2;
      drawBossOriginal.call(game);
    } finally {
      state.x=px;
      state.y=py;
      game.ctx=prevCtx;
    }
    renders++;
    return true;
  }

  function warning(game,b) {
    if (b.y < 78 || b.defeated) return;
    const interval = getInterval(b), remaining=interval-b.attackTimer;
    if (remaining <= 0 || remaining > 21) return;
    const ctx=game.ctx, alpha=Math.max(.12,1-remaining/24);
    const color=b.phase===2?'#ff6273':b.phase===1?'#ffc857':'#9ceaff';
    ctx.save();
    ctx.strokeStyle=color;
    ctx.lineWidth=1.4;
    ctx.globalAlpha=alpha*.85;
    ctx.setLineDash([5,5]);
    ctx.beginPath();
    ctx.arc(b.x,b.y,74+Math.sin(game.frameCount*.2)*2,
      -Math.PI/2, -Math.PI/2 + (1-remaining/22)*Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Aimed shots become predictable rather than invisible instant fire.
    // Leave lines subtle so visual warnings don't obscure projectiles.
    if ([3,4,6,7,8].includes(b.type) && game.player) {
      const angle=Math.atan2(game.player.y-b.y,game.player.x-b.x);
      ctx.globalAlpha=alpha*.22;
      ctx.beginPath();
      ctx.moveTo(b.x+Math.cos(angle)*34,b.y+Math.sin(angle)*34);
      ctx.lineTo(b.x+Math.cos(angle)*190,b.y+Math.sin(angle)*190);
      ctx.stroke();
    }
    ctx.restore();
  }

  Game.drawBoss = function() {
    const b=this.boss;
    if (!b) return;
    // These bosses are already cheap to draw on normal desktop graphics:
    // repeatedly copying an offscreen 1.4x atlas was slower than their
    // original vector art in the browser benchmark.
    const profile=getProfile();
    // Benchmark-informed selection:
    // low benefits on the expensive gradient-heavy first four bosses;
    // balanced only amortizes the cache on the first three.
    // The simpler late-game geometries are cheaper to draw directly.
    const cacheThisBoss = isLite() &&
      (profile==='low' ? b.type<=4 : profile==='balanced' && b.type<=3);
    if (!cacheThisBoss) {
      drawBossOriginal.call(this);
      warning(this,b);
      return;
    }
    let entry=caches.get(getProfile());
    if (!entry) {
      const canvas=document.createElement('canvas');
      const scale=1; // lower cache cost; the game canvas handles final DPR.
      canvas.width=Math.ceil(textureSize*scale);
      canvas.height=Math.ceil(textureSize*scale);
      entry={canvas,scale,instance:null,key:null,lastFrame:-Infinity,ready:false};
      caches.set(getProfile(),entry);
    }
    const key=cacheKey(b), cadence=getProfile()==='low'?4:3;
    const need=!entry.ready || entry.instance!==b || entry.key!==key
      || this.frameCount-entry.lastFrame>=cadence;
    if (need) {
      if (renderBoss(this,b,entry)) {
        entry.ready=true;
        entry.instance=b;
        entry.key=key;
        entry.lastFrame=this.frameCount;
      } else {
        drawBossOriginal.call(this);
        warning(this,b);
        return;
      }
    } else reused++;

    const ctx=this.ctx;
    ctx.drawImage(entry.canvas,b.x-textureSize/2,b.y-textureSize/2,
      textureSize,textureSize);
    warning(this,b);
  };

  Game.updateBoss = function() {
    const b=this.boss;
    if (!b) return updateBossOriginal.call(this);
    const previousPattern=b.patternIndex;
    updateBossOriginal.call(this);
    if (this.boss!==b || b.defeated || b.phase!==2 || b.y<78 ||
        b.patternIndex===previousPattern || b.patternIndex % 4 !== 0) return;

    // A modest, predictable finisher every fourth volley in the final phase.
    // Distinctively positioned turret shots preserve a safe dodge window.
    const shots=[];
    const player=this.player;
    if (!player) return;
    const aimed=(x,y,speed,offset,color)=>{
      const a=Math.atan2(player.y-y,player.x-x)+offset;
      shots.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color,r:4.5});
    };
    if (b.type===5) {
      aimed(b.x-36,b.y+19,4.05,-.14,'#4effd9');
      aimed(b.x+36,b.y+19,4.05,.14,'#4effd9');
    } else if (b.type===6) {
      for(const part of b.parts||[]) {
        if (!part.destroyed) aimed(b.x+part.x,b.y+part.y,4.2,
          part.x<0?-.17:.17,'#ffbd58');
      }
    } else if (b.type===7) {
      aimed(b.x-28,b.y+10,4.35,-.22,'#72d9ff');
      aimed(b.x+28,b.y+10,4.35,.22,'#72d9ff');
    } else if (b.type===8) {
      for(const offset of [-.22,0,.22]) aimed(b.x,b.y+30,4.2,offset,'#ff88f5');
    }
    if (shots.length) {
      this.enemyBullets.push(...shots);
      bonusVolleys++;
    }
  };

  window.NSFBossOptimizer = Object.freeze({
    get cacheRenders() { return renders; },
    get cacheReuses() { return reused; },
    get additionalVolleys() { return bonusVolleys; },
    get cacheEntries() { return caches.size; },
    get active() { return isLite(); }
  });
})();
