"use strict";
/**
 * Neon Sky Force v1.8
 * Reusable crisp ship sprite for balanced/low quality.
 * Reduces per-frame gradients and expensive shadowBlur filters in combat.
 */
(() => {
  const drawOriginal = Game.drawPlayer;
  const cache = new Map();
  function useCache() {
    return document.getElementById('graphicsQuality')?.value !== 'high';
  }
  function getShipSprite(weapon) {
    const key = Math.max(1, Math.min(3, Math.round(Number(weapon)||1)));
    if (cache.has(key)) return cache.get(key);
    const image = document.createElement('canvas');
    image.width = 256;
    image.height = 272;
    const fakeCtx = image.getContext('2d', {alpha:true});
    const gameCtx = Game.ctx, realPlayer=Game.player;
    if (!fakeCtx || !realPlayer) return null;
    try {
      fakeCtx.setTransform(2,0,0,2,0,0);
      Game.ctx = fakeCtx;
      Game.player = {...realPlayer,x:64,y:62,weapon:key,bank:0,invuln:0,shield:0,focus:false};
      drawOriginal.call(Game);
    } finally {
      Game.ctx=gameCtx;
      Game.player=realPlayer;
    }
    cache.set(key,image);
    return image;
  }

  Game.drawPlayer = function() {
    const p=this.player;
    if (!p || (p.invuln>0 && Math.floor(p.invuln/5)%2===0)) return;
    if (!useCache()) {drawOriginal.call(this);return;}
    const sprite=getShipSprite(p.weapon);
    if (!sprite) {drawOriginal.call(this);return;}
    const ctx=this.ctx;
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate((p.bank||0)*.12);
    ctx.drawImage(sprite,-64,-62,128,136);

    // Small dynamic exhaust accent maintains motion without new gradients.
    const pulse=.66+Math.sin(this.frameCount*.25)*.3;
    ctx.globalAlpha=pulse;
    ctx.fillStyle=p.overdriveTimer>0?'#ffe660':'#4defff';
    ctx.fillRect(-6,18,3,9);
    ctx.fillRect(3,18,3,9);
    ctx.globalAlpha=1;

    // Shield and focus are gameplay state and must not be cached.
    if(p.shield>0){
      ctx.strokeStyle='rgba(93,226,255,.77)';
      ctx.lineWidth=1.8;
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3-Math.PI/2;
        const x=Math.cos(a)*27,y=Math.sin(a)*27;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.closePath();ctx.stroke();
      for(let i=0;i<Math.min(3,p.shield);i++){
        const a=this.frameCount*.045+i*2*Math.PI/Math.min(3,p.shield);
        ctx.fillStyle='#8ff9ff';ctx.fillRect(Math.cos(a)*25-1,Math.sin(a)*25-1,3,3);
      }
    }
    if(p.focus){
      ctx.strokeStyle='rgba(255,255,255,.85)';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#fff';ctx.fillRect(-1,-1,2,2);
    }
    ctx.restore();
  };
})();
