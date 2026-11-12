"use strict";
/**
 * Neon Sky Force v2.1: deterministic safety net for prolonged boss fights.
 * No time-based adaptive difficulty: the selected game difficulty controls
 * a soft live-shot limit. Existing bullets are never removed by this module;
 * only the new part of an overloaded volley may be sparsified.
 */
(() => {
  const oldUpdateBoss = Game.updateBoss;
  const budgets = Object.freeze({
    EASY: 130, NORMAL: 160, HARD: 200, NIGHTMARE: 240
  });
  let skippedShots = 0, cappedVolleys = 0, highWater = 0;

  Game.updateBoss = function() {
    const boss = this.boss;
    if (!boss) return oldUpdateBoss.call(this);
    const originalCount = this.enemyBullets.length;
    const beforePhase = boss.phase;
    oldUpdateBoss.call(this);
    if (this.boss !== boss || this.stageTransition) return;
    let bullets = this.enemyBullets;
    highWater = Math.max(highWater, bullets.length);
    // Phase changes intentionally clear a portion of bullets; that operation
    // reorders the list, so defer density control to the next full volley.
    if (beforePhase !== boss.phase || bullets.length <= originalCount) return;

    const limit = budgets[this.difficulty] || budgets.NORMAL;
    const oldCount = Math.min(originalCount, bullets.length);
    const fresh = bullets.length - oldCount;
    const capacity = Math.max(0, limit - oldCount);
    if (fresh <= capacity) return;

    // Regular evenly spaced sampling preserves the fan/spiral's silhouette.
    // It cannot delete existing bullets in flight and never changes hitboxes.
    if (capacity === 0) {
      bullets.length = oldCount;
    } else {
      const selected = [];
      for (let n = 0; n < capacity; n++) {
        selected.push(bullets[oldCount + Math.floor((n + .5) * fresh / capacity)]);
      }
      bullets.length = oldCount;
      bullets.push(...selected);
    }
    skippedShots += fresh - capacity;
    cappedVolleys++;
  };

  window.NSFBattleStability = Object.freeze({
    get currentBulletBudget() { return budgets[Game.difficulty] || budgets.NORMAL; },
    get skippedShots() { return skippedShots; },
    get cappedVolleys() { return cappedVolleys; },
    get peakBullets() { return highWater; }
  });
})();
