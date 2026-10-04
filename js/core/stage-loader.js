"use strict";

/*
  StageLoader v1.6
  Resident data: lightweight manifest only.
  Runtime data: active stage + transient transition target.
  Browser cache: next stage script/resources can be prefetched without execution/decoding.
*/
window.NSF_STAGE_REGISTRY = window.NSF_STAGE_REGISTRY || {};

window.StageLoader = {
  activeLevel: null,
  loadedStages: new Map(),
  scriptPromises: new Map(),
  progress: { value: 0, label: 'AGUARDANDO' },

  clone(value) { return JSON.parse(JSON.stringify(value)); },

  meta(level) { return window.NSF_STAGE_MANIFEST?.[level] || null; },

  setProgress(value, label) {
    this.progress = { value: Math.max(0, Math.min(1, value)), label: label || '' };
    if (window.Game) Game.loadingInfo = { value: this.progress.value, label: this.progress.label };
  },

  prefetch(level) {
    const meta = this.meta(level);
    if (!meta) return;
    AssetManager.prefetch(meta.script, 'script');
    AssetManager.prefetchAssets(meta.precache || []);
  },

  prefetchNext(level) {
    if (level < CONFIG.MAX_LEVEL) this.prefetch(level + 1);
  },

  loadStageScript(level) {
    if (this.loadedStages.has(level)) return Promise.resolve(this.loadedStages.get(level));
    if (this.scriptPromises.has(level)) return this.scriptPromises.get(level);
    const meta = this.meta(level);
    if (!meta) return Promise.reject(new Error(`Fase ${level} não existe no manifesto.`));

    const promise = new Promise((resolve, reject) => {
      this.setProgress(0.08, `LENDO DADOS DA FASE ${level}`);
      const script = document.createElement('script');
      script.async = true;
      script.src = meta.script;
      script.dataset.stageModule = String(level);
      script.onload = () => {
        const stage = window.NSF_STAGE_REGISTRY[level];
        script.remove();
        AssetManager.consumePrefetch(meta.script);
        if (!stage) {
          reject(new Error(`Módulo da fase ${level} foi carregado sem registrar dados.`));
          return;
        }
        delete window.NSF_STAGE_REGISTRY[level];
        this.loadedStages.set(level, stage);
        this.setProgress(0.28, `DADOS DA FASE ${level} PRONTOS`);
        resolve(stage);
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Não foi possível abrir ${meta.script}`));
      };
      document.head.appendChild(script);
    }).finally(() => this.scriptPromises.delete(level));

    this.scriptPromises.set(level, promise);
    return promise;
  },

  async activate(level, options = {}) {
    const stage = await this.loadStageScript(level);
    const onProgress = (p, label) => this.setProgress(0.28 + p * 0.72, label ? `PREPARANDO ${label}` : `PREPARANDO FASE ${level}`);
    await AssetManager.prepareGroup(level, 'startup', stage.assets?.startup || [], onProgress);

    const full = Object.assign({}, this.clone(stage.config), {
      id: level,
      wavePatterns: this.clone(stage.wavePatterns || []),
      assets: stage.assets || { startup: [], waves: [], boss: [] },
      _stub: false,
      _loaded: true
    });
    CONFIG.LEVELS[level] = full;
    if (options.makeActive !== false) this.activeLevel = level;
    this.setProgress(1, `FASE ${level} PRONTA`);
    return full;
  },

  async prepareWave(level, waveIndex) {
    let stage = this.loadedStages.get(level);
    if (!stage) stage = await this.loadStageScript(level);
    const list = stage.assets?.waves?.[waveIndex] || [];
    await AssetManager.prepareGroup(level, `wave:${waveIndex}`, list, (p, label) => {
      this.setProgress(p, label ? `ONDA ${waveIndex + 1}: ${label}` : `ONDA ${waveIndex + 1}`);
    });
  },

  prefetchWave(level, waveIndex) {
    const stage = this.loadedStages.get(level);
    if (!stage) return;
    AssetManager.prefetchAssets(stage.assets?.waves?.[waveIndex] || []);
  },

  async prepareBoss(level) {
    let stage = this.loadedStages.get(level);
    if (!stage) stage = await this.loadStageScript(level);
    await AssetManager.prepareGroup(level, 'boss', stage.assets?.boss || [], (p, label) => {
      this.setProgress(p, label ? `BOSS: ${label}` : 'PREPARANDO BOSS');
    });
  },

  prefetchBoss(level) {
    const stage = this.loadedStages.get(level);
    if (!stage) return;
    AssetManager.prefetchAssets(stage.assets?.boss || []);
  },

  releaseWave(level, waveIndex) { AssetManager.releaseGroup(level, `wave:${waveIndex}`); },

  release(level) {
    if (!Number.isFinite(level)) return;
    AssetManager.releaseStage(level);
    this.loadedStages.delete(level);
    const meta = this.meta(level);
    if (meta) {
      CONFIG.LEVELS[level] = Object.assign(this.clone(meta), {
        speed: 2,
        bossLife: 1,
        bossType: 1,
        bossVariant: 1,
        enemyTypes: [1],
        wavePatterns: [],
        _stub: true
      });
    }
    if (this.activeLevel === level) this.activeLevel = null;
  },

  memoryState() {
    return {
      activeLevel: this.activeLevel,
      fullStageConfigs: Array.from(this.loadedStages.keys()),
      assets: AssetManager.stats()
    };
  }
};
