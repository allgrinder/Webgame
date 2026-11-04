import { describe, expect, it } from 'vitest';
import { GameMap } from '../../src/sim/map';

function snapshot(m: GameMap, cx: number, cy: number): string {
  const c = m.getChunk(cx, cy);
  return Buffer.from(c.resource).toString('base64') + Buffer.from(c.amount.buffer).toString('base64');
}

describe('Kartengenerierung', () => {
  it('ist bei gleichem Seed identisch und unabhängig von der Erzeugungsreihenfolge', () => {
    const a = new GameMap(42);
    const b = new GameMap(42);
    const sa = [snapshot(a, 0, 0), snapshot(a, 5, -3), snapshot(a, -2, 7)];
    const sb = [snapshot(b, -2, 7), snapshot(b, 5, -3), snapshot(b, 0, 0)].reverse();
    expect(sa).toEqual(sb);
    expect(snapshot(new GameMap(43), 0, 0)).not.toBe(sa[0]);
  });

  it('hat Eisenerz, Kohle und Stein nahe am Start', () => {
    for (const seed of [1, 2, 3, 12345]) {
      const m = new GameMap(seed);
      const found = new Set<number>();
      for (let y = -18; y <= 18; y++) for (let x = -18; x <= 18; x++) {
        const r = m.resourceAt(x, y);
        if (r.amount > 0) found.add(r.res);
      }
      expect([...found].sort()).toEqual([1, 2, 3, 4]);
      // Startpunkt selbst ist frei
      expect(m.resourceAt(0, 0).amount).toBe(0);
    }
  });

  it('erzeugt weiter entfernt zusätzliche Felder (endlose Karte)', () => {
    const m = new GameMap(7);
    let tiles = 0;
    for (let cy = -8; cy < 8; cy++) for (let cx = -8; cx < 8; cx++) {
      if (Math.abs(cx) < 3 && Math.abs(cy) < 3) continue;
      const c = m.getChunk(cx, cy);
      for (const a of c.amount) if (a > 0) tiles++;
    }
    expect(tiles).toBeGreaterThan(1000);
  });

  it('hat Seen und Teiche, aber nicht am Start und nie unter Erz', () => {
    const m = new GameMap(12345);
    let water = 0;
    for (let y = -150; y < 150; y += 1)
      for (let x = -150; x < 150; x += 1) {
        if (!m.isWater(x, y)) continue;
        water++;
        expect(Math.hypot(x, y)).toBeGreaterThan(20);
        expect(m.resourceAt(x, y).amount).toBe(0);
      }
    expect(water).toBeGreaterThan(200);
  });
});
