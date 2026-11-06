import { describe, expect, it } from 'vitest';
import { RECIPE_LIST } from '../../src/data/recipes';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function world(): World {
  const w = new World(3);
  w.map.clearTrees(-20, -20, 20, 20);
  for (let y = -10; y < 10; y++) for (let x = -10; x < 10; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  w.player = new Player(0.5, 0.5);
  return w;
}

describe('Gottmodus und Handwerk', () => {
  it('Gottmodus: 40 Erz je Sekunde von Hand, Speichern behält den Modus', () => {
    const w = world();
    const p = w.player!;
    w.map.setResource(1, 0, 1, 10_000);
    p.god = true;
    p.setMineTarget({ kind: 'resource', x: 1, y: 0 });
    w.run(60);
    expect(p.inventory.count('iron-ore')).toBe(40);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(b.player!.god).toBe(true);
    // ohne Gottmodus: 0,5 Abbau × 6 (Handabbau-Faktor) / 1 s Erz → 1/3 s je Stück
    const v = world();
    v.map.setResource(1, 0, 1, 10_000);
    v.player!.setMineTarget({ kind: 'resource', x: 1, y: 0 });
    v.run(60 * 4);
    expect(v.player!.inventory.count('iron-ore')).toBe(12);
  });

  it('Handabbau: Zeiger auf Nachbarfeld desselben Rohstoffs setzt den Fortschritt nicht zurück', () => {
    const w = world();
    const p = w.player!;
    w.map.setResource(1, 0, 1, 100);
    w.map.setResource(1, 1, 1, 100);
    p.setMineTarget({ kind: 'resource', x: 1, y: 0, res: 1 });
    w.run(12); // 20 Ticks je Stück (Handabbau-Faktor 6)
    const before = p.mineProgress;
    expect(before).toBeGreaterThan(5);
    p.setMineTarget({ kind: 'resource', x: 1, y: 1, res: 1 });
    expect(p.mineProgress).toBe(before);
    w.run(10);
    expect(p.inventory.count('iron-ore')).toBe(1);
  });

  it('F halten: Items vom Band in Reichweite aufnehmen', () => {
    const w = world();
    const p = w.player!;
    w.place('transport-belt', 1, 0, 1, true);
    const t = w.belts.tileAt(1, 0)!;
    expect(w.belts.insertAtPoint(t, 0.5, 0.25, 0)).toBe(true);
    expect(w.belts.insertAtPoint(t, 0.5, 0.75, 0)).toBe(true);
    p.pickingUp = true;
    w.run(10);
    expect(p.inventory.count('iron-ore')).toBe(2);
  });

  it('Gottmodus: Labore forschen 20× schneller (Automatisierung 10 × 10 s in 5 s)', async () => {
    const { insertInto } = await import('../../src/sim/machines');
    const w = world();
    w.player!.god = true;
    for (const t of ['steam-power', 'electronics', 'automation-science-pack']) w.research.complete(t);
    w.research.start('automation');
    const lab = w.place('lab', 3, 3, 0)!;
    insertInto(lab, 'automation-science-pack', 10, 'player');
    for (let i = 0; i < 6 * 60; i++) {
      (lab as unknown as { energy: { buffer: number } }).energy.buffer = 1e9;
      w.step();
    }
    expect(w.research.done.has('automation')).toBe(true);
    expect(w.research.recipeUnlocked('assembling-machine-1')).toBe(true);
  });

  it('Handwerk erzeugt nie Platten (nur Ofen) und verliert bei vollem Inventar nichts', () => {
    const w = world();
    const p = w.player!;
    p.inventory.add('iron-plate', 4);
    for (const r of RECIPE_LIST) {
      if (r.results.some((x) => x.item.endsWith('-plate'))) expect(p.craftableCount(r.id), r.id).toBe(0);
    }
    expect(p.craft('steel-plate', 1)).toBe(0);
    expect(p.inventory.count('iron-plate')).toBe(4);
    // volles Inventar: Zahnräder landen auf dem Boden statt zu verschwinden
    expect(p.craft('iron-gear-wheel', 2)).toBe(2);
    for (let i = 0; i < p.inventory.size; i++) if (!p.inventory.slots[i]) p.inventory.slots[i] = { item: 'stone', count: 50 };
    w.run(60 * 2);
    const ground = [...w.ground.values()].flat().filter((g) => g.item === 'iron-gear-wheel').length;
    expect(ground + p.inventory.count('iron-gear-wheel')).toBe(2);
  });
});
