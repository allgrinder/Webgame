import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import { type ContainerEntity, type RocketSiloEntity, insertInto } from '../../src/sim/machines';
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

function run(w: World, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    for (const e of w.entities.values()) {
      const en = (e as { energy?: { type?: string } }).energy;
      if (en?.type === 'electric') (en as ElectricSource).buffer = 1e12;
    }
    w.step();
  }
}

describe('Raketensilo (Wiki „Rocket silo“, „Satellite“)', () => {
  it('100 Teile je Rakete (3 s je Teil), Start nur mit Satellit und Landeplatz, 1000 Weltraum-Pakete', () => {
    const w = clearWorld();
    const silo = w.place('rocket-silo', 0, 0, 0) as RocketSiloEntity;
    silo.parts = 98;
    const feed = () => {
      for (const it of ['low-density-structure', 'processing-unit', 'rocket-fuel']) insertInto(silo, it, 20, 'player');
    };
    feed();
    run(w, 3 * 60 * 2 + 2);
    expect(silo.rocketReady).toBe(true);
    expect(silo.parts).toBe(0);
    insertInto(silo, 'satellite', 1, 'player');
    run(w, 10);
    expect(silo.launchAt).toBe(-1); // kein Landeplatz
    const pad = w.place('cargo-landing-pad', 12, 0, 0) as ContainerEntity;
    run(w, 2);
    expect(silo.launchAt).toBeGreaterThan(0);
    expect(w.rocketsLaunched).toBe(1);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    run(w, 29 * 60);
    run(b, 29 * 60);
    expect(pad.inventory.count('space-science-pack')).toBe(1000);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
    expect(b.rocketsLaunched).toBe(1);
  });
});
