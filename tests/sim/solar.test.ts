import { describe, expect, it } from 'vitest';
import { DAY } from '../../src/data/time';
import type { AccumulatorEntity, SolarEntity } from '../../src/sim/machines';
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

/** Netz: Umspannwerk in der Mitte, Solarpanels, Akkus und Lampen/Labore als Verbraucher. */
function grid(w: World, solar: number, acc: number) {
  w.place('substation', 0, 0, 0);
  const panels: SolarEntity[] = [];
  const accs: AccumulatorEntity[] = [];
  for (let i = 0; i < solar; i++) panels.push(w.place('solar-panel', -8 + i * 3, 3, 0) as SolarEntity);
  for (let i = 0; i < acc; i++) accs.push(w.place('accumulator', -8 + i * 2, -4, 0) as AccumulatorEntity);
  return { panels, accs };
}

describe('Solar und Akkumulator (Wiki-Werte)', () => {
  it('Solarpanel: 60 kW bei Tag, nichts in der Nacht, Vorrang vor Dampf', () => {
    const w = clearWorld();
    const { panels } = grid(w, 1, 0);
    w.place('electric-furnace', 3, -6, 0); // 180 kW Bedarf + 6 kW Grundlast
    w.tick = 0; // Mittag
    w.step();
    w.step();
    const net = w.power.nets[0];
    expect(net.fromPrimary).toBe(1000); // 60 kW = 1000 J/Tick
    expect(panels[0].status).toBe(1);
    w.tick = DAY.ticks / 2; // Mitternacht
    w.step();
    expect(w.power.nets[0].fromPrimary).toBe(0);
  });

  it('Akkumulator: lädt aus Überschuss (max. 300 kW), entlädt nachts, speichert 5 MJ', () => {
    const w = clearWorld();
    const { accs } = grid(w, 10, 1); // 600 kW Solar, kaum Verbrauch
    w.tick = 0;
    w.step();
    w.step();
    expect(accs[0].stored).toBe(2 * 5000); // 300 kW = 5000 J/Tick
    for (let t = 0; t < 20 * 60; t++) {
      w.tick = 0;
      w.step();
    }
    expect(accs[0].stored).toBe(5_000_000);
    // Nacht: Verbraucher zieht aus dem Akku
    w.place('electric-furnace', 3, -6, 0);
    w.tick = DAY.ticks / 2;
    w.step();
    w.tick = DAY.ticks / 2;
    w.step();
    const net = w.power.nets[0];
    expect(net.fromPrimary).toBe(0);
    expect(net.fromStorage).toBeGreaterThan(0);
    expect(accs[0].stored).toBeLessThan(5_000_000);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    const acc2 = [...b.entities.values()].find((e) => e.name === 'accumulator') as AccumulatorEntity;
    expect(acc2.stored).toBe(accs[0].stored);
  });
});
