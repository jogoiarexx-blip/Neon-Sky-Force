import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true,
  args:['--use-gl=angle','--use-angle=swiftshader'] });
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[],report={bosses:[],finisher:[],errors};
page.on('pageerror',e=>errors.push('pageerror '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text());});
try {
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof Game !== 'undefined' && typeof NSFBossOptimizer !== 'undefined');
  await page.locator('#launchGameBtn').click();
  await page.waitForFunction(()=>Game.state==='playing');

  // Avoid stage mission interfering with deterministic rendering of all
  // 8 boss archetypes. Drawing the boss is still real canvas artwork.
  await page.evaluate(()=>{
    Game.missionDirector={completed:true};
    Game.player.invuln=36000;
    Game.enemies=[];Game.enemyBullets=[];Game.bullets=[];
    Game.particles=[];Game.floatingTexts=[];
  });

  const sample=await page.evaluate(()=>{
    const results=[],finishers=[];
    const select=document.getElementById('graphicsQuality');
    const game=Game;
    for(const type of [1,2,3,4,5,6,7,8]) {
      game.spawnBoss();
      game.boss.x=210;game.boss.y=160;
      game.boss.type=type;game.boss.phase=2;game.boss.h=game.boss.maxH*.2;
      game.boss.variant=[1,3].includes(type)?2:1;
      game.boss.name='QA BOSS '+type;
      game.boss.parts=[6,8].includes(type)?[
        {id:'left',x:-36,y:17,h:12,maxH:12,destroyed:false},
        {id:'right',x:36,y:17,h:12,maxH:12,destroyed:false}
      ]:[];
      const b=game.boss;
      const info={type,profiles:[]};
      for(const q of ['high','balanced','low']){
        select.value=q;
        const begin=performance.now(), before=NSFBossOptimizer.cacheRenders;
        const previousBullets=game.enemyBullets.length;
        const hx=b.h, xx=b.x, yy=b.y;
        for(let i=0;i<36;i++){game.frameCount++;game.drawBoss();}
        const ms=performance.now()-begin;
        const newRenders=NSFBossOptimizer.cacheRenders-before;
        if(b.h!==hx || b.x!==xx || b.y!==yy)
          throw new Error('Boss simulation state changed inside draw: '+type+'/'+q);
        if(game.enemyBullets.length!==previousBullets)
          throw new Error('Draw emitted shots: '+type+'/'+q);
        info.profiles.push({quality:q,ms:+ms.toFixed(1),redraws:newRenders});
      }
      results.push(info);

      // The third phase finisher is predictable: only pattern 3 -> 4
      // can generate the supplementary volley (types 5-8).
      b.patternIndex=3;b.attackTimer=150;b.phase=2;
      const previous=NSFBossOptimizer.additionalVolleys;
      const beforeShots=game.enemyBullets.length;
      game.updateBoss();
      finishers.push({type,added:game.enemyBullets.length-beforeShots,
        bonus: NSFBossOptimizer.additionalVolleys-previous,
        phase:b.phase});
      game.enemyBullets=[];
      game.boss=null;
    }
    return {results,finishers};
  });
  report.bosses=sample.results; report.finisher=sample.finishers;

  for(const b of report.bosses){
    const high=b.profiles.find(p=>p.quality==='high');
    const balanced=b.profiles.find(p=>p.quality==='balanced');
    const low=b.profiles.find(p=>p.quality==='low');
    assert.equal(high.redraws,0,'high mode should preserve original artwork');
    assert(balanced.redraws>0 && balanced.redraws<=20,'balanced sprite refresh exceeded cadence');
    assert(low.redraws>0 && low.redraws<=11,'low sprite refresh exceeded cadence');
  }
  for(const f of report.finisher){
    assert.equal(f.bonus,f.type>=5?1:0,'finisher fired at wrong boss type');
  }
  assert.deepEqual(errors,[]);
  console.log('BOSS_QA_RESULT='+JSON.stringify(report));
} catch (e) {
  console.error('BOSS_QA_FAILED='+String(e));
  console.error('BOSS_QA_PARTIAL='+JSON.stringify(report));
  process.exitCode=1;
} finally {
  await browser.close();
}
