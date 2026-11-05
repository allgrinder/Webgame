import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import { type AssemblerEntity, type BeaconEntity, insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-30, -30, 30, 30);
  for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

function power(w: World): void {
  for (const e of w.entities.values()) {
    const en = (e as { energy?: { type?: string } }).energy;
    if (en?.type === 'electric') (en as ElectricSource).buffer = 1e12;
  }
}

/** Zahnräder in einer Montagemaschine 2 (0,75) über n Sekunden. */
function gears(setup: (w: World, am: AssemblerEntity) => void, seconds: number): { made: number; am: AssemblerEntity; w: World } {
  const w = clearWorld();
  const am = w.place('assembling-machine-2', 0, 0, 0) as AssemblerEntity;
  am.setRecipe('iron-gear-wheel');
  setup(w, am);
  for (let t = 0; t < seconds * 60; t++) {
    if (am.input.count('iron-plate') < 10) insertInto(am, 'iron-plate', 50, 'player');
    am.output.remove('iron-gear-wheel', 100);
    power(w);
    w.step();
  }
  return { made: w.stats.totalMade.get('iron-gear-wheel') ?? 0, am, w };
}

describe('Module und Leuchtfeuer (Wiki „Module“, „Beacon“)', () => {
  it('Geschwindigkeitsmodul: +20 % Tempo, +50 % Verbrauch; Effizienz bis 20 %', () => {
    const base = gears(() => {}, 60).made; // 0,75 / 0,5 s = 1,5/s → 90
    expect(base).toBe(90);
    const sp = gears((_w, am) => {
      expect(insertInto(am, 'speed-module', 2, 'player')).toBe(2);
    }, 60);
    // 1,5 × 1,4 = 2,1/s → 126 (der letzte fällt genau auf die Grenze)
    expect(sp.made).toBeGreaterThanOrEqual(125);
    expect(sp.made).toBeLessThanOrEqual(126);
    expect(sp.am.energy.usagePerTick).toBe(Math.round(2500 * 2));
    const ef = gears((_w, am) => insertInto(am, 'efficiency-module-3', 2, 'player'), 1);
    expect(ef.am.energy.usagePerTick).toBe(500); // −100 % → Untergrenze 20 %
  });

  it('Produktivitätsmodul: +4 % je Modul als Bonusbalken, nur bei Zwischenprodukten', () => {
    const p = gears((_w, am) => insertInto(am, 'productivity-module', 2, 'player'), 100);
    // 0,9 Tempo → 135 Zyklen in 100 s; +8 % → 10 zusätzliche
    expect(p.made).toBeGreaterThanOrEqual(144);
    expect(p.made).toBeLessThanOrEqual(146);
    const w = clearWorld();
    const am = w.place('assembling-machine-2', 0, 0, 0) as AssemblerEntity;
    am.setRecipe('transport-belt');
    expect(insertInto(am, 'productivity-module', 1, 'player')).toBe(0);
    am.setRecipe('iron-gear-wheel');
    expect(insertInto(am, 'productivity-module', 1, 'player')).toBe(1);
    const back = am.setRecipe('transport-belt');
    expect(back.some((s) => s.item === 'productivity-module')).toBe(true);
  });

  it('Leuchtfeuer: Module × 1,5 / √n, nur mit Strom, keine Produktivität', () => {
    const one = gears((w) => {
      const b = w.place('beacon', 3, 0, 0) as BeaconEntity;
      expect(insertInto(b, 'productivity-module', 1, 'player')).toBe(0);
      insertInto(b, 'speed-module', 2, 'player');
    }, 60);
    // +0,4 × 1,5 = +60 % → 2,4/s → 144
    expect(one.made).toBeGreaterThanOrEqual(143);
    expect(one.made).toBeLessThanOrEqual(144);
    const two = gears((w) => {
      for (const x of [3, -3]) insertInto(w.place('beacon', x, 0, 0) as BeaconEntity, 'speed-module', 2, 'player');
    }, 60);
    // 2 × 0,4 × 1,5/√2 = +84,85 % → 2,7728/s
    expect(two.made).toBeGreaterThanOrEqual(165);
    expect(two.made).toBeLessThanOrEqual(167);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(two.w))));
    const beacons = [...b.entities.values()].filter((e) => e.kind === 'beacon') as BeaconEntity[];
    expect(beacons[0].modules!.count('speed-module')).toBe(2);
  });
});
