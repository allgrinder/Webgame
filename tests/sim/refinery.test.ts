import { describe, expect, it } from 'vitest';
import { FLUID_UNIT } from '../../src/data/fluids';
import type { ElectricSource } from '../../src/sim/energy';
import type { AssemblerEntity, TankEntity } from '../../src/sim/machines';
import { World } from '../../src/sim/world';

function clear(): World {
  const w = new World(1);
  w.map.clearTrees(-20, -20, 60, 60);
  for (let y = -10; y < 30; y++) for (let x = -10; x < 30; x++) {
    w.map.setResource(x, y, 0, 0);
    w.map.setWater(x, y, false);
  }
  return w;
}
function powered(w: World): void {
  for (const e of w.entities.values()) {
    const en = (e as { energy?: { type?: string } }).energy;
    if (en?.type === 'electric') (en as ElectricSource).buffer = (en as ElectricSource).capacity;
  }
}

describe('Raffinerie (Grundverarbeitung)', () => {
  it('Anschlüsse wie im Original: Rohöl unten rechts, Erdgas oben rechts', () => {
    const w = clear();
    const ref = w.place('oil-refinery', 0, 0, 0) as AssemblerEntity;
    ref.setRecipe('basic-oil-processing');
    w.place('pipe', 3, 5, 0);
    const crude = w.place('storage-tank', 3, 6, 0) as TankEntity;
    w.place('pipe', 4, -1, 0);
    w.place('pipe', 5, -1, 0);
    const gas = w.place('storage-tank', 3, -4, 0) as TankEntity; // Anschluss Süd an der Ecke (5,−2) → Rohr (5,−1)
    for (let t = 0; t < 60 * 30; t++) {
      w.fluids.ensure(w);
      crude.box.net?.add('crude-oil', Math.round((20 / 60) * FLUID_UNIT));
      powered(w);
      w.step();
    }
    w.fluids.ensure(w);
    expect(ref.crafts).toBeGreaterThanOrEqual(4);
    expect(gas.box.net?.fluid).toBe('petroleum-gas');
  });

  it('läuft auch, wenn das Rohöl-Rohr beide Eingänge berührt; unbenutzte Anschlüsse sind tot', () => {
    const w = clear();
    const ref = w.place('oil-refinery', 0, 0, 0) as AssemblerEntity;
    ref.setRecipe('basic-oil-processing');
    // Rohr unter der ganzen Raffinerie: berührt beide Eingänge (1,4) und (3,4)
    for (let x = 0; x <= 5; x++) expect(w.place('pipe', x, 5, 0)).toBeTruthy();
    const crude = w.place('storage-tank', 6, 5, 0) as TankEntity;
    // Erdgas: Rohr über der ganzen Raffinerie (berührt alle drei Ausgänge) in einen Tank
    for (let x = 0; x <= 5; x++) expect(w.place('pipe', x, -1, 0)).toBeTruthy();
    const gas = w.place('storage-tank', 0, -4, 0) as TankEntity; // Anschluss Süd an der Ecke (2,−2) → Rohr (2,−1)
    for (let t = 0; t < 60 * 30; t++) {
      w.fluids.ensure(w);
      crude.box.net?.add('crude-oil', Math.round((20 / 60) * FLUID_UNIT));
      powered(w);
      w.step();
    }
    w.fluids.ensure(w);
    expect(ref.crafts).toBeGreaterThanOrEqual(4);
    expect(gas.box.net?.fluid).toBe('petroleum-gas');
    expect(gas.box.net!.amount / FLUID_UNIT).toBeGreaterThan(150);
  });
});
