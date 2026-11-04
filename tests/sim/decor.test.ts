import { describe, expect, it } from 'vitest';
import { DecorField } from '../../src/render/decor';
import { GameMap } from '../../src/sim/map';

const variants = (p: string) => (p.startsWith('flora.tree') ? 8 : 4);

describe('Dekoration', () => {
  it('ist deterministisch und hält Abstand zu Start und Ressourcen', () => {
    const map = new GameMap(12345);
    const a = new DecorField(map, 12345, variants);
    const b = new DecorField(new GameMap(12345), 12345, variants);
    let flora = 0;
    let decals = 0;
    for (let cy = -3; cy <= 3; cy++)
      for (let cx = -3; cx <= 3; cx++) {
        const la = a.chunk(cx, cy);
        const lb = b.chunk(cx, cy);
        expect(la.map((d) => [d.kind.id, d.variant, d.x, d.y])).toEqual(lb.map((d) => [d.kind.id, d.variant, d.x, d.y]));
        for (const d of la) {
          if (d.kind.layer === 'decal') { decals++; continue; }
          flora++;
          expect(Math.hypot(d.x, d.y)).toBeGreaterThanOrEqual(d.kind.clearOfSpawn);
          const r = d.kind.clearOfResources;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) expect(map.resourceAt(d.tx + dx, d.ty + dy).amount).toBe(0);
        }
      }
    expect(decals).toBeGreaterThan(500);
    expect(flora).toBeGreaterThan(10);
  });
});
