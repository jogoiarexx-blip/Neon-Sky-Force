// Isolate expensive high-stage scenery from accumulated stage-activation effects.
import {chromium} from 'playwright';
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const results=[],errors=[];
try {
  for(const target of [1,7,9,10]) {
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    page.on('pageerror',e=>errors.push({stage:target,error:e.message}));
    await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'});
    await page.waitForFunction(()=>typeof Game!=='undefined' && typeof StageLoader!=='undefined');
    await page.locator('#launchGameBtn').click();
    await page.waitForFunction(()=>Game.state==='playing',{timeout:25000});
    if(target!==1){
      await page.evaluate(async stage=>{
        await StageLoader.activate(stage);
        StageLoader.release(1);
        Game.level=stage;Game.enemies=[];Game.bullets=[];Game.enemyBullets=[];Game.particles=[];
        Game.initStageMission(); Game.player.invuln=3600;
        AudioSystem.playStage(stage);
      },target);
    } else await page.evaluate(()=>{Game.player.invuln=3600;});
    const result=await page.evaluate(()=>new Promise(resolve=>{
      const t0=performance.now(),frame=Game.frameCount;let n=0,long=0,max=0,prev=t0;
      const go=now=>{const d=now-prev;prev=now;n++;max=Math.max(max,d);if(d>50)long++;
        if(now-t0>=2500)resolve({level:Game.level,ticks:Game.frameCount-frame,duration:(now-t0)/1000,renderFrames:n,maxMs:max,longFrames:long,loadState:StageLoader.memoryState()});
        else requestAnimationFrame(go);
      };requestAnimationFrame(go);
    }));
    results.push(result);
    await page.close();
  }
  console.log('STAGE_ISOLATED_RESULT='+JSON.stringify({results,errors}));
  if(errors.length)process.exitCode=1;
} catch(e) {console.error('STAGE_ISOLATED_ERROR='+String(e));process.exitCode=1}
finally {await browser.close();}
