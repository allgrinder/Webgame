import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import { GameMap } from '../../src/sim/map';
import type { AssemblerEntity, FurnaceEntity, PumpjackEntity, TankEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-40, -40, 40, 40);
  for (let y = -30; y < 30; y++) for (let x = -30; x < 30; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

/** Strom für alle elektrischen Gebäude (Tests ohne Kraftwerk). */
function power(w: World): void {
  for (const e of w.entities.values()) {
    const en = (e as { energy?: { type?: string } }).energy;
    if (en?.type === 'electric') (en as ElectricSource).buffer = 1e9;
  }
}

function run(w: World, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    power(w);
    w.step();
  }
}

describe('Öl und Chemie (Wiki-Werte)', () => {
  it('Ölfelder: Quellen mit Ergiebigkeit, nicht am Start, nicht per Hand oder Bohrer abbaubar', () => {
    const m = new GameMap(11);
    let wells = 0;
    for (let y = -300; y < 300; y++) for (let x = -300; x < 300; x++) {
      const r = m.resourceAt(x, y);
      if (r.res !== 5 || r.amount === 0) continue;
      wells++;
      expect(Math.hypot(x, y)).toBeGreaterThan(60);
      expect(r.amount).toBeGreaterThanOrEqual(60_000);
    }
    expect(wells).toBeGreaterThan(10);
  });

  it('Pumpjack: 10 × Ergiebigkeit pro s, löst Ölverarbeitung aus', () => {
    const w = clearWorld();
    w.map.setResource(1, 1, 5, 100_000); // 100 %
    expect(w.canPlace('pumpjack', 0, 0, 0).ok).toBe(true);
    expect(w.canPlace('pumpjack', 1, 0, 0).ok).toBe(false);
    const pj = w.place('pumpjack', 0, 0, 0) as PumpjackEntity;
    w.place('pipe', 2, -1, 0);
    w.place('pipe', 2, -2, 0);
    const tank = w.place('storage-tank', 2, -5, 0) as TankEntity; // Ecke (2+2, −3)? Anschluss Süd bei (4,−3)
    expect(tank).toBeTruthy();
    for (const t of ['steam-power', 'electronics', 'automation-science-pack', 'steel-processing', 'logistic-science-pack', 'automation', 'automation-2', 'engine', 'fluid-handling', 'oil-gathering']) w.research.complete(t);
    run(w, 60 * 10);
    const oil = (pj.box.net?.amount ?? 0) / 1000;
    expect(oil).toBeGreaterThan(95);
    expect(oil).toBeLessThan(101);
    expect(w.research.done.has('oil-processing')).toBe(true);
  });

  it('Raffinerie: Grundverarbeitung 100 Rohöl → 45 Erdgas in 5 s', () => {
    const w = clearWorld();
    const ref = w.place('oil-refinery', 0, 0, 0) as AssemblerEntity;
    ref.setRecipe('basic-oil-processing');
    expect(ref.recipe?.id).toBe('basic-oil-processing');
    // wie im Original: Rohöl unten rechts (3,4) → Rohr (3,5) → Tank; Erdgas oben rechts (4,0) → Rohr (4,−1)
    w.place('pipe', 3, 5, 0);
    const src = w.place('storage-tank', 3, 6, 0) as TankEntity; // Anschluss Nord an der Ecke (3,6) → Rohr (3,5)
    w.place('pipe', 4, -1, 0);
    w.step();
    src.box.net!.add('crude-oil', 1000 * 1000);
    run(w, 5 * 60 * 2 + 5);
    const gas = ref.boxes[4].net!;
    expect(gas.fluid).toBe('petroleum-gas');
    expect(gas.amount / 1000).toBe(90);
    expect(ref.canCraft({ category: 'chemistry' } as never)).toBe(false);
  });

  it('Chemiefabrik: Kunststoff aus Kohle und Erdgas; Montage 2 mit Schmiermittel', () => {
    const w = clearWorld();
    const cp = w.place('chemical-plant', 0, 0, 0) as AssemblerEntity;
    cp.setRecipe('plastic-bar');
    w.place('pipe', 0, 3, 0); // Eingang (0,2) Süd
    w.step();
    cp.boxes[0].net!.add('petroleum-gas', 100 * 1000);
    insertInto(cp, 'coal', 10, 'player');
    run(w, 61 * 3);
    expect(cp.output.count('plastic-bar')).toBeGreaterThanOrEqual(4);
    const am = w.place('assembling-machine-2', 6, 0, 0) as AssemblerEntity;
    am.setRecipe('electric-engine-unit');
    w.place('pipe', 7, -1, 0);
    w.step();
    am.boxes[0].net!.add('lubricant', 30 * 1000);
    insertInto(am, 'electronic-circuit', 4, 'player');
    insertInto(am, 'engine-unit', 2, 'player');
    run(w, Math.ceil((10 / 0.75) * 60) + 2);
    expect(am.output.count('electric-engine-unit')).toBe(1);
    // AM1 kann keine Flüssigkeitsrezepte
    const am1 = w.place('assembling-machine-1', 12, 0, 0) as AssemblerEntity;
    am1.setRecipe('electric-engine-unit');
    expect(am1.recipe).toBeNull();
  });

  it('Elektrischer Ofen schmilzt mit Strom doppelt so schnell; Speichern/Laden mit Flüssigkeiten', () => {
    const w = clearWorld();
    const f = w.place('electric-furnace', 0, 0, 0) as FurnaceEntity;
    expect(f.burner).toBeNull();
    insertInto(f, 'iron-ore', 10, 'player');
    run(w, 97);
    expect(f.result.count('iron-plate')).toBe(1);
    const cp = w.place('chemical-plant', 6, 0, 0) as AssemblerEntity;
    cp.setRecipe('lubricant');
    w.place('pipe', 6, 3, 0);
    w.step();
    cp.boxes[0].net!.add('heavy-oil', 50 * 1000);
    run(w, 30);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    for (const x of [w, b]) run(x, 300);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
  });
});
