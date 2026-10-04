"use strict";

/* Lightweight stage index: safe to keep resident. Full stage data lives in stages/stageXX.js. */
window.NSF_STAGE_MANIFEST = {
  "1": {
    "id": 1,
    "name": "CIDADE NEON",
    "bossName": "DESTRUCTOR",
    "color1": "#0ff",
    "color2": "#f0f",
    "bg": "#050510",
    "buildings": true,
    "script": "stages/stage01.js",
    "precache": []
  },
  "2": {
    "id": 2,
    "name": "DESERTO CIBER",
    "bossName": "INFERNO",
    "color1": "#ff0",
    "color2": "#f80",
    "bg": "#120a00",
    "buildings": false,
    "script": "stages/stage02.js",
    "precache": []
  },
  "3": {
    "id": 3,
    "name": "ESPAÇO PROFUNDO",
    "bossName": "VOID HUNTER",
    "color1": "#0af",
    "color2": "#f0a",
    "bg": "#000014",
    "buildings": false,
    "script": "stages/stage03.js",
    "precache": []
  },
  "4": {
    "id": 4,
    "name": "DIMENSÃO RACHADA",
    "bossName": "OMEGA",
    "color1": "#a0f",
    "color2": "#f0a",
    "bg": "#1a0033",
    "buildings": false,
    "script": "stages/stage04.js",
    "precache": []
  },
  "5": {
    "id": 5,
    "name": "OCEANO PLASMA",
    "bossName": "LEVIATHAN",
    "color1": "#00ffd5",
    "color2": "#00aaff",
    "bg": "#00181d",
    "buildings": false,
    "script": "stages/stage05.js",
    "precache": []
  },
  "6": {
    "id": 6,
    "name": "FORTALEZA MECÂNICA",
    "bossName": "IRON CORE",
    "color1": "#d0d7df",
    "color2": "#ff4d4d",
    "bg": "#101418",
    "buildings": false,
    "script": "stages/stage06.js",
    "precache": []
  },
  "7": {
    "id": 7,
    "name": "ECLIPSE CARMESIM",
    "bossName": "DESTRUCTOR MK-II",
    "color1": "#ff3355",
    "color2": "#ff9900",
    "bg": "#170006",
    "buildings": false,
    "script": "stages/stage07.js",
    "precache": []
  },
  "8": {
    "id": 8,
    "name": "RUÍNAS QUÂNTICAS",
    "bossName": "CHRONOS",
    "color1": "#65d8ff",
    "color2": "#b15cff",
    "bg": "#06101b",
    "buildings": false,
    "script": "stages/stage08.js",
    "precache": []
  },
  "9": {
    "id": 9,
    "name": "ZONA DO CAOS",
    "bossName": "VOID HUNTER EX",
    "color1": "#9d4dff",
    "color2": "#00e5ff",
    "bg": "#090018",
    "buildings": false,
    "script": "stages/stage09.js",
    "precache": []
  },
  "10": {
    "id": 10,
    "name": "NÚCLEO NEON",
    "bossName": "APEX OMEGA",
    "color1": "#ff33ee",
    "color2": "#00ffff",
    "bg": "#180018",
    "buildings": false,
    "script": "stages/stage10.js",
    "precache": []
  }
};


(() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  for (const [key, meta] of Object.entries(window.NSF_STAGE_MANIFEST)) {
    const id = Number(key);
    CONFIG.LEVELS[id] = Object.assign(clone(meta), {
      speed: 2,
      bossLife: 1,
      bossType: 1,
      bossVariant: 1,
      enemyTypes: [1],
      wavePatterns: [],
      _stub: true
    });
  }
})();
