import { describe, expect, it } from 'vitest';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

describe('Leiche beim Tod (Wiki „Character corpse“)', () => {
  it('Inventar liegt in der Leiche, Figur startet leer am Startpunkt; Rechtsklick holt alles zurück', () => {
    const w = new World(1);
    for (let y = -10; y < 10; y++) for (let x = -10; x < 10; x++) w.map.setWater(x, y, false);
    const p = new Player(5.5, 5.5);
    w.player = p;
    p.inventory.add('iron-plate', 150);
    p.inventory.add('coal', 30);
    p.damage(w, 10_000);
    expect(p.inventory.isEmpty()).toBe(true);
    expect(w.corpses.all.length).toBe(1);
    const c = w.corpses.all[0];
    expect([c.x, c.y]).toEqual([5.5, 5.5]);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(b.corpses.all[0].inv.count('iron-plate')).toBe(150);
    // zurücklaufen und plündern
    p.px = 5 * 256;
    p.py = 6 * 256;
    p.setMineTarget({ kind: 'corpse', id: c.id });
    w.run(60);
    expect(p.inventory.count('iron-plate')).toBe(150);
    expect(p.inventory.count('coal')).toBe(30);
    expect(w.corpses.all.length).toBe(0);
  });
});
