import { describe, expect, it } from 'vitest';
import { freeplayScene } from '../../src/game/scenes';
import type { Dir } from '../../src/sim/geom';
import { type DrillEntity, type FurnaceEntity, insertInto } from '../../src/sim/machines';
import type { Player } from '../../src/sim/player';
import type { World } from '../../src/sim/world';

function nearest(w: World, resId: number, from: [number, number], need2x2 = false): [number, number] {
  let best: [number, number] = [0, 0];
  let bd = Infinity;
  for (let y = -40; y <= 40; y++)
    for (let x = -40; x <= 40; x++) {
      const ok = need2x2
        ? [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => w.map.resourceAt(x + dx, y + dy).res === resId)
        : w.map.resourceAt(x, y).res === resId;
      if (!ok) continue;
      const d = Math.hypot(x - from[0], y - from[1]);
      if (d < bd) { bd = d; best = [x, y]; }
    }
  expect(bd).toBeLessThan(25);
  return best;
}

/** Spieler zu einem Feld laufen lassen (über die normale Bewegung). */
function walkTo(w: World, p: Player, x: number, y: number) {
  for (let i = 0; i < 2000; i++) {
    const dx = x + 0.5 - p.x;
    const dy = y + 0.5 - p.y;
    if (Math.hypot(dx, dy) < 0.4) break;
    p.moveX = Math.abs(dx) > 0.2 ? Math.sign(dx) : 0;
    p.moveY = Math.abs(dy) > 0.2 ? Math.sign(dy) : 0;
    w.step();
  }
  p.moveX = p.moveY = 0;
}

function mine(w: World, p: Player, x: number, y: number, count: number) {
  p.setMineTarget({ kind: 'resource', x, y });
  // Handabbau 6× schneller als im Original (PLAYER.handMiningFactor): 1 s Abbauzeit → 20 Ticks je Stück
  for (let i = 0; i < count * 20 + 5; i++) w.step();
  p.setMineTarget(null);
}

describe('Freies Spiel', () => {
  it('Startausrüstung, Startfelder in der Nähe, Weg zur automatischen Plattenproduktion', () => {
    const { world: w } = freeplayScene(12345);
    const p = w.player!;
    expect(p.inventory.count('iron-plate')).toBe(8);
    expect(p.inventory.count('burner-mining-drill')).toBe(1);
    expect(p.inventory.count('stone-furnace')).toBe(1);
    const IRON = 1, COAL = 2, STONE = 3;
    for (const r of [IRON, COAL, STONE]) nearest(w, r, [0, 0]);

    // Kohle von Hand abbauen
    const coal = nearest(w, COAL, [0, 0]);
    walkTo(w, p, coal[0], coal[1]);
    mine(w, p, coal[0], coal[1], 10);
    expect(p.inventory.count('coal')).toBe(10);

    // Stein abbauen und einen zweiten Ofen herstellen
    const stone = nearest(w, STONE, [p.x, p.y]);
    walkTo(w, p, stone[0], stone[1]);
    mine(w, p, stone[0], stone[1], 5);
    expect(p.craft('stone-furnace', 1)).toBe(1);
    w.run(40);
    expect(p.inventory.count('stone-furnace')).toBe(2);

    // Bohrer auf Eisenerz, Ofen direkt an der Ausgabe (Süden)
    const iron = nearest(w, IRON, [p.x, p.y], true);
    walkTo(w, p, iron[0] + 3, iron[1] + 1);
    const dir: Dir = 2;
    const drill = w.place('burner-mining-drill', iron[0], iron[1], dir) as DrillEntity;
    expect(drill).toBeTruthy();
    p.inventory.remove('burner-mining-drill', 1);
    const [ox, oy] = w.drillOutputPoint(drill);
    const furnace = w.place('stone-furnace', Math.floor(ox) - 1, Math.floor(oy), 0) as FurnaceEntity;
    expect(furnace).toBeTruthy();
    p.inventory.remove('stone-furnace', 1);
    p.inventory.remove('coal', insertInto(drill, 'coal', 5, 'player'));
    p.inventory.remove('coal', insertInto(furnace, 'coal', 5, 'player'));
    w.run(60 * 60);
    // 60 s: 15 Erz -> etwa 14 Platten
    expect(furnace.result.count('iron-plate')).toBeGreaterThanOrEqual(13);

    // Aus Platten: Zahnräder, Greifarm und Bänder herstellen (inkl. Zwischenprodukten)
    p.inventory.add('iron-plate', furnace.result.remove('iron-plate', 100));
    expect(p.craft('burner-inserter', 1)).toBe(1);
    expect(p.craft('transport-belt', 2)).toBe(2);
    w.run(60 * 5);
    expect(p.inventory.count('burner-inserter')).toBe(1);
    expect(p.inventory.count('transport-belt')).toBe(4);
  });
});
