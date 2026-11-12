import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Regression test with actual Chromium canvas + gameplay code. Not a
// deterministic hardware benchmark; no fixed-FPS threshold in shared CI.
const browser = await chromium.launch({
  headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader']
});
const errors = [];
const results = { stress:[], bossTransition:null, errors };
const target = 'http://127.0.0.1:8765/';

async function start(page) {
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {if(msg.type()==='error')errors.push(msg.text());});
  const response = await page.goto(target, {waitUntil:'load',timeout:30000});
  assert.equal(response.status(), 200);
  await page.waitForFunction(()=>typeof Game!=='undefined' && typeof NSFCombatRenderer!=='undefined');
  await page.locator('#launchGameBtn').click();
  await page.waitForFunction(()=>Game.state==='playing', {timeout:30000});
}

async function sample(page, milliseconds) {
  return await page.evaluate(duration => new Promise(resolve => {
    const start = performance.now(), before = Game.frameCount;
    const frames = []; let previous = start;
    function tick(now) {
      frames.push(now - previous);
      previous = now;
      if(now-start < duration) return requestAnimationFrame(tick);
      const sorted = frames.slice().sort((a,b)=>a-b);
      resolve({
        elapsedSec: +( (now-start)/1000).toFixed(2),
        ticks: Game.frameCount-before, 
        browserFrames:frames.length,
        p95Ms:+(sorted[Math.floor(.95*(sorted.length-1))]||0).toFixed(1),
        worstMs:+Math.max(...frames).toFixed(1),
        stalledFrames:frames.filter(x=>x>50).length,
        enemies:Game.enemies.length,
        enemyBullets:Game.enemyBullets.length,
        cachedSprites:NSFCombatRenderer.cachedSprites,
        state:Game.state
      });
    }
    requestAnimationFrame(tick);
  }),milliseconds);
}

try {
  for(const preset of ['low','balanced','high']) {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    try {
      await start(page);
      await page.evaluate(quality=>{
        const select=document.getElementById('graphicsQuality');
        select.value=quality;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        Game.player.invuln=3600;
        // Spawn actual game enemies so their behavior and renderer execute.
        const types=[1,2,3,4,5,6,7,8,1,2,3,4,5,6,7,8];
        types.forEach((type,i)=>{
          const enemy=Game.spawnEnemy(type,55+(i%8)*43,{y:135+Math.floor(i/8)*115});
          enemy.fireCooldown=600;
          enemy.vy=.15;
          enemy.h=enemy.maxH*.65;
        });
        const palette=['#ff3366','#ffd34d','#6ef7ff','#b877ff','#ff8800','#ff4dff'];
        const random=i=>(Math.sin(i*31.77+7)*10531)%1;
        for(let i=0;i<175;i++){
          const x=22+(i*37)%375, y=105+(i*41)%400;
          Game.enemyBullets.push({x,y,vx:Math.sin(i*.2)*.09,vy:.08,r:4+(i%2),
            color:palette[i%palette.length]});
        }
        for(let i=0;i<2;i++)Game.createExplosion(80+i*240,290,'#ff55dd',80,'spark');
      },preset);
      const reading=await sample(page,2600);
      results.stress.push({profile:preset,...reading,
        graphicsFastPath:await page.evaluate(()=>NSFCombatRenderer.fastMode)});
      assert.equal(reading.state,'playing');
      assert(reading.ticks>=1,'No simulation progress: '+preset);
      if(preset!=='high') assert(reading.cachedSprites>=8,'Enemy sprite cache did not populate');
      else assert.equal(reading.cachedSprites,0,'High preset should retain original drawing');
    } finally {await page.close();}
  }

  // Exercise the actual collision, boss defeat, checkpoint and scripted warp
  // instead of jumping to a stage with StageLoader.activate().
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  try {
    await start(page);
    const injected=await page.evaluate(()=>{
      Game.enemies=[]; Game.enemyBullets=[]; Game.bullets=[];
      Game.player.invuln=1000;
      Game.spawnBoss();
      const b=Game.boss;
      b.x=210; b.y=190; b.h=1;
      Game.bullets.push({x:210,y:190,dmg:50,overdrive:false});
      Game.checkCollisions();
      return {defeated:!Game.boss,transition:!!Game.stageTransition,
        checkpoint:Game.getCheckpoint()?.level || null,
        cleared:Game.lastStageResult?.rank || null};
    });
    assert.equal(injected.defeated,true);
    assert.equal(injected.transition,true);
    assert.equal(injected.checkpoint,2);
    await page.waitForFunction(()=>Game.level===2 && !Game.stageTransition &&
      StageLoader.activeLevel===2 && Game.state==='playing',{timeout:24000});
    const transitioned=await page.evaluate(()=>({
      level:Game.level,gameState:Game.state,checkpoint:Game.getCheckpoint()?.level,
      activated:StageLoader.activeLevel,
      loaded:Array.from(StageLoader.loadedStages.keys()),
      currentMusic:AudioSystem.currentMusic?.constructor?.name,
      score:Game.score
    }));
    assert.deepEqual(transitioned.loaded,[2]);
    results.bossTransition={injected,...transitioned};
  } finally {await page.close();}

  assert.deepEqual(errors, []);
  console.log('COMBAT_QA_RESULT='+JSON.stringify(results));
} catch(error){
  console.error('COMBAT_QA_FAILED='+String(error));
  console.error('COMBAT_QA_PARTIAL='+JSON.stringify(results));
  process.exitCode=1;
} finally {await browser.close();}
