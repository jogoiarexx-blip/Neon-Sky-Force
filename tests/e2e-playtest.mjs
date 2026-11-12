// Headless Chromium playtest. This executes real gameplay code and canvas rendering.
// Headless FPS is a regression signal, NOT a guaranteed hardware FPS benchmark.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport:{width:1366,height:768}, deviceScaleFactor:1 });
const errors = [], logs=[];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => {if(msg.type()==='error') logs.push(msg.text())});
page.on('requestfailed', request=>logs.push('request failed '+request.url()+': '+request.failure()?.errorText));
let report = {date:new Date().toISOString(),resolutions:[],gameplay:{},audio:{},stages:[],errors,logs};
try {
  const response=await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof Game !== 'undefined' && typeof StageLoader !== 'undefined' && typeof AudioSystem !== 'undefined',{timeout:15000});
  for(const size of [{width:1366,height:768},{width:390,height:844},{width:1024,height:600}]){
    await page.setViewportSize(size);
    await page.waitForTimeout(220);
    const bounds=await page.evaluate(()=>{
      const ov=document.querySelector('#startOverlay'),panel=document.querySelector('.launch-panel');
      const r=panel.getBoundingClientRect();
      return {scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth, panelX:r.left,panelRight:r.right,screen:innerWidth,scrollHeight:ov.scrollHeight,clientHeight:ov.clientHeight};
    });
    report.resolutions.push({...size,...bounds});
    assert(bounds.scrollWidth<=bounds.clientWidth+4,JSON.stringify(bounds));
    assert(bounds.panelX>=-5 && bounds.panelRight<=bounds.screen+5,JSON.stringify(bounds));
  }
  await page.setViewportSize({width:1366,height:768});
  await page.locator('[data-difficulty="NORMAL"]').click();
  await page.locator('#launchGameBtn').click();
  await page.waitForFunction(()=>Game.state==='playing',{timeout:30000});
  report.audio.initial = await page.evaluate(()=>({enabled:AudioSystem.enabled,state:AudioSystem.context?.state,music:AudioSystem.currentMusic?.constructor?.name}));
  await page.keyboard.down('Space');
  await page.keyboard.down('ArrowLeft');
  // Make the player survive to actually benchmark firing and stage logic.
  await page.evaluate(()=>{Game.player.invuln=3600;});
  const perf=await page.evaluate(async()=>{
    const before=Game.frameCount, t0=performance.now(), samples=[];
    let old=performance.now();
    return await new Promise(resolve=>{
      function tick(now){
        const dt=now-old;old=now;
        if(dt>0 && samples.length<2000)samples.push(dt);
        if(now-t0>=7500) {
          const sorted=samples.slice().sort((a,b)=>a-b);
          resolve({frames:Game.frameCount-before,seconds:(now-t0)/1000,averageFrameMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)]||0,p99FrameMs:sorted[Math.floor(sorted.length*.99)]||0,rafCount:samples.length,enemyCount:Game.enemies.length,bullets:Game.bullets.length,state:Game.state});
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  });
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowLeft');
  report.gameplay=perf;
  assert(perf.frames>120,'simulation did not advance in 7.5s');
  assert.equal(perf.state,'playing');
  // Pause/resume and audio instance ownership.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(240);
  report.audio.pause = await page.evaluate(()=>({paused:Game.paused,context:AudioSystem.context?.state,playing:AudioSystem.currentMusic?.isPlaying}));
  assert.equal(report.audio.pause.paused,true);
  await page.locator('#resumeBtn').click();
  assert.equal(await page.evaluate(()=>Game.paused),false);
  // Visit ten real stage modules using StageLoader; render each one for ~0.7s.
  for(let level=1;level<=10;level++){
    const beforeFrame = await page.evaluate(()=>Game.frameCount);
    const result=await page.evaluate(async lvl=>{
      const prev = StageLoader.activeLevel;
      await StageLoader.activate(lvl);
      if (prev && prev !== lvl) StageLoader.release(prev);
      Game.level=lvl;Game.boss=null;Game.bossIntro=null;Game.stageTransition=null;
      Game.enemies=[];Game.enemyBullets=[];Game.bullets=[];Game.powerups=[];Game.particles=[];Game.floatingTexts=[];
      Game.initStageMission();
      Game.player.invuln=3600;
      AudioSystem.playStage(lvl);
      return {level:Game.level,levelName:CONFIG.LEVELS[lvl]?.name,stageActive:StageLoader.activeLevel,music:AudioSystem.currentMusic?.constructor?.name};
    },level);
    await page.waitForTimeout(700);
    const final=await page.evaluate(()=>({frame:Game.frameCount,enemyCount:Game.enemies.length,state:Game.state,loadedStageCount:StageLoader.loadedStages.size,heapMB:performance.memory?.usedJSHeapSize/1048576||null}));
    report.stages.push({...result,...final,stepFrames:final.frame-beforeFrame});
    assert.equal(final.state,'playing');
  }
  // Unload the current music and verify no lingering procedural timers after stop.
  report.audio.final=await page.evaluate(()=>{
    const old=AudioSystem.currentMusic;
    AudioSystem.stopMusic();
    return {oldClass:old?.constructor?.name,stopFlag:old?.isPlaying,pendingTimerCount:old?.timers?.length??old?._timers?.size??null};
  });
  assert.equal(report.audio.final.stopFlag,false);
  assert.equal(errors.length,0,'page errors: '+errors.join('; '));
  console.log('QA_PLAYTEST_REPORT='+JSON.stringify(report));
} catch(error) {
  console.error('QA_PLAYTEST_FAILED='+String(error));
  console.error('QA_PARTIAL_REPORT='+JSON.stringify(report));
  process.exitCode=1;
} finally { await fs.writeFile('qa-report.json',JSON.stringify(report,null,2)); await browser.close(); }
