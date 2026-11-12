import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Sustained boss test: real boss logic and real canvas artwork, no artificially
// enforced FPS thresholds on GitHub's software-GPU Chromium.
const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[],report={fpsDiagnostic:null,movement:null,particles:[],density:null,turrets:null,longRuns:[],errors};
page.on('pageerror',error=>errors.push('pageerror: '+error.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text());});
try {
  const r=await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  assert.equal(r.status(),200);
  await page.waitForFunction(()=>typeof Game!=='undefined'
    && typeof NSFBattleStability!=='undefined'
    && typeof NSFCombatRenderer!=='undefined');
  await page.locator('#launchGameBtn').click();
  await page.waitForFunction(()=>Game.state==='playing');
  await page.evaluate(()=>{
    const input=document.getElementById('showFps');
    input.checked=true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>{
    const badge=document.getElementById('fpsCounter');
    return badge?.textContent.includes('P95') && badge.textContent.includes('TIROS');
  },null,{timeout:5000});
  report.fpsDiagnostic=await page.locator('#fpsCounter').textContent();
  assert.match(report.fpsDiagnostic,/FPS \d+ · P95 \d+ms · TIROS \d+ · FX \d+/);
  report.movement=await page.evaluate(()=>{
    Game.enemyBullets=[];
    Game.enemies=[];
    Game.player.invuln=999999;
    const bullet={x:170,y:330,vx:2.5,vy:0,color:'#ff3355',r:4.5};
    Game.enemyBullets.push(bullet);
    Game.fixedStep(); // Actual gameplay movement and drawing code
    return {x:bullet.x,y:bullet.y,stillExists:Game.enemyBullets.includes(bullet)};
  });
  assert.equal(report.movement.y,330,'An exactly-horizontal bullet drifted vertically');
  assert.equal(report.movement.x,172.5);
  assert.equal(report.movement.stillExists,true);

  for(const quality of ['low','balanced','high']){
    const particle=await page.evaluate(q=>{
      document.getElementById('graphicsQuality').value=q;
      document.getElementById('graphicsQuality')
        .dispatchEvent(new Event('change',{bubbles:true}));
      Game.particles=[];
      const budget=NSFCombatRenderer.particleLimit;
      Game.createExplosion(80,80,'#eb2222',budget*4,'spark');
      Game.createExplosion(80,80,'#123abc',60,'spark'); // important newest
      const afterImportant=Game.particles.length;
      const newest=Game.particles.filter(p=>p.color==='#123abc').length;
      const before=NSFCombatRenderer.discardedTrails;
      Game.createExplosion(80,80,'#ffffff',40,'trail');
      return {quality:q,budget,afterImportant,newest,
        discarded: NSFCombatRenderer.discardedTrails-before,
        peak:NSFCombatRenderer.peakParticles};
    },quality);
    report.particles.push(particle);
    assert(particle.afterImportant<=particle.budget,'Particle pool exceeded budget');
    assert(particle.newest>=12,'Important impact was discarded by particle saturation');
    assert(particle.discarded>0,'Trail particles should yield to impact FX');
  }

  report.density=await page.evaluate(()=>{
    Game.difficulty='NORMAL';Game.level=10;Game.enemyBullets=[];Game.boss=null;
    Game.spawnBoss();
    const b=Game.boss;b.x=210;b.y=140;b.h=b.maxH*.2;
    b.phase=2;b.patternIndex=3;b.attackTimer=150;
    const original=Array.from({length:158},(_,i)=>({
      x:50+(i%11)*13,y:180+(i%17)*17,vx:0,vy:1,color:'#111',r:4.5
    }));
    Game.enemyBullets=original.slice();
    const skippedBefore=NSFBattleStability.skippedShots;
    Game.updateBoss();
    const normal={budget:NSFBattleStability.currentBulletBudget,
      count:Game.enemyBullets.length,
      oldPreserved: original.every((obj,i)=>Game.enemyBullets[i]===obj),
      suppressed:NSFBattleStability.skippedShots-skippedBefore};
    Game.difficulty='NIGHTMARE';
    Game.enemyBullets=original.slice();
    b.patternIndex=3;b.attackTimer=150;
    Game.updateBoss();
    const nightmare={budget:NSFBattleStability.currentBulletBudget,
      count:Game.enemyBullets.length};
    Game.difficulty='NORMAL';Game.enemyBullets=[];Game.boss=null;
    return {normal,nightmare};
  });
  assert.equal(report.density.normal.budget,160);
  assert(report.density.normal.count<=160 && report.density.normal.count>=158);
  assert.equal(report.density.normal.oldPreserved,true);
  assert(report.density.normal.suppressed>0);
  assert(report.density.nightmare.budget>report.density.normal.budget);
  assert(report.density.nightmare.count>report.density.normal.count);

  report.turrets=await page.evaluate(()=>{
    Game.level=6;Game.boss=null;Game.enemyBullets=[];
    Game.spawnBoss();
    const b=Game.boss;b.type=6;b.x=210;b.y=145;b.h=b.maxH*.2;b.phase=2;
    b.parts=[{id:'left',x:-36,y:17,h:0,maxH:40,destroyed:true},
      {id:'right',x:36,y:17,h:40,maxH:40,destroyed:false}];
    b.attackTimer=150;b.patternIndex=3;
    Game.updateBoss();
    const shots=Game.enemyBullets;
    const removedDestroyedSide=shots.every(s=>s.x>=b.x-8);
    return {remaining:shots.length,removedDestroyedSide};
  });
  assert.equal(report.turrets.removedDestroyedSide,true);
  assert(report.turrets.remaining>0);

  // 1,800 boss simulation ticks = 30 seconds of game-time per profile.
  // Every 5 ticks render real boss and bullet art (not full normal frames);
  // keep existing bullets intact while checking that offscreen culling bounds
  // the array and the boss never stalls its attack cadence.
  for(const q of ['low','balanced','high']){
    const sim=await page.evaluate(async quality=>{
      const select=document.getElementById('graphicsQuality');
      select.value=quality;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      Game.difficulty='NORMAL';
      Game.level=10;
      Game.boss=null;
      Game.enemyBullets=[];
      Game.particles=[];
      Game.player.invuln=999999;
      Game.spawnBoss();
      const boss=Game.boss;
      boss.type=8;boss.x=210;boss.y=140;boss.h=boss.maxH*.18;boss.phase=2;
      const start=performance.now();
      const rates=[],base=Game.frameCount;
      let peak=0,volleyEvents=0,previous=0;
      const originalCtx=Game.ctx;
      for(let tick=0;tick<1800;tick++){
        const before=performance.now();
        Game.frameCount++;
        Game.updateBoss();
        if(Game.enemyBullets.length>previous)volleyEvents++;
        for(const b of Game.enemyBullets) {
          if(!b.dead){b.x+=(b.vx??0);b.y+=(b.vy??5);}
        }
        Game.enemyBullets=Game.enemyBullets.filter(b=>
          !b.dead&&b.y<700&&b.y>-30&&b.x>-30&&b.x<450);
        peak=Math.max(peak,Game.enemyBullets.length);
        previous=Game.enemyBullets.length;
        if(tick%5===0){
          originalCtx.clearRect(0,0,420,640);
          Game.drawBoss();Game.drawEnemyBullets();
        }
        rates.push(performance.now()-before);
        if(tick%300===299)await new Promise(resolve=>setTimeout(resolve,0));
      }
      rates.sort((a,b)=>a-b);
      return {quality,virtualSeconds:30,
        durationMs:+(performance.now()-start).toFixed(1),
        p95IterationMs:+rates[Math.floor(.95*(rates.length-1))].toFixed(2),
        worstIterationMs:+rates[rates.length-1].toFixed(2),
        peakBullets:peak,remainingBullets:Game.enemyBullets.length,
        volleyEvents,frameTicks:Game.frameCount-base,
        budget:NSFBattleStability.currentBulletBudget,
        addedVolleys:NSFBossOptimizer.additionalVolleys};
    },q);
    report.longRuns.push(sim);
    // Chromium also advances its own RAF between the async batches.
    // The manual test advances exactly 1,800 boss ticks; total frameCount
    // can include a few extra real-animation ticks.
    assert(sim.frameTicks>=1800 && sim.frameTicks<1900,
      'Unexpected frameCounter drift during manual boss simulation');
    assert(sim.volleyEvents>=8,'Boss stopped emitting volleys');
    assert(sim.peakBullets<=sim.budget,'Live bullets exceeded normal soft budget');
    assert(sim.remainingBullets>=0);
  }
  assert.deepEqual(errors,[]);
  console.log('SUSTAINED_QA_RESULT='+JSON.stringify(report));
} catch(err){
  console.error('SUSTAINED_QA_FAILED='+String(err));
  console.error('SUSTAINED_QA_PARTIAL='+JSON.stringify(report));
  process.exitCode=1;
} finally {await page.close();await browser.close();}
