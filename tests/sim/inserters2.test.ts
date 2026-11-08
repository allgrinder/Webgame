import { describe, expect, it } from 'vitest';
import type { ContainerEntity, InserterEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';
import { STEAM_POWER } from '../../src/data/blueprints';
import { placed } from '../../src/sim/blueprint';

/** Kiste → Greifarm (Osten) → Kiste, mit Dampfkraft versorgt. */
function setup(name: string): { w: World; src: ContainerEntity; ins: InserterEntity; dst: ContainerEntity } {
  const w = new World(1);
  for (let y = -12; y < 10; y++) for (let x = -12; x < 12; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  w.map.setWater(-8, -9, true);
  for (const p of placed(STEAM_POWER, -8, -9)) w.place(p.name, p.x, p.y, p.dir);
  insertInto([...w.entities.values()].find((e) => e.kind === 'boiler')!, 'coal', 50, 'player');
  w.place('small-electric-pole', -2, 0, 0);
  w.place('small-electric-pole', 2, 1, 0);
  const src = w.place('iron-chest', 0, 0, 0) as ContainerEntity;
  const ins = w.place(name, 1, 0, 1) as InserterEntity;
  const dst = w.place('iron-chest', 2, 0, 0) as ContainerEntity;
  return { w, src, ins, dst };
}

describe('Greifarm-Kapazität und Massengreifarm', () => {
  it('Massengreifarm trägt 2, mit voller Forschung 12 Items je Zyklus (Kiste zu Kiste)', () => {
    const a = setup('bulk-inserter');
    insertInto(a.src, 'iron-plate', 1000, 'player');
    a.w.run(60 * 10);
    const base = a.dst.inventory.count('iron-plate');
    const b = setup('bulk-inserter');
    for (let i = 1; i <= 7; i++) b.w.research.complete(`inserter-capacity-bonus-${i}`);
    insertInto(b.src, 'iron-plate', 1000, 'player');
    b.w.run(60 * 10);
    expect(b.dst.inventory.count('iron-plate') / base).toBeCloseTo(6, 0);
    expect(b.ins.stackSize(b.w)).toBe(12);
  });

  it('Greifarm-Kapazität 2: normaler Greifarm trägt 2', () => {
    const a = setup('inserter');
    a.w.research.complete('inserter-capacity-bonus-1');
    a.w.research.complete('inserter-capacity-bonus-2');
    expect(a.ins.stackSize(a.w)).toBe(2);
  });
});

describe('Filter', () => {
  it('Positivliste: nur Kupfer; Negativliste: alles außer Kupfer; bleibt nach dem Laden', () => {
    const a = setup('fast-inserter');
    insertInto(a.src, 'iron-plate', 50, 'player');
    insertInto(a.src, 'copper-plate', 50, 'player');
    a.ins.filters = ['copper-plate'];
    a.w.run(60 * 10);
    expect(a.dst.inventory.count('copper-plate')).toBeGreaterThan(0);
    expect(a.dst.inventory.count('iron-plate')).toBe(0);
    a.ins.filterBlacklist = true;
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(a.w))));
    const bi = b.entities.get(a.ins.id) as InserterEntity;
    expect(bi.filters).toEqual(['copper-plate']);
    expect(bi.filterBlacklist).toBe(true);
    b.run(60 * 10);
    expect((b.entities.get(a.dst.id) as ContainerEntity).inventory.count('iron-plate')).toBeGreaterThan(0);
  });
});
