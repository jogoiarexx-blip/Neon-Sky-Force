"use strict";

/*
  AssetManager v1.6
  - Keeps only the active stage's decoded resources referenced.
  - Supports startup / per-wave / boss groups.
  - Prefetches future files through the browser cache without decoding them.
  The current build is procedural, so asset arrays are empty; the pipeline is ready
  for future PNG/WEBP/audio files without changing the stage flow again.
*/
window.AssetManager = {
  decoded: new Map(),
  prefetchLinks: new Map(),

  key(stageId, group, url) { return `${stageId}:${group}:${url}`; },

  normalizeAsset(asset) {
    if (typeof asset === 'string') {
      const lower = asset.toLowerCase();
      return { url: asset, type: /\.(mp3|ogg|wav|m4a|aac)$/.test(lower) ? 'audio' : 'image' };
    }
    return asset || null;
  },

  prefetch(url, asType = null) {
    if (!url || this.prefetchLinks.has(url)) return;
    try {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      if (asType) link.as = asType;
      document.head.appendChild(link);
      this.prefetchLinks.set(url, link);
    } catch (_) {}
  },

  prefetchAssets(list = []) {
    for (const raw of list) {
      const asset = this.normalizeAsset(raw);
      if (!asset?.url) continue;
      this.prefetch(asset.url, asset.type === 'audio' ? 'audio' : 'image');
    }
  },

  consumePrefetch(url) {
    const link = this.prefetchLinks.get(url);
    if (!link) return;
    try { link.remove(); } catch (_) {}
    this.prefetchLinks.delete(url);
  },

  async loadImage(url) {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
      image.src = url;
    });
    if (typeof image.decode === 'function') {
      try { await image.decode(); } catch (_) {}
    }
    return image;
  },

  async loadAudio(url) {
    const audio = new Audio();
    audio.preload = 'auto';
    await new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error(`Falha ao carregar áudio: ${url}`)); };
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', done);
        audio.removeEventListener('loadeddata', done);
        audio.removeEventListener('error', fail);
      };
      audio.addEventListener('canplaythrough', done, { once: true });
      audio.addEventListener('loadeddata', done, { once: true });
      audio.addEventListener('error', fail, { once: true });
      audio.src = url;
      audio.load();
    });
    return audio;
  },

  async prepareGroup(stageId, group, list = [], onProgress = null) {
    const assets = list.map(a => this.normalizeAsset(a)).filter(Boolean);
    if (!assets.length) {
      onProgress?.(1, 'Nenhum asset externo necessário');
      return;
    }

    let done = 0;
    const total = assets.length;
    for (const asset of assets) {
      const key = this.key(stageId, group, asset.url);
      if (!this.decoded.has(key)) {
        try {
          const resource = asset.type === 'audio'
            ? await this.loadAudio(asset.url)
            : await this.loadImage(asset.url);
          this.decoded.set(key, { stageId, group, url: asset.url, type: asset.type, resource });
        } catch (error) {
          // Fail soft: missing optional art/audio must not brick the game.
          console.warn('[AssetManager]', error.message);
        }
      }
      this.consumePrefetch(asset.url);
      done++;
      onProgress?.(done / total, asset.url);
    }
  },

  releaseGroup(stageId, group) {
    for (const [key, entry] of Array.from(this.decoded.entries())) {
      if (entry.stageId !== stageId || entry.group !== group) continue;
      try {
        if (entry.type === 'audio') {
          entry.resource.pause?.();
          entry.resource.removeAttribute?.('src');
          entry.resource.load?.();
        } else if (entry.resource) {
          entry.resource.src = '';
        }
      } catch (_) {}
      this.decoded.delete(key);
    }
  },

  releaseStage(stageId) {
    for (const [key, entry] of Array.from(this.decoded.entries())) {
      if (entry.stageId !== stageId) continue;
      try {
        if (entry.type === 'audio') {
          entry.resource.pause?.();
          entry.resource.removeAttribute?.('src');
          entry.resource.load?.();
        } else if (entry.resource) {
          entry.resource.src = '';
        }
      } catch (_) {}
      this.decoded.delete(key);
    }
  },

  stats() {
    const byStage = {};
    for (const entry of this.decoded.values()) byStage[entry.stageId] = (byStage[entry.stageId] || 0) + 1;
    return { decodedResources: this.decoded.size, byStage };
  }
};
