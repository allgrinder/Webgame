import { describe, expect, it } from 'vitest';
import { capture, placed } from '../../src/sim/blueprint';
import type { ContainerEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function world(): World {
  const w = new World(1);
  for (let y = -5; y < 5; y++) for (let x = -5; x < 10; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

describe('Kisten-Begrenzung (rotes X)', () => {
  it('Greifarm füllt nur die freien Plätze; Inhalt hinter der Grenze bleibt entnehmbar', () => {
    const w = world();
    const src = w.place('iron-chest', 0, 0, 0) as ContainerEntity;
    w.place('burner-inserter', 1, 0, 1);
    const dst = w.place('wooden-chest', 2, 0, 0) as ContainerEntity;
    insertInto(src, 'iron-plate', 1000, 'player');
    insertInto(w.entities.get([...w.entities.values()].find((e) => e.kind === 'inserter')!.id)!, 'coal', 50, 'player');
    dst.inventory.bar = 2;
    w.run(60 * 600);
    expect(dst.inventory.count('iron-plate')).toBe(200);
    expect(dst.inventory.slots.slice(2).every((s) => s === null)).toBe(true);
  });

  it('Grenze wird gespeichert und in Blaupausen übernommen', () => {
    const w = world();
    const c = w.place('steel-chest', 0, 0, 0) as ContainerEntity;
    c.inventory.bar = 5;
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect((b.entities.get(c.id) as ContainerEntity).inventory.bar).toBe(5);
    const bp = capture(w, 0, 0, 0, 0)!;
    expect(bp.entities[0].settings).toEqual({ bar: 5 });
    const p = placed(bp, 4, 0)[0];
    w.ghosts.add(w, p.name, p.x, p.y, p.dir, p.settings);
    const built = w.place('steel-chest', 4, 0, 0) as ContainerEntity;
    w.ghosts.onBuilt(built);
    expect(built.inventory.bar).toBe(5);
  });
});
