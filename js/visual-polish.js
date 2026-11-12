"use strict";
/* Neon Sky Force v1.7 - Visual presentation and low-overhead graphics settings.
   Layered over the existing v1.6 runtime; no campaign/AI/physics rules are replaced. */
(() => {
  const STORAGE_KEY = "nsf_v17_visual";
  const PROFILES = {
    low: { ratio: 1, stars: 50, particles: 110 },
    balanced: { ratio: 1.5, stars: 90, particles: 240 },
    high: { ratio: 2, stars: 120, particles: 380 }
  };
  const defaults = { quality: "balanced", reducedEffects: false, showFps: false };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
  catch (_) { saved = {}; }
  const visual = {
    quality: PROFILES[saved.quality] ? saved.quality : defaults.quality,
    reducedEffects: typeof saved.reducedEffects === "boolean" ? saved.reducedEffects : false,
    showFps: typeof saved.showFps === "boolean" ? saved.showFps : false
  };
  const byId = id => document.getElementById(id);
  const profile = () => PROFILES[visual.quality];

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visual)); }
    catch (_) { /* Private browsing may prevent storage. */ }
  }

  function resizeStarfield(game) {
    if (!Array.isArray(game.stars)) return;
    const target = profile().stars;
    if (game.stars.length > target) game.stars.length = target;
    while (game.stars.length < target) {
      game.stars.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        y: Math.random() * CONFIG.CANVAS_HEIGHT,
        s: 1 + Math.random() * 2,
        bright: Math.random() > .7,
        twinkle: Math.random() * 100
      });
    }
  }

  // Keep game-space coordinates independent of the backing-buffer resolution.
  Game.setupCanvasResolution = function() {
    if (!this.canvas || !this.ctx) return;
    const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, profile().ratio));
    this.pixelRatio = ratio;
    const w = Math.round(CONFIG.CANVAS_WIDTH * ratio);
    const h = Math.round(CONFIG.CANVAS_HEIGHT * ratio);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this._menuCanvasDrawn = false;
  };

  const baseInitBackground = Game.initBackground;
  Game.initBackground = function() {
    baseInitBackground.call(this);
    resizeStarfield(this);
    // Avoid animating more decorative particles than the menu needs.
    this.menuParticles.length = Math.min(this.menuParticles.length, 24);
  };

  // HTML renders the complete menu. Do not draw 80 menu particles, 5 text
  // layers and difficulty boxes sixty times a second under an opaque overlay.
  Game.drawMenu = function() {
    if (this._menuCanvasDrawn) return;
    this.ctx.fillStyle = "#061020";
    this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    this._menuCanvasDrawn = true;
  };

  const baseDrawBackground = Game.drawBackground;
  Game.drawBackground = function() {
    baseDrawBackground.call(this);
    if (visual.quality === "low" || visual.reducedEffects) return;
    // Two extremely cheap parallax accent rails reinforce speed and stage identity.
    const level = CONFIG.LEVELS[this.level];
    if (!level) return;
    const ctx = this.ctx;
    const offset = (this.frameCount * Math.max(.65, level.speed || 1) * .64) % 96;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.globalAlpha = visual.quality === "high" ? .2 : .12;
    ctx.strokeStyle = level.color1 || "#72efff";
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(20, 640);
    ctx.moveTo(400, 0); ctx.lineTo(400, 640);
    for (let i = -1; i <= 7; i++) {
      const y = i * 96 + offset;
      ctx.moveTo(20, y); ctx.lineTo(42, y + 14);
      ctx.moveTo(400, y); ctx.lineTo(378, y + 14);
    }
    ctx.stroke();
    ctx.restore();
  };

  const basePostFx = Game.drawPostFX;
  Game.drawPostFX = function() {
    if (visual.quality === "low" || visual.reducedEffects) return;
    basePostFx.call(this);
  };

  // Particle guard before the frame updates/draws, avoiding runaway rendering.
  const baseFixedStep = Game.fixedStep;
  Game.fixedStep = function() {
    if (this.state === "playing" && Array.isArray(this.particles)) {
      const excess = this.particles.length - profile().particles;
      if (excess > 0) this.particles.splice(0, excess);
    }
    return baseFixedStep.call(this);
  };

  function syncDifficulty(game) {
    const selected = CONFIG.DIFFICULTIES[game.difficulty] || CONFIG.DIFFICULTIES.NORMAL;
    document.querySelectorAll(".difficulty-choice").forEach(button => {
      const on = button.dataset.difficulty === game.difficulty;
      button.classList.toggle("selected", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const description = byId("difficultyText");
    if (description) description.textContent = selected.description;
  }

  const baseSetDifficulty = Game.setDifficulty;
  Game.setDifficulty = function(diff) {
    baseSetDifficulty.call(this, diff);
    syncDifficulty(this);
  };

  Game.updateMenuActions = function() {
    const isMenu = this.state === "menu";
    if (this._polishedMenuVisible !== isMenu) {
      const overlay = byId("startOverlay");
      if (overlay) {
        overlay.classList.toggle("is-visible", isMenu);
        overlay.setAttribute("aria-hidden", isMenu ? "false" : "true");
      }
      const actions = byId("menuActions");
      if (actions) actions.style.display = isMenu ? "flex" : "none";
      if (isMenu) this._menuCanvasDrawn = false;
      this._polishedMenuVisible = isMenu;
    }

    if (isMenu) {
      const continueButton = byId("menuContinueBtn");
      if (continueButton) {
        const canContinue = !!this.getCheckpoint();
        if (continueButton.dataset.available !== String(canContinue)) {
          continueButton.style.display = canContinue ? "block" : "none";
          continueButton.dataset.available = String(canContinue);
        }
      }
      const record = byId("menuRecord");
      const formatted = String(Math.max(0, this.hiScore || 0)).padStart(6, "0");
      if (record && record.textContent !== formatted) record.textContent = formatted;
      if (this._lastPolishedDifficulty !== this.difficulty) {
        syncDifficulty(this);
        this._lastPolishedDifficulty = this.difficulty;
      }
    }

    const fps = byId("fpsCounter");
    if (fps) fps.classList.toggle("visible", visual.showFps && this.state === "playing");
  };

  // Render the FPS diagnostic at most once per second, outside the game canvas.
  const baseUpdate = Game.update;
  Game.update = function(timestamp) {
    if (visual.showFps && this.state === "playing") {
      const now = Number.isFinite(timestamp) ? timestamp : performance.now();
      if (!this._fpsStart) this._fpsStart = now;
      this._fpsFrames = (this._fpsFrames || 0) + 1;
      const elapsed = now - this._fpsStart;
      if (elapsed >= 900) {
        const badge = byId("fpsCounter");
        if (badge) badge.textContent = "FPS " + Math.round(this._fpsFrames * 1000 / elapsed);
        this._fpsFrames = 0;
        this._fpsStart = now;
      }
    } else {
      this._fpsFrames = 0;
      this._fpsStart = 0;
    }
    return baseUpdate.call(this, timestamp);
  };

  function applyQuality() {
    Game.setupCanvasResolution();
    resizeStarfield(Game);
    const fps = byId("fpsCounter");
    if (fps) fps.classList.toggle("visible", visual.showFps && Game.state === "playing");
  }

  // DOM is already parsed because this file follows index.html markup.
  document.querySelectorAll(".difficulty-choice").forEach(button => {
    button.addEventListener("click", () => Game.setDifficulty(button.dataset.difficulty));
  });
  const launch = byId("launchGameBtn");
  if (launch) launch.addEventListener("click", () => {
    if (Game.state !== "menu") return;
    AudioSystem.resumeContext();
    Game.startGame();
  });

  const qualitySelect = byId("graphicsQuality");
  if (qualitySelect) {
    qualitySelect.value = visual.quality;
    qualitySelect.addEventListener("change", () => {
      if (!PROFILES[qualitySelect.value]) return;
      visual.quality = qualitySelect.value;
      persist();
      applyQuality();
    });
  }
  for (const [id, key] of [["reducedEffects", "reducedEffects"], ["showFps", "showFps"]]) {
    const input = byId(id);
    if (!input) continue;
    input.checked = visual[key];
    input.addEventListener("change", () => {
      visual[key] = input.checked;
      persist();
      applyQuality();
    });
  }

  // Prevent the legacy global Enter/Space shortcut from launching a campaign
  // while a user is interacting with buttons or remapping controls.
  window.addEventListener("keydown", event => {
    if (Game.remapKeyboardAction) return;
    const settingsOpen = byId("settingsOverlay")?.getAttribute("aria-hidden") === "false";
    const recordsOpen = byId("recordsOverlay")?.getAttribute("aria-hidden") === "false";
    if (settingsOpen || recordsOpen) {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (settingsOpen) Game.closeSettings(); else Game.closeRecords();
      } else if (event.code === "Enter" || event.code === "Space") {
        event.stopImmediatePropagation();
      }
    } else if (Game.state === "menu" && (event.code === "Enter" || event.code === "Space")) {
      const target = event.target;
      if (target && target.closest && target.closest("button,select,input")) {
        // Native keyboard click on the focused button still works.
        event.stopImmediatePropagation();
      }
    }
  }, true);
})();
