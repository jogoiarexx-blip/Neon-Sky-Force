"use strict";

/* Neon Sky Force v1.5 - Complete Systems Overhaul
   Keeps the v1.4 campaign/assets and replaces the weak points of the runtime:
   fixed 60 Hz simulation, scripted waves, boss intros, fair hitboxes, checkpoints,
   mission ranks, persistent records, remapping/settings and richer enemy mechanics. */

(() => {
  const STORAGE = {
    settings: 'nsf_v15_settings',
    checkpoint: 'nsf_v15_checkpoint',
    ranks: 'nsf_v15_best_ranks',
    bosses: 'nsf_v15_bosses',
    achievements: 'nsf_v15_achievements'
  };

  Object.assign(CONFIG, {
    FIXED_FPS: 60,
    FIXED_STEP_MS: 1000 / 60,
    BOSS_INTRO_FRAMES: 150,
    PLAYER_HIT_RADIUS: 7,
    PLAYER_FOCUS_HIT_RADIUS: 4
  });

  // Two extra enemy families become part of the late-game campaign.
  CONFIG.LEVELS[5].enemyTypes = [2,3,4,5,7];
  CONFIG.LEVELS[6].enemyTypes = [2,4,5,6,7];
  CONFIG.LEVELS[7].enemyTypes = [3,4,5,6,7,8];
  CONFIG.LEVELS[8].enemyTypes = [4,5,6,7,8];
  CONFIG.LEVELS[9].enemyTypes = [3,4,5,6,7,8];
  CONFIG.LEVELS[10].enemyTypes = [4,5,6,7,8,8];

  const ENEMY_STATS = {
    1: {health:30, radius:12, speed:2.5, fireRate:120, points:100, color:'#f0f'},
    2: {health:50, radius:16, speed:1.8, fireRate:145, points:220, color:'#ff0'},
    3: {health:40, radius:14, speed:2.2, fireRate:112, points:170, color:'#0f0'},
    4: {health:46, radius:13, speed:2.0, fireRate:150, points:260, color:'#00ddff'},
    5: {health:34, radius:12, speed:3.0, fireRate:130, points:240, color:'#ff4dff'},
    6: {health:78, radius:18, speed:1.55, fireRate:165, points:360, color:'#ffd34d'},
    7: {health:94, radius:19, speed:1.35, fireRate:190, points:450, color:'#6ef7ff'},
    8: {health:68, radius:17, speed:1.50, fireRate:135, points:400, color:'#b877ff'}
  };

  const MISSION_PATTERNS = {
    1: ['line','v','zigzag','elite'],
    2: ['pincer','line','v','ambush'],
    3: ['zigzag','swarm','column','elite'],
    4: ['cross','pincer','swarm','ambush','elite'],
    5: ['v','escort','pincer','swarm','elite'],
    6: ['column','escort','cross','ambush','elite'],
    7: ['pincer','swarm','escort','zigzag','elite'],
    8: ['cross','column','escort','ambush','elite'],
    9: ['swarm','pincer','cross','escort','elite'],
    10:['ambush','escort','swarm','cross','elite']
  };

  const WAVE_LABELS = {
    line:'LINHA DE ATAQUE', v:'FORMAÇÃO V', zigzag:'INTERCEPTORES', elite:'UNIDADE ELITE',
    pincer:'ATAQUE PINÇA', ambush:'EMBOSCADA', swarm:'ENXAME', column:'COLUNA DE ASSALTO',
    cross:'FOGO CRUZADO', escort:'ESCOLTA PESADA'
  };

  const ACHIEVEMENT_NAMES = {
    firstKill:'Primeira Destruição', firstBoss:'Primeiro Boss', weapon3:'Arma Nível 3',
    score10k:'10.000 Pontos', score50k:'50.000 Pontos', combo50:'Combo x50',
    perfect:'Missão Perfeita', nightmare:'Dominou o Pesadelo'
  };

  const DEFAULT_SETTINGS = {
    musicVolume: 30,
    sfxVolume: 15,
    gamepadDeadzone: 20,
    keyboard: {
      moveLeft:'KeyA', moveRight:'KeyD', moveUp:'KeyW', moveDown:'KeyS',
      fire:'Space', dash:'KeyC', focus:'ShiftLeft', pause:'KeyP'
    },
    gamepad: { fire:0, dash:5, focus:6, pause:9 }
  };

  const KEY_LABELS = {
    moveLeft:'ESQUERDA', moveRight:'DIREITA', moveUp:'CIMA', moveDown:'BAIXO',
    fire:'ATIRAR', dash:'DASH', focus:'PRECISÃO', pause:'PAUSA'
  };
  const PAD_LABELS = { fire:'ATIRAR', dash:'DASH', focus:'PRECISÃO', pause:'PAUSA' };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function safeParse(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function circleHit(ax, ay, ar, bx, by, br) { const dx=ax-bx, dy=ay-by, r=ar+br; return dx*dx+dy*dy <= r*r; }
  function rankValue(rank) { return ({S:4,A:3,B:2,C:1})[rank] || 0; }

  /* ---------- Six additional procedural stage identities ---------- */
  class StageThemeMusic extends ProceduralMusic {
    constructor(context, destination, level) { super(context, destination); this.level = level; this.timers = []; }
    later(fn, ms) { const id=setTimeout(fn, ms); this.timers.push(id); }
    stop() { this.timers.forEach(clearTimeout); this.timers=[]; super.stop(); }
    start() {
      this.isPlaying = true;
      const presets = {
        5:{bpm:126,base:73.42,wave:'sine',scale:[1,1.2,1.5,1.8],accent:'triangle'},
        6:{bpm:150,base:55,wave:'sawtooth',scale:[1,1.25,1.5,2],accent:'square'},
        7:{bpm:138,base:65.41,wave:'triangle',scale:[1,1.189,1.498,1.782],accent:'sawtooth'},
        8:{bpm:118,base:82.41,wave:'sine',scale:[1,1.334,1.587,2],accent:'triangle'},
        9:{bpm:166,base:58.27,wave:'square',scale:[1,1.122,1.498,1.888],accent:'sawtooth'},
        10:{bpm:172,base:55,wave:'sawtooth',scale:[1,1.26,1.5,2],accent:'square'}
      };
      this.preset = presets[this.level] || presets[5];
      const drone = this.createOscillator(this.preset.base, this.preset.wave, 0.035);
      const drone2 = this.createOscillator(this.preset.base * 1.5, 'sine', 0.018, this.level % 2 ? 7 : -7);
      drone.osc.start(); drone2.osc.start();
      this.sequence(0);
    }
    sequence(step) {
      if (!this.isPlaying) return;
      const p=this.preset, beat=60/p.bpm, scale=p.scale;
      const idx=(step * (this.level % 3 + 1) + (step>>2)) % scale.length;
      const octave = step % 8 >= 6 ? 2 : 1;
      const osc=this.context.createOscillator(), gain=this.context.createGain();
      osc.type=p.accent; osc.frequency.value=p.base*4*scale[idx]*octave;
      gain.gain.value=this.level>=9?0.035:0.028;
      osc.connect(gain); gain.connect(this.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001,this.context.currentTime+beat*0.8); osc.stop(this.context.currentTime+beat*0.8);
      if (step % (this.level>=9?2:4)===0) {
        const kick=this.context.createOscillator(), kg=this.context.createGain();
        kick.type='sine'; kick.frequency.value=90; kg.gain.value=0.10; kick.connect(kg); kg.connect(this.destination); kick.start();
        kick.frequency.exponentialRampToValueAtTime(38,this.context.currentTime+0.12); kg.gain.exponentialRampToValueAtTime(0.001,this.context.currentTime+0.18); kick.stop(this.context.currentTime+0.18);
      }
      this.later(()=>this.sequence((step+1)%16),beat*1000);
    }
  }

  const originalPlayMusic = AudioSystem.playMusic.bind(AudioSystem);
  AudioSystem.playMusic = function(type) {
    const match = /^level(\d+)$/.exec(String(type));
    if (match && Number(match[1]) >= 5) {
      if (!this.enabled || !this.context) return;
      this.stopMusic();
      this.currentMusic = new StageThemeMusic(this.context, this.musicGain, Number(match[1]));
      this.currentMusic.start();
      return;
    }
    originalPlayMusic(type);
  };
  AudioSystem.playStage = function(level) { this.playMusic('level' + Math.max(1, Math.min(10, level))); };
  AudioSystem.applyVolumes = function(settings) {
    this.musicVolume = Math.max(0, Math.min(1, settings.musicVolume / 100));
    this.sfxVolume = Math.max(0, Math.min(1, settings.sfxVolume / 100));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  };

  /* ---------- Capture v1.4 methods that are still useful ---------- */
  const legacy = {
    startGame: Game.startGame,
    drawEnemies: Game.drawEnemies,
    drawPlayer: Game.drawPlayer,
    drawBoss: Game.drawBoss,
    updateBoss: Game.updateBoss,
    beginStageTransition: Game.beginStageTransition,
    switchStageAtMidpoint: Game.switchStageAtMidpoint,
    updateStageTransition: Game.updateStageTransition,
    drawHUD: Game.drawHUD,
    unlockAchievement: Game.unlockAchievement,
    showVictory: Game.showVictory,
    returnToMenu: Game.returnToMenu,
    toggleSound: Game.toggleSound
  };

  Game.loadV15Settings = function() {
    const saved=safeParse(localStorage.getItem(STORAGE.settings),{});
    this.settings=clone(DEFAULT_SETTINGS);
    Object.assign(this.settings,saved);
    this.settings.keyboard=Object.assign({},DEFAULT_SETTINGS.keyboard,saved.keyboard||{});
    this.settings.gamepad=Object.assign({},DEFAULT_SETTINGS.gamepad,saved.gamepad||{});
    this.checkpoint=safeParse(localStorage.getItem(STORAGE.checkpoint),null);
    this.bestRanks=safeParse(localStorage.getItem(STORAGE.ranks),{});
    this.bossRecords=safeParse(localStorage.getItem(STORAGE.bosses),{});
    this.persistentAchievements=safeParse(localStorage.getItem(STORAGE.achievements),{});
  };

  Game.saveSettings = function() { localStorage.setItem(STORAGE.settings,JSON.stringify(this.settings)); AudioSystem.applyVolumes(this.settings); };
  Game.saveRecords = function() {
    localStorage.setItem(STORAGE.ranks,JSON.stringify(this.bestRanks||{}));
    localStorage.setItem(STORAGE.bosses,JSON.stringify(this.bossRecords||{}));
    localStorage.setItem(STORAGE.achievements,JSON.stringify(this.persistentAchievements||{}));
  };

  Game.init = function() {
    this.canvas=document.getElementById('game');
    this.ctx=this.canvas.getContext('2d');
    this.setupCanvasResolution();
    this.hiScore=parseInt(localStorage.getItem('hiScore')||'0');
    this.loadV15Settings();
    AudioSystem.musicVolume=this.settings.musicVolume/100;
    AudioSystem.sfxVolume=this.settings.sfxVolume/100;
    AudioSystem.init();
    AudioSystem.applyVolumes(this.settings);
    this.setupInput();
    this.setupUiButtons();
    this.setupV15Ui();
    this.initBackground();
    this._lastRaf=0; this._accumulator=0;
    this.updateMenuActions();
    this.update();
  };

  Game.setupV15Ui = function() {
    this.touchDash=false; this.touchFocus=false; this.remapKeyboardAction=null; this.remapGamepadAction=null; this._padButtons=[];
    const byId=id=>document.getElementById(id);
    const bind=(id,fn)=>byId(id)?.addEventListener('click',fn);

    const dash=byId('dashBtn'), focus=byId('focusBtn'), pause=byId('mobilePauseBtn');
    if (dash) {
      dash.addEventListener('pointerdown',e=>{e.preventDefault();this.touchDash=true;AudioSystem.resumeContext();});
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>dash.addEventListener(ev,()=>{this.touchDash=false;}));
    }
    if (focus) {
      focus.addEventListener('pointerdown',e=>{e.preventDefault();this.touchFocus=true;AudioSystem.resumeContext();});
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>focus.addEventListener(ev,()=>{this.touchFocus=false;}));
    }
    pause?.addEventListener('pointerdown',e=>{e.preventDefault();if(this.state==='playing')this.togglePause();});

    bind('settingsBtn',()=>this.openSettings(true));
    bind('menuSettingsBtn',()=>this.openSettings(false));
    bind('closeSettingsBtn',()=>this.closeSettings());
    bind('resetBindingsBtn',()=>{this.settings.keyboard=clone(DEFAULT_SETTINGS.keyboard);this.settings.gamepad=clone(DEFAULT_SETTINGS.gamepad);this.saveSettings();this.renderBindings();});
    bind('menuContinueBtn',()=>this.continueFromCheckpoint());
    bind('continueBtn',()=>this.continueFromCheckpoint());
    bind('retryBtn',()=>this.startGame());
    bind('gameOverMenuBtn',()=>{this.hideGameOver();this.returnToMenu();});
    bind('recordsBtn',()=>this.openRecords());
    bind('closeRecordsBtn',()=>this.closeRecords());

    const setSlider=(id,key,valueId)=>{
      const el=byId(id), out=byId(valueId); if(!el)return;
      el.value=this.settings[key]; if(out)out.textContent=this.settings[key]+'%';
      el.addEventListener('input',()=>{this.settings[key]=Number(el.value);if(out)out.textContent=el.value+'%';this.saveSettings();});
    };
    setSlider('musicVolume','musicVolume','musicVolumeValue');
    setSlider('sfxVolume','sfxVolume','sfxVolumeValue');
    setSlider('gamepadDeadzone','gamepadDeadzone','gamepadDeadzoneValue');

    // Capture phase lets remapping consume the key before the old gameplay handler sees it.
    window.addEventListener('keydown',e=>{
      if (this.remapKeyboardAction) {
        e.preventDefault(); e.stopImmediatePropagation();
        this.settings.keyboard[this.remapKeyboardAction]=e.code;
        this.remapKeyboardAction=null; this.saveSettings(); this.renderBindings();
        return;
      }
      const pauseCode=this.settings.keyboard.pause;
      if (this.state==='playing' && !e.repeat && e.code===pauseCode && e.code!=='KeyP' && e.code!=='Escape') {
        e.preventDefault(); this.togglePause();
      }
      if (this.state==='menu' && !e.repeat && e.code==='KeyC' && this.getCheckpoint()) this.continueFromCheckpoint();
    },true);

    this.renderBindings();
  };

  Game.renderBindings = function() {
    const kb=document.getElementById('keyboardBindings'), gp=document.getElementById('gamepadBindings');
    if (kb) {
      kb.innerHTML='';
      Object.keys(KEY_LABELS).forEach(action=>{
        const b=document.createElement('button'); b.type='button'; b.className='bind-btn'+(this.remapKeyboardAction===action?' waiting':'');
        b.textContent=`${KEY_LABELS[action]}: ${this.formatKey(this.settings.keyboard[action])}`;
        b.addEventListener('click',()=>{this.remapKeyboardAction=action;this.remapGamepadAction=null;this.renderBindings();const h=document.getElementById('bindingHint');if(h)h.textContent='Pressione a nova tecla para '+KEY_LABELS[action]+'.';});
        kb.appendChild(b);
      });
    }
    if (gp) {
      gp.innerHTML='';
      Object.keys(PAD_LABELS).forEach(action=>{
        const b=document.createElement('button'); b.type='button'; b.className='bind-btn'+(this.remapGamepadAction===action?' waiting':'');
        b.textContent=`${PAD_LABELS[action]}: BOTÃO ${this.settings.gamepad[action]}`;
        b.addEventListener('click',()=>{this.remapGamepadAction=action;this.remapKeyboardAction=null;this.renderBindings();const h=document.getElementById('bindingHint');if(h)h.textContent='Pressione no controle o novo botão para '+PAD_LABELS[action]+'.';});
        gp.appendChild(b);
      });
    }
  };
  Game.formatKey = function(code) { return String(code||'').replace(/^Key/,'').replace(/^Digit/,'').replace('Arrow','').replace('ShiftLeft','SHIFT').replace('ShiftRight','SHIFT').replace('Space','ESPAÇO'); };

  Game.openSettings = function(fromPause=false) {
    this.settingsFromPause=fromPause && this.state==='playing';
    if (this.settingsFromPause) {
      this.paused=true;
      const po=document.getElementById('pauseOverlay'); if(po)po.style.display='none';
    }
    const ov=document.getElementById('settingsOverlay'); if(ov){ov.style.display='flex';ov.setAttribute('aria-hidden','false');}
    this.renderBindings();
  };
  Game.closeSettings = function() {
    const ov=document.getElementById('settingsOverlay'); if(ov){ov.style.display='none';ov.setAttribute('aria-hidden','true');}
    if (this.settingsFromPause && this.state==='playing') { const po=document.getElementById('pauseOverlay'); if(po)po.style.display='flex'; }
    this.settingsFromPause=false;
  };

  Game.openRecords = function() { this.renderRecords(); const ov=document.getElementById('recordsOverlay');if(ov){ov.style.display='flex';ov.setAttribute('aria-hidden','false');} };
  Game.closeRecords = function() { const ov=document.getElementById('recordsOverlay');if(ov){ov.style.display='none';ov.setAttribute('aria-hidden','true');} };
  Game.renderRecords = function() {
    const gallery=document.getElementById('bossGallery'); if(gallery){gallery.innerHTML='';for(let level=1;level<=CONFIG.MAX_LEVEL;level++){
      const lvl=CONFIG.LEVELS[level], unlocked=!!this.bossRecords[level], rank=this.bestRanks[level]||'-';
      const card=document.createElement('div');card.className='boss-card'+(unlocked?'':' locked');
      card.innerHTML=`<span class="rank-badge">${rank}</span><strong>${unlocked?lvl.bossName:'???'}</strong><span>FASE ${level} · ${unlocked?lvl.name:'NÃO IDENTIFICADO'}</span>`;gallery.appendChild(card);
    }}
    const ag=document.getElementById('achievementGallery');if(ag){ag.innerHTML='';Object.keys(ACHIEVEMENT_NAMES).forEach(k=>{const d=document.createElement('div');const u=!!this.persistentAchievements[k];d.className='achievement-card'+(u?' unlocked':'');d.textContent=(u?'🏆 ':'🔒 ')+ACHIEVEMENT_NAMES[k];ag.appendChild(d);});}
  };

  Game.updateMenuActions = function() {
    const el=document.getElementById('menuActions'); if(el)el.style.display=this.state==='menu'?'flex':'none';
    const c=document.getElementById('menuContinueBtn'); if(c)c.style.display=this.getCheckpoint()?'inline-block':'none';
  };

  Game.getCheckpoint = function() {
    const cp=this.checkpoint || safeParse(localStorage.getItem(STORAGE.checkpoint),null);
    if (!cp || !Number.isFinite(cp.level) || cp.level<2 || cp.level>CONFIG.MAX_LEVEL) return null;
    this.checkpoint=cp; return cp;
  };
  Game.clearCheckpoint = function() { this.checkpoint=null; localStorage.removeItem(STORAGE.checkpoint); this.updateMenuActions(); };
  Game.saveCheckpoint = function(nextLevel) {
    if (nextLevel>CONFIG.MAX_LEVEL || !this.player) return;
    this.checkpoint={level:nextLevel,difficulty:this.difficulty,score:this.score,life:Math.max(1,this.player.life),weapon:this.player.weapon,shield:this.player.shield,overdriveTimer:Math.min(this.player.overdriveTimer,180),savedAt:Date.now()};
    localStorage.setItem(STORAGE.checkpoint,JSON.stringify(this.checkpoint));
  };

  Game.startGame = function() {
    if (!this._preserveCheckpoint) this.clearCheckpoint();
    this.hideGameOver();
    legacy.startGame.call(this);
    this.initStageMission(); this.resetStageStats();
    AudioSystem.playStage(this.level);
    this.updateMenuActions();
  };
  Game.continueFromCheckpoint = function() {
    const cp=this.getCheckpoint(); if(!cp)return;
    this._preserveCheckpoint=true; this.startGame(); this._preserveCheckpoint=false;
    this.level=cp.level; this.difficulty=CONFIG.DIFFICULTIES[cp.difficulty]?cp.difficulty:'NORMAL'; this.score=cp.score||0;
    this.player.life=Math.max(1,cp.life||3); this.player.weapon=Math.max(1,Math.min(3,cp.weapon||1)); this.player.shield=Math.max(0,Math.min(3,cp.shield||0)); this.player.overdriveTimer=cp.overdriveTimer||0;
    this.player.x=210; this.player.y=555; this.player.invuln=120;
    this.levelKills=0; this.enemies=[]; this.enemyBullets=[]; this.bullets=[]; this.powerups=[]; this.boss=null; this.bossIntro=null; this.stageTransition=null;
    this.initStageMission(); this.resetStageStats(); this.showLevel=120; AudioSystem.playStage(this.level); this.showFeedback('CHECKPOINT · FASE '+this.level,'#0ff');
  };

  Game.resetStageStats = function() { this.stageStats={frames:0,shotsFired:0,shotsHit:0,damageTaken:0,maxCombo:0,startScore:this.score||0}; };
  Game.completeStageStats = function() {
    const st=this.stageStats||{frames:1,shotsFired:0,shotsHit:0,damageTaken:0,maxCombo:0};
    const accuracy=st.shotsFired?Math.min(100,st.shotsHit/st.shotsFired*100):0;
    const seconds=st.frames/CONFIG.FIXED_FPS, noDamage=st.damageTaken===0, target=68+this.level*5;
    let grade=0; if(noDamage)grade+=2; if(accuracy>=70)grade+=2; else if(accuracy>=50)grade+=1; if(seconds<=target)grade+=1; if(st.maxCombo>=18+this.level*2)grade+=1;
    const rank=grade>=5?'S':grade>=4?'A':grade>=2?'B':'C';
    const bonus={S:4500,A:2800,B:1400,C:600}[rank]+(noDamage?1200:0); this.score+=bonus;
    const current=this.bestRanks[this.level]; if(!current||rankValue(rank)>rankValue(current)){this.bestRanks[this.level]=rank;this.saveRecords();}
    if(noDamage&&rank==='S'&&!this.achievements.perfect)this.unlockAchievement('perfect','Missão Perfeita!');
    return {rank,accuracy,seconds,noDamage,bonus,maxCombo:st.maxCombo};
  };

  Game.unlockAchievement = function(key,text) {
    const before=!!this.achievements[key]; legacy.unlockAchievement.call(this,key,text);
    if(!before&&this.achievements[key]){this.persistentAchievements[key]=true;this.saveRecords();}
  };

  Game.actionDown = function(action) {
    const code=this.settings?.keyboard?.[action]; if(code&&this.keys[code])return true;
    const extra={
      moveLeft:['ArrowLeft','KeyA','KeyJ','Numpad4','a','j'], moveRight:['ArrowRight','KeyD','KeyL','Numpad6','d','l'],
      moveUp:['ArrowUp','KeyW','KeyI','Numpad8','w','i'], moveDown:['ArrowDown','KeyS','KeyK','Numpad2','s','k'],
      fire:['Space','KeyZ','KeyX','ControlLeft','ControlRight','Enter',' '], dash:['KeyC','c'], focus:['ShiftLeft','ShiftRight']
    }[action]||[];
    return extra.some(k=>!!this.keys[k]);
  };

  Game.pollGamepad = function() {
    if(!navigator.getGamepads)return;
    const pad=Array.from(navigator.getGamepads()).filter(Boolean)[0];
    if(!pad){this.gamepadInput={x:0,y:0,fire:false,pause:false,dash:false,focus:false};this._padButtons=[];return;}
    const pressed=pad.buttons.map(b=>!!b.pressed);
    if(this.remapGamepadAction){const idx=pressed.findIndex((v,i)=>v&&!this._padButtons[i]);if(idx>=0){this.settings.gamepad[this.remapGamepadAction]=idx;this.remapGamepadAction=null;this.saveSettings();this.renderBindings();}}
    const dz=(this.settings.gamepadDeadzone||20)/100; let x=Math.abs(pad.axes[0]||0)>dz?pad.axes[0]:0, y=Math.abs(pad.axes[1]||0)>dz?pad.axes[1]:0;
    if(pressed[14])x=-1;if(pressed[15])x=1;if(pressed[12])y=-1;if(pressed[13])y=1;
    const map=this.settings.gamepad, fire=!!pressed[map.fire], dash=!!pressed[map.dash], focus=!!pressed[map.focus], pause=!!pressed[map.pause], confirm=!!pressed[0], up=!!pressed[12], down=!!pressed[13];
    this.gamepadInput={x,y,fire,pause,dash,focus};
    if(this.state==='playing'&&pause&&!this.gamepadPrev.pause)this.togglePause();
    else if(this.state==='menu'){
      const order=['EASY','NORMAL','HARD','NIGHTMARE'];let idx=Math.max(0,order.indexOf(this.difficulty));
      if(up&&!this.gamepadPrev.up)this.setDifficulty(order[(idx+order.length-1)%order.length]);if(down&&!this.gamepadPrev.down)this.setDifficulty(order[(idx+1)%order.length]);if(confirm&&!this.gamepadPrev.confirm)this.startGame();
    } else if(this.state==='victory'&&confirm&&!this.gamepadPrev.confirm)this.restartGame();
    else if(this.state==='gameover'&&confirm&&!this.gamepadPrev.confirm){this.getCheckpoint()?this.continueFromCheckpoint():this.startGame();}
    this.gamepadPrev={pause,confirm,up,down}; this._padButtons=pressed;
  };

  Game.updatePlayer = function() {
    const p=this.player; let dx=0,dy=0;
    if(this.actionDown('moveLeft'))dx--;if(this.actionDown('moveRight'))dx++;if(this.actionDown('moveUp'))dy--;if(this.actionDown('moveDown'))dy++;
    if(this.touchDir){dx+=this.touchDir.x;dy+=this.touchDir.y;}if(this.gamepadInput){dx+=this.gamepadInput.x||0;dy+=this.gamepadInput.y||0;}
    const magnitude=Math.hypot(dx,dy);if(magnitude>1){dx/=magnitude;dy/=magnitude;}if(Math.hypot(dx,dy)>0.15){p.lastDx=dx;p.lastDy=dy;}
    p.focus=this.actionDown('focus')||!!this.gamepadInput?.focus||!!this.touchFocus;const maxSpeed=p.focus?CONFIG.PLAYER_FOCUS_SPEED:CONFIG.PLAYER_MAX_SPEED;
    const dashPressed=this.actionDown('dash')||!!this.gamepadInput?.dash||!!this.touchDash;
    if(dashPressed&&!this.dashHeld&&p.dashCooldown<=0&&Math.hypot(p.lastDx,p.lastDy)>0.1){p.dashFrames=CONFIG.DASH_FRAMES;p.dashCooldown=CONFIG.DASH_COOLDOWN;this.addScreenShake(2);this.showFeedback('DASH!','#0ff');}
    this.dashHeld=dashPressed;
    if(p.dashFrames>0){p.dashFrames--;const dmag=Math.max(.001,Math.hypot(p.lastDx,p.lastDy));p.vx=p.lastDx/dmag*CONFIG.DASH_SPEED;p.vy=p.lastDy/dmag*CONFIG.DASH_SPEED;if(this.frameCount%2===0)this.createExplosion(p.x,p.y+8,'#0ff',4,'trail');}
    else{p.vx+=dx*CONFIG.PLAYER_ACCEL;p.vy+=dy*CONFIG.PLAYER_ACCEL;const drag=magnitude>.05?.90:CONFIG.PLAYER_FRICTION;p.vx*=drag;p.vy*=drag;const v=Math.hypot(p.vx,p.vy);if(v>maxSpeed){p.vx=p.vx/v*maxSpeed;p.vy=p.vy/v*maxSpeed;}}
    p.x+=p.vx;p.y+=p.vy;const cx=Math.max(22,Math.min(398,p.x)),cy=Math.max(36,Math.min(600,p.y));if(cx!==p.x)p.vx*=-.18;if(cy!==p.y)p.vy*=-.18;p.x=cx;p.y=cy;
    p.bank+=((p.vx/Math.max(1,maxSpeed))-p.bank)*.18;if(p.invuln>0)p.invuln--;if(p.dashCooldown>0)p.dashCooldown--;if(p.overdriveTimer>0)p.overdriveTimer--;
    p.fireCooldown--;const firePressed=this.actionDown('fire')||this.firing||!!this.gamepadInput?.fire;
    if(firePressed&&p.fireCooldown<=0&&!this.bossIntro){const overdrive=p.overdriveTimer>0;p.fireCooldown=overdrive?4:p.fireRate;const diff=CONFIG.DIFFICULTIES[this.difficulty],dmg=10*diff.playerDamage*(overdrive?1.2:1);let shots=[];
      if(p.weapon===1)shots=[{x:p.x,y:p.y-15,dmg,overdrive}];else if(p.weapon===2)shots=[{x:p.x-8,y:p.y-15,dmg,overdrive},{x:p.x+8,y:p.y-15,dmg,overdrive}];else shots=[{x:p.x,y:p.y-15,dmg:dmg*1.5,overdrive},{x:p.x-12,y:p.y-10,dmg,overdrive},{x:p.x+12,y:p.y-10,dmg,overdrive}];
      this.bullets.push(...shots);if(this.stageStats)this.stageStats.shotsFired+=shots.length;AudioSystem.shoot();this.createExplosion(p.x,p.y-15,overdrive?'#ff0':'#0ff',overdrive?5:3,'trail');}
  };

  Game.spawnEnemy = function(forcedType=null,forcedX=null,options={}) {
    const lvl=CONFIG.LEVELS[this.level]||CONFIG.LEVELS[1],diff=CONFIG.DIFFICULTIES[this.difficulty],pool=lvl.enemyTypes||[1,2,3];
    const type=forcedType||pool[Math.floor(Math.random()*pool.length)],st=ENEMY_STATS[type]||ENEMY_STATS[1],levelHealth=1+Math.max(0,this.level-1)*.035,baseHealth=st.health*levelHealth;
    const enemy={x:forcedX??(Math.random()*360+30),y:options.y??-30,r:st.radius,type,h:baseHealth*diff.enemyHealthMult,maxH:baseHealth*diff.enemyHealthMult,hit:0,vx:(type===3||type===5)?(Math.random()-.5)*4:0,vy:st.speed*diff.enemySpeedMult,pattern:Math.floor(Math.random()*3),fireCooldown:Math.floor(35+Math.random()*45),fireRate:Math.max(38,Math.floor(st.fireRate/Math.max(.35,diff.enemyFireRate))),age:0,phaseOffset:Math.random()*Math.PI*2,burst:0,shieldPulse:Math.random()*Math.PI*2,dead:false,formation:options.formation||'',summoned:!!options.summoned,dashFrames:0,summonsLeft:type===7?2:0,buffed:false};
    if(type===6){enemy.shield=34*diff.enemyHealthMult;enemy.maxShield=enemy.shield;}if(type===8)enemy.auraRadius=105;
    if(options.vx!=null)enemy.vx=options.vx;this.enemies.push(enemy);return enemy;
  };

  Game.fireEnemyPattern = function(e) {
    if(e.dead)return;const b=(vx,vy,color,r=4)=>this.enemyBullets.push({x:e.x,y:e.y+10,vx,vy,color,r});
    if(e.type===1)b(0,5,'#ff3366');
    else if(e.type===2){b(-.45,5,'#ff9900');b(.45,5,'#ff9900');}
    else if(e.type===3){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);b(Math.cos(a)*4,Math.sin(a)*4,'#55ff55');}
    else if(e.type===4){const tx=e.aimX??this.player.x,ty=e.aimY??this.player.y,a=Math.atan2(ty-e.y,tx-e.x),speed=5.8;b(Math.cos(a)*speed,Math.sin(a)*speed,'#00ddff',5);if(this.level>=8){b(Math.cos(a+.11)*speed,Math.sin(a+.11)*speed,'#00ddff',4);b(Math.cos(a-.11)*speed,Math.sin(a-.11)*speed,'#00ddff',4);}}
    else if(e.type===5){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);for(let i=-1;i<=1;i++){const aa=a+i*.20;b(Math.cos(aa)*4.4,Math.sin(aa)*4.4,'#ff4dff');}}
    else if(e.type===6){for(let i=-2;i<=2;i)b(i*.65,4.2,'#ffd34d');}
    else if(e.type===7){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);b(Math.cos(a)*4.2,Math.sin(a)*4.2,'#6ef7ff');b(Math.cos(a+.25)*3.8,Math.sin(a+.25)*3.8,'#6ef7ff');b(Math.cos(a-.25)*3.8,Math.sin(a-.25)*3.8,'#6ef7ff');}
    else if(e.type===8){for(let i=0;i<8;i++){const a=i*Math.PI/4+(e.age||0)*.015;b(Math.cos(a)*2.9,Math.sin(a)*2.9,'#b877ff');}}
  };

  Game.updateEnemies = function() {
    const levelSpeed=1+(this.level-1)*.055;
    this.enemies.forEach(e=>e.buffed=false);
    this.enemies.filter(e=>e.type===8&&!e.dead).forEach(s=>this.enemies.forEach(e=>{if(e!==s&&!e.dead&&Math.hypot(e.x-s.x,e.y-s.y)<s.auraRadius){e.buffed=true;e.h=Math.min(e.maxH,e.h+.035);}}));
    this.enemies.forEach(e=>{
      if(e.dead)return;e.age=(e.age||0)+1;const buff=e.buffed?1.12:1;e.y+=e.vy*levelSpeed*buff;
      if(e.type===1)e.x+=Math.sin(e.age*.045+e.phaseOffset)*.75;
      else if(e.type===2)e.x+=Math.sin(e.age*.025+e.phaseOffset)*.45;
      else if(e.type===3){if(e.pattern===1)e.x+=Math.sin(e.age*.09+e.phaseOffset)*2.6;else{e.x+=e.vx;if(e.x<30||e.x>390)e.vx*=-1;}}
      else if(e.type===4){e.x+=Math.sign(this.player.x-e.x)*.62+Math.sin(e.age*.035+e.phaseOffset)*.35;if(e.y>150&&e.y<250)e.y-=e.vy*.72*levelSpeed;if(e.fireCooldown<=34){e.aimX=this.player.x;e.aimY=this.player.y;}}
      else if(e.type===5){if(e.dashFrames>0){e.dashFrames--;e.x+=e.dashVx;e.y+=e.dashVy;}else{e.x+=Math.sin(e.age*.12+e.phaseOffset)*3.1;if(e.age%165===105){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);e.dashVx=Math.cos(a)*4.8;e.dashVy=Math.sin(a)*4.8;e.dashFrames=26;}}}
      else if(e.type===6){e.x+=Math.sin(e.age*.028+e.phaseOffset)*.95;e.shieldPulse=(e.shieldPulse||0)+.05;}
      else if(e.type===7){e.x+=Math.sin(e.age*.021+e.phaseOffset)*.75;if(e.y>130&&e.y<235)e.y-=e.vy*.82*levelSpeed;if(e.summonsLeft>0&&(e.age===105||e.age===215)){e.summonsLeft--;this.spawnEnemy(1,Math.max(28,e.x-22),{y:e.y+8,summoned:true,vx:-1.4});this.spawnEnemy(3,Math.min(392,e.x+22),{y:e.y+8,summoned:true,vx:1.4});this.showFeedback('DRONES LANÇADOS','#6ef7ff');}}
      else if(e.type===8){e.x+=Math.sin(e.age*.04+e.phaseOffset)*1.25;if(e.y>165&&e.y<260)e.y-=e.vy*.7*levelSpeed;}
      e.x=Math.max(24,Math.min(396,e.x));if(e.hit>0)e.hit--;e.fireCooldown--;
      if(e.y>48&&e.y<525&&e.fireCooldown<=0){this.fireEnemyPattern(e);e.fireCooldown=e.fireRate+Math.floor(Math.random()*22);}
    });
    this.enemies=this.enemies.filter(e=>!e.dead&&e.y<690&&e.h>0);
  };

  Game.buildMissionWaves = function(level) {
    const lvl=CONFIG.LEVELS[level],patterns=MISSION_PATTERNS[level]||MISSION_PATTERNS[1],pool=lvl.enemyTypes;
    return patterns.map((pattern,i)=>{const count=Math.min(11,5+Math.floor(level*.45)+i);let types=pool.slice(Math.max(0,i-1));if(pattern==='elite')types=pool.slice(-Math.min(3,pool.length));if(pattern==='escort'&&!types.includes(7)&&level>=5)types.push(7);return{pattern,label:WAVE_LABELS[pattern],count,types,interval:pattern==='swarm'?12:pattern==='elite'?28:19};});
  };
  Game.initStageMission = function() { this.missionDirector={waves:this.buildMissionWaves(this.level),waveIndex:0,spawnIndex:0,spawnTimer:35,waitTimer:35,announced:false,completed:false};this.bossIntro=null; };
  Game.waveSpawnX = function(wave,index) {
    const n=wave.count,p=wave.pattern;
    if(p==='line')return 45+(index%Math.min(n,7))*55;
    if(p==='v'){const mid=(n-1)/2;return Math.max(34,Math.min(386,210+(index-mid)*42));}
    if(p==='zigzag')return index%2?350-(index%3)*28:70+(index%3)*28;
    if(p==='pincer')return index%2?365-(index%3)*20:55+(index%3)*20;
    if(p==='column')return [105,210,315][index%3];
    if(p==='cross')return [210,70,350,130,290][index%5];
    if(p==='escort')return index===0?210:(index%2?105:315);
    if(p==='ambush')return index%2?385:35;
    return 30+Math.random()*360;
  };
  Game.updateMissionDirector = function() {
    const d=this.missionDirector;if(!d||d.completed||this.boss||this.bossIntro||this.stageTransition)return;
    if(d.waitTimer>0){d.waitTimer--;return;}const wave=d.waves[d.waveIndex];
    if(!wave){if(this.enemies.length===0){d.completed=true;this.beginBossIntro();}return;}
    if(!d.announced){d.announced=true;this.showFeedback(`ONDA ${d.waveIndex+1} · ${wave.label}`,CONFIG.LEVELS[this.level].color1);}
    if(d.spawnIndex<wave.count){d.spawnTimer--;if(d.spawnTimer<=0){let type=wave.types[d.spawnIndex%wave.types.length];if(wave.pattern==='escort'&&d.spawnIndex===0)type=this.level>=7?8:7;const x=this.waveSpawnX(wave,d.spawnIndex);const opts={formation:wave.pattern};if(wave.pattern==='ambush')opts.vx=x<210?2.2:-2.2;this.spawnEnemy(type,x,opts);d.spawnIndex++;d.spawnTimer=wave.interval;}}
    else if(this.enemies.length===0){const waveBonus=250+(d.waveIndex+1)*100;this.score+=waveBonus;this.floatingTexts.push(new FloatingText(210,150,'ONDA +'+waveBonus,'#7dff8a'));d.waveIndex++;d.spawnIndex=0;d.spawnTimer=22;d.waitTimer=42;d.announced=false;}
  };

  Game.beginBossIntro = function() { if(this.bossIntro||this.boss)return;this.enemyBullets=[];this.bullets=[];this.firing=false;this.bossIntro={timer:0,duration:CONFIG.BOSS_INTRO_FRAMES};AudioSystem.stopMusic();this.addScreenShake(4); };
  Game.updateBossIntro = function() { if(!this.bossIntro)return;const b=this.bossIntro;b.timer++;if(b.timer===18)AudioSystem.play(240,.16,'square',.12);if(b.timer===55)AudioSystem.play(150,.24,'sawtooth',.13);if(b.timer>=b.duration){this.bossIntro=null;this.spawnBoss();} };
  Game.drawBossIntro = function() { if(!this.bossIntro)return;const ctx=this.ctx,b=this.bossIntro,lvl=CONFIG.LEVELS[this.level],t=b.timer;ctx.save();ctx.textAlign='center';ctx.fillStyle=`rgba(20,0,0,${.18+.25*Math.sin(t*.08)**2})`;ctx.fillRect(0,0,420,640);const flash=Math.floor(t/10)%2===0;ctx.strokeStyle=flash?'#ff2244':'#661122';ctx.lineWidth=3;ctx.strokeRect(12,120,396,400);ctx.font='bold 34px monospace';ctx.fillStyle='#ff3355';ctx.shadowBlur=24;ctx.shadowColor='#ff0033';ctx.fillText('⚠ WARNING ⚠',210,245);ctx.shadowBlur=0;if(t>48){ctx.font='bold 23px monospace';ctx.fillStyle=lvl.color1;ctx.fillText(lvl.bossName,210,305);ctx.font='11px monospace';ctx.fillStyle='#fff';ctx.fillText(lvl.bossVariant>1?'ALVO RECORRENTE · PADRÃO ALTERADO':'ASSINATURA HOSTIL DETECTADA',210,331);}if(t>100){ctx.fillStyle='#aaa';ctx.font='10px monospace';ctx.fillText('PREPARE-SE PARA O COMBATE',210,378);}ctx.restore(); };

  Game.spawnBoss = function() {
    const lvl=CONFIG.LEVELS[this.level]||CONFIG.LEVELS[1],diff=CONFIG.DIFFICULTIES[this.difficulty];
    this.boss={x:210,y:-80,type:lvl.bossType,variant:lvl.bossVariant||1,name:lvl.bossName||('BOSS '+lvl.bossType),h:lvl.bossLife*diff.bossHealthMult,maxH:lvl.bossLife*diff.bossHealthMult,hit:0,phase:0,lastPhase:0,attackTimer:0,moveTimer:0,targetX:210,spiralAngle:0,patternIndex:0,defeated:false,parts:[]};
    if(this.boss.type===6||this.boss.type===8){const hp=this.boss.maxH*.13;this.boss.parts=[{id:'left',x:-36,y:17,h:hp,maxH:hp,destroyed:false},{id:'right',x:36,y:17,h:hp,maxH:hp,destroyed:false}];}
    this.addScreenShake(this.boss.variant>1?14:10);AudioSystem.playMusic('boss');
  };

  Game.updateBoss = function() {
    const before=this.boss;if(!before)return;const prevPhase=before.phase,newBulletStart=this.enemyBullets.length;legacy.updateBoss.call(this);const b=this.boss;if(!b)return;
    if(b.phase!==prevPhase){b.lastPhase=b.phase;this.enemyBullets=this.enemyBullets.filter((_,i)=>i%3!==0);this.createExplosion(b.x,b.y,CONFIG.LEVELS[this.level].color1,34,'spark');this.addScreenShake(9);this.showFeedback('BOSS · FASE '+(b.phase+1),b.phase===2?'#ff3355':'#ffe34d');}
    if(b.type===6&&b.parts?.length){const newly=this.enemyBullets.slice(newBulletStart);const old=this.enemyBullets.slice(0,newBulletStart);const left=b.parts.find(p=>p.id==='left'),right=b.parts.find(p=>p.id==='right');this.enemyBullets=old.concat(newly.filter(bl=>!((left?.destroyed&&bl.x<b.x-8)||(right?.destroyed&&bl.x>b.x+8))));}
  };

  Game.checkCollisions = function() {
    const diff = CONFIG.DIFFICULTIES[this.difficulty];
    const p = this.player;

    for (const b of this.bullets) {
      if (b.dead) continue;

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (!circleHit(b.x, b.y, 3, e.x, e.y, e.r * 0.82)) continue;

        b.dead = true;
        b.y = -100;
        if (this.stageStats) this.stageStats.shotsHit++;
        let dmg = b.dmg;

        if (e.type === 6 && e.shield > 0) {
          e.shield -= dmg;
          if (e.shield <= 0) {
            dmg = -e.shield;
            e.shield = 0;
            this.createExplosion(e.x, e.y, '#9beeff', 24, 'spark');
            this.showFeedback('ESCUDO QUEBRADO', '#9beeff');
          } else {
            dmg = 0;
          }
        }

        if (dmg > 0) e.h -= dmg;
        e.hit = 5;
        this.createExplosion(b.x, b.y, '#fff', 5, 'spark');
        AudioSystem.hit();

        if (e.h <= 0 && !e.dead) {
          e.dead = true;
          this.levelKills++;
          this.totalKills++;
          const st = ENEMY_STATS[e.type] || ENEMY_STATS[1];
          const points = Math.floor(st.points * this.combo.multiplier);
          this.score += points;
          this.addCombo();
          this.floatingTexts.push(new FloatingText(e.x, e.y, '+' + points, '#ff0'));
          this.createExplosion(e.x, e.y, st.color, 40, 'spark');
          this.addScreenShake(3);
          AudioSystem.explosion();
          if (Math.random() < diff.powerupChance) this.spawnPowerup(e.x, e.y);
          if (!this.achievements.firstKill) this.unlockAchievement('firstKill', 'Primeira Destruição!');
        }
        break;
      }

      if (!this.boss || b.dead || this.boss.defeated) continue;
      const boss = this.boss;
      let partHit = false;

      if (boss.parts?.length) {
        for (const part of boss.parts) {
          if (part.destroyed) continue;
          const px = boss.x + part.x;
          const py = boss.y + part.y;
          if (!circleHit(b.x, b.y, 3, px, py, 15)) continue;

          b.dead = true;
          b.y = -100;
          part.h -= b.dmg;
          if (this.stageStats) this.stageStats.shotsHit++;
          partHit = true;
          this.createExplosion(px, py, '#ffd34d', 7, 'spark');
          if (part.h <= 0) {
            part.destroyed = true;
            this.score += 1200;
            this.showFeedback('CANHÃO DESTRUÍDO!', '#ffd34d');
            this.createExplosion(px, py, '#ff7733', 35, 'spark');
          }
          break;
        }
      }

      if (partHit || b.dead) continue;
      const hitSize = ({1:42,2:44,3:39,4:47,5:50,6:50,7:45,8:52})[boss.type] || 45;
      if (!circleHit(b.x, b.y, 3, boss.x, boss.y, hitSize)) continue;

      b.dead = true;
      b.y = -100;
      if (this.stageStats) this.stageStats.shotsHit++;
      const aliveParts = boss.parts?.filter(pt => !pt.destroyed).length || 0;
      let mult = boss.phase === 2 ? 1.15 : 1;
      if (aliveParts) mult *= 0.72;
      boss.h -= b.dmg * mult;
      boss.hit = 5;
      const points = Math.floor(45 * this.combo.multiplier);
      this.score += points;
      this.createExplosion(b.x, b.y, '#fff', 8, 'spark');
      this.addScreenShake(2);
      AudioSystem.hit();

      if (boss.h <= 0 && !boss.defeated) {
        boss.defeated = true;
        const bx = boss.x;
        const by = boss.y;
        const reward = 5000 + this.level * 750;
        this.createExplosion(bx, by, '#ff0033', 90, 'spark');
        this.addScreenShake(15);
        this.score += reward;
        this.showFeedback('BOSS DERROTADO!', '#0f0');
        this.floatingTexts.push(new FloatingText(bx, by, '+' + reward, '#0f0'));
        AudioSystem.bossExplode();
        if (!this.achievements.firstBoss) this.unlockAchievement('firstBoss', 'Primeiro Boss Derrotado!');
        this.bossRecords[this.level] = true;
        this.saveRecords();
        this.lastStageResult = this.completeStageStats();
        const cleared = this.level;
        if (cleared < CONFIG.MAX_LEVEL) this.saveCheckpoint(cleared + 1);
        this.boss = null;
        this.levelKills = 0;
        this.beginStageTransition(cleared >= CONFIG.MAX_LEVEL);
      }
    }

    this.bullets = this.bullets.filter(b => !b.dead && b.y > -20);

    if (p.invuln <= 0 && p.dashFrames <= 0) {
      const pr = p.focus ? CONFIG.PLAYER_FOCUS_HIT_RADIUS : CONFIG.PLAYER_HIT_RADIUS;
      for (const e of this.enemies) {
        if (!e.dead && circleHit(p.x, p.y, pr, e.x, e.y, e.r * 0.7)) {
          e.dead = true;
          this.handlePlayerHit();
          this.createExplosion(p.x, p.y, '#0ff', 25, 'spark');
          break;
        }
      }
      for (const bullet of this.enemyBullets) {
        if (!bullet.dead && circleHit(p.x, p.y, pr, bullet.x, bullet.y, bullet.r || 4.5)) {
          this.handlePlayerHit();
          bullet.dead = true;
          bullet.y = 800;
          this.createExplosion(bullet.x, bullet.y, '#f00', 15, 'spark');
          break;
        }
      }
    }

    for (const u of this.powerups) {
      if (u.collected || !circleHit(p.x, p.y, 12, u.x, u.y, 12)) continue;
      u.collected = true;
      u.y = 800;
      if (u.kind === 'weapon') {
        if (p.weapon < 3) {
          p.weapon++;
          this.showFeedback('ARMA UP!', '#0f0');
          this.score += 500;
          if (p.weapon === 3 && !this.achievements.weapon3) this.unlockAchievement('weapon3', 'Arma Nível 3!');
        } else this.score += 1000;
      } else if (u.kind === 'life') {
        if (p.life < p.maxLife) { p.life++; this.showFeedback('+1 VIDA', '#f00'); }
        this.score += 1000;
      } else if (u.kind === 'shield') {
        p.shield = Math.min(3, p.shield + 1);
        this.showFeedback('ESCUDO+', '#0af');
        this.score += 800;
      } else if (u.kind === 'overdrive') {
        p.overdriveTimer = Math.max(p.overdriveTimer, CONFIG.OVERDRIVE_FRAMES);
        this.showFeedback('OVERDRIVE!', '#ff0');
        this.score += 750;
      }
      this.createExplosion(u.x, u.y, '#fff', 20, 'spark');
      this.addScreenShake(2);
      AudioSystem.powerup();
    }
  };

  const legacyHandlePlayerHit=Game.handlePlayerHit;
  Game.handlePlayerHit=function(){const before=this.player.life;legacyHandlePlayerHit.call(this);if(this.stageStats&&this.player.life<before)this.stageStats.damageTaken++;};

  Game.drawEnemies = function() {
    legacy.drawEnemies.call(this);const ctx=this.ctx;ctx.save();
    this.enemies.forEach(e=>{
      if(e.type===4&&e.fireCooldown<=34&&e.fireCooldown>0){const tx=e.aimX??this.player.x,ty=e.aimY??this.player.y;ctx.strokeStyle=`rgba(0,230,255,${.12+(34-e.fireCooldown)/60})`;ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);}
      if(e.type===7){ctx.save();ctx.translate(e.x,e.y);ctx.shadowBlur=13;ctx.shadowColor='#6ef7ff';ctx.fillStyle=e.hit>0?'#fff':'#174b5d';ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(18,-7);ctx.lineTo(20,9);ctx.lineTo(8,16);ctx.lineTo(-8,16);ctx.lineTo(-20,9);ctx.lineTo(-18,-7);ctx.closePath();ctx.fill();ctx.strokeStyle='#6ef7ff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#bffcff';ctx.fillRect(-5,-6,10,9);for(const sx of[-12,12]){ctx.beginPath();ctx.arc(sx,7,4,0,Math.PI*2);ctx.fill();}ctx.restore();}
      if(e.type===8){ctx.save();ctx.translate(e.x,e.y);ctx.rotate((e.age||0)*.012);ctx.shadowBlur=14;ctx.shadowColor='#b877ff';ctx.strokeStyle='#b877ff';ctx.lineWidth=2;for(let i=0;i<3;i++){ctx.rotate(Math.PI*2/3);ctx.strokeRect(6,-7,19,14);}ctx.fillStyle=e.hit>0?'#fff':'#5a258d';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e5c8ff';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();ctx.strokeStyle='rgba(184,119,255,.18)';ctx.beginPath();ctx.arc(e.x,e.y,e.auraRadius||105,0,Math.PI*2);ctx.stroke();}
      if(e.buffed&&e.type!==8){ctx.strokeStyle='rgba(184,119,255,.42)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(e.x,e.y,e.r+6+Math.sin((e.age||0)*.08)*2,0,Math.PI*2);ctx.stroke();}
      if(e.type===6){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(e.x-16,e.y-29,32,3);ctx.fillStyle=e.shield>0?'#8eeeff':'#444';ctx.fillRect(e.x-16,e.y-29,32*Math.max(0,e.shield/(e.maxShield||1)),3);if(e.shield<=0){ctx.strokeStyle='#ff7a4d';ctx.beginPath();ctx.moveTo(e.x-9,e.y-9);ctx.lineTo(e.x+8,e.y+10);ctx.moveTo(e.x+8,e.y-9);ctx.lineTo(e.x-9,e.y+10);ctx.stroke();}}
    });ctx.restore();
  };

  Game.drawPlayer = function() { legacy.drawPlayer.call(this);const p=this.player;if(!p||!p.focus||p.invuln>0)return;const ctx=this.ctx;ctx.save();ctx.fillStyle='#fff';ctx.shadowBlur=10;ctx.shadowColor='#0ff';ctx.beginPath();ctx.arc(p.x,p.y,CONFIG.PLAYER_FOCUS_HIT_RADIUS,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#0ff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke();ctx.restore(); };

  Game.drawBoss = function() { legacy.drawBoss.call(this);const b=this.boss;if(!b)return;const ctx=this.ctx;ctx.save();if(b.parts?.length){for(const part of b.parts){const x=b.x+part.x,y=b.y+part.y;if(!part.destroyed){ctx.strokeStyle='#ffd34d';ctx.lineWidth=2;ctx.shadowBlur=10;ctx.shadowColor='#ffd34d';ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(x-12,y-19,24,3);ctx.fillStyle='#ffd34d';ctx.fillRect(x-12,y-19,24*Math.max(0,part.h/part.maxH),3);}else{ctx.strokeStyle='#ff4433';ctx.beginPath();ctx.moveTo(x-8,y-8);ctx.lineTo(x+8,y+8);ctx.moveTo(x+8,y-8);ctx.lineTo(x-8,y+8);ctx.stroke();}}}ctx.strokeStyle=b.phase===2?'rgba(255,45,75,.35)':'rgba(255,255,255,.12)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,62+b.phase*6+Math.sin(this.frameCount*.08)*3,0,Math.PI*2);ctx.stroke();ctx.restore(); };

  Game.beginStageTransition = function(finalStage=false) { legacy.beginStageTransition.call(this,finalStage);if(this.stageTransition)this.stageTransition.result=this.lastStageResult||null; };
  Game.switchStageAtMidpoint = function() { const before=this.level;legacy.switchStageAtMidpoint.call(this);if(this.level!==before){this.initStageMission();this.resetStageStats();AudioSystem.playStage(this.level);} };
  Game.updateStageTransition = function() { const tr=this.stageTransition;const result=tr?.result;const out=legacy.updateStageTransition.call(this);if(tr&&result&&this.stageTransition&&tr.timer<=CONFIG.STAGE_CLEAR_FRAMES){const ctx=this.ctx;ctx.save();ctx.textAlign='center';ctx.font='bold 42px monospace';ctx.fillStyle=result.rank==='S'?'#ffe34d':result.rank==='A'?'#7dff8a':result.rank==='B'?'#7df7ff':'#ccc';ctx.shadowBlur=14;ctx.shadowColor=ctx.fillStyle;ctx.fillText('RANK '+result.rank,210,374);ctx.shadowBlur=0;ctx.font='10px monospace';ctx.fillStyle='#fff';ctx.fillText(`PRECISÃO ${result.accuracy.toFixed(0)}% · TEMPO ${result.seconds.toFixed(1)}s · COMBO ${result.maxCombo}`,210,397);ctx.fillStyle=result.noDamage?'#7dff8a':'#aaa';ctx.fillText(result.noDamage?'NO DAMAGE · BÔNUS +'+result.bonus:'BÔNUS +'+result.bonus,210,417);ctx.restore();}return out; };

  Game.drawHUD = function() { legacy.drawHUD.call(this);const ctx=this.ctx,d=this.missionDirector,lvl=CONFIG.LEVELS[this.level];ctx.save();ctx.fillStyle='rgba(2,10,24,.93)';ctx.fillRect(260,56,149,29);ctx.textAlign='right';ctx.font='9px monospace';let label='';let prog=0;if(this.boss) {label='BOSS · FASE '+(this.boss.phase+1);prog=1;} else if(this.bossIntro){label='⚠ WARNING · '+lvl.bossName;prog=this.bossIntro.timer/this.bossIntro.duration;} else if(d){const w=d.waves[Math.min(d.waveIndex,d.waves.length-1)];label=d.completed?'BOSS A CAMINHO':`ONDA ${Math.min(d.waveIndex+1,d.waves.length)}/${d.waves.length} · ${w?.label||''}`;prog=d.waves.length?Math.min(1,(d.waveIndex+(w?d.spawnIndex/Math.max(1,w.count):0))/d.waves.length):0;}ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(265,61,140,7);ctx.fillStyle=this.boss||this.bossIntro?'#f33':lvl.color1;ctx.fillRect(265,61,140*prog,7);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.strokeRect(265,61,140,7);ctx.fillStyle='#aaa';ctx.fillText(label,405,80);if(this.bestRanks?.[this.level]){ctx.fillStyle='#ffe34d';ctx.textAlign='left';ctx.fillText('BEST '+this.bestRanks[this.level],184,68);}ctx.restore(); };

  Game.showGameOver = function() { if(this.state==='gameover')return;this.state='gameover';this.paused=false;this.updateMobileControlsVisibility();if(this.score>this.hiScore){this.hiScore=this.score;localStorage.setItem('hiScore',this.hiScore);}const cp=this.getCheckpoint(),ov=document.getElementById('gameOverOverlay'),cont=document.getElementById('continueBtn'),txt=document.getElementById('gameOverCheckpoint');if(cont)cont.style.display=cp?'inline-block':'none';if(txt)txt.textContent=cp?`Checkpoint salvo: Fase ${cp.level} · ${CONFIG.LEVELS[cp.level].name}`:'Nenhum checkpoint salvo nesta campanha.';if(ov){ov.style.display='flex';ov.setAttribute('aria-hidden','false');}AudioSystem.playMusic('menu'); };
  Game.hideGameOver = function() { const ov=document.getElementById('gameOverOverlay');if(ov){ov.style.display='none';ov.setAttribute('aria-hidden','true');} };
  Game.returnToMenu = function() { this.hideGameOver();this.closeSettings();this.closeRecords();legacy.returnToMenu.call(this);this.updateMenuActions(); };
  Game.showVictory = function() { this.clearCheckpoint();legacy.showVictory.call(this);this.updateMenuActions(); };

  const originalToggleSound=legacy.toggleSound;
  Game.toggleSound=function(){const enabled=originalToggleSound.call(this);if(enabled){AudioSystem.applyVolumes(this.settings);if(this.state==='menu'||this.state==='gameover')AudioSystem.playMusic('menu');else if(this.state==='playing')AudioSystem.playStage(this.level);}return enabled;};

  /* ---------- Fixed 60 Hz simulation: monitor refresh no longer changes gameplay ---------- */
  Game.fixedStep = function() {
    const ctx=this.ctx;this.frameCount++;this.pollGamepad();
    if(this.state==='menu'){
      this.drawMenu();this.updateMenuActions();if(this.keys['1'])this.setDifficulty('EASY');if(this.keys['2'])this.setDifficulty('NORMAL');if(this.keys['3'])this.setDifficulty('HARD');if(this.keys['4'])this.setDifficulty('NIGHTMARE');return;
    }
    if(this.state==='playing'){
      this.updateMenuActions();if(this.paused)return;if(this.stageTransition){this.updateStageTransition();return;}
      if(this.screenShake.intensity>0){this.screenShake.x=(Math.random()-.5)*this.screenShake.intensity;this.screenShake.y=(Math.random()-.5)*this.screenShake.intensity;this.screenShake.intensity*=.9;}
      ctx.save();ctx.translate(this.screenShake.x,this.screenShake.y);this.drawBackground();this.updatePlayer();
      this.bullets.forEach(b=>{if(!b.dead)b.y-=12;});this.bullets=this.bullets.filter(b=>!b.dead&&b.y>-20);
      this.updateEnemies();this.updateMissionDirector();if(this.bossIntro)this.updateBossIntro();if(this.boss)this.updateBoss();
      this.enemyBullets.forEach(b=>{if(!b.dead){b.x+=b.vx||0;b.y+=b.vy||5;}});this.enemyBullets=this.enemyBullets.filter(b=>!b.dead&&b.y<700&&b.y>-30&&b.x>-30&&b.x<450);
      this.powerups.forEach(u=>u.y+=2);this.powerups=this.powerups.filter(u=>!u.collected&&u.y<700);this.updateCombo();this.checkCollisions();
      this.particles.forEach(p=>p.update());this.particles=this.particles.filter(p=>p.life>0);this.floatingTexts.forEach(t=>t.update());this.floatingTexts=this.floatingTexts.filter(t=>t.life>0);
      this.drawPlayer();this.drawBullets();this.drawEnemies();this.drawBoss();this.drawPowerups();this.drawEnemyBullets();this.particles.forEach(p=>p.draw(ctx));this.floatingTexts.forEach(t=>t.draw(ctx));this.drawBossIntro();this.drawPostFX();this.drawHUD();this.checkAchievements();
      if(this.stageStats){this.stageStats.frames++;this.stageStats.maxCombo=Math.max(this.stageStats.maxCombo,this.combo.count);}
      if(this.player.life<=0)this.showGameOver();ctx.restore();return;
    }
    if(this.state==='victory'){this.drawBackground();ctx.fillStyle='#fff';ctx.font='bold 48px monospace';ctx.textAlign='center';ctx.shadowBlur=30;ctx.shadowColor='#0ff';ctx.fillText('VITÓRIA!',210,320);ctx.shadowBlur=0;return;}
    if(this.state==='gameover'){return;}
  };

  Game.update = function(timestamp) {
    const now=Number.isFinite(timestamp)?timestamp:performance.now();if(!this._lastRaf)this._lastRaf=now;let delta=Math.min(100,Math.max(0,now-this._lastRaf));this._lastRaf=now;this._accumulator=(this._accumulator||0)+delta;let steps=0;
    // Guarantee the first visual frame immediately.
    if(this.frameCount===0&&this._accumulator<CONFIG.FIXED_STEP_MS)this._accumulator=CONFIG.FIXED_STEP_MS;
    while(this._accumulator>=CONFIG.FIXED_STEP_MS&&steps<6){this.fixedStep();this._accumulator-=CONFIG.FIXED_STEP_MS;steps++;}
    if(steps===6)this._accumulator=0;requestAnimationFrame(t=>this.update(t));
  };
})();
