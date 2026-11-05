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

  it('hat einen Startsee in Sichtweite, Flüsse lassen Furten, der Start ist nicht eingeschlossen', () => {
    for (const seed of [1, 4, 7, 13, 42]) {
      const m = new GameMap(seed);
      let near = Infinity;
      for (let y = -50; y <= 50; y++) for (let x = -50; x <= 50; x++) if (m.isWater(x, y)) near = Math.min(near, Math.hypot(x, y));
      expect(near).toBeGreaterThan(18);
      expect(near).toBeLessThan(40);
      // Flutfüllung über Land: der Start erreicht eine große Fläche
      const R = 100;
      const N = 2 * R + 1;
      const seen = new Uint8Array(N * N);
      const q = [R * N + R];
      seen[R * N + R] = 1;
      let land = 0;
      while (q.length) {
        const i = q.pop()!;
        land++;
        const x = (i % N) - R;
        const y = Math.floor(i / N) - R;
        if (Math.abs(x) === R || Math.abs(y) === R) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + dy + R) * N + x + dx + R;
          if (!seen[j] && !m.isWater(x + dx, y + dy)) {
            seen[j] = 1;
            q.push(j);
          }
        }
      }
      expect(land).toBeGreaterThan(12_000);
    }
  });

  it('Feuchte ist glatt und liegt in [0, 1]', () => {
    const m = new GameMap(5);
    let lo = 1;
    let hi = 0;
    for (let y = -400; y <= 400; y += 20) for (let x = -400; x <= 400; x += 20) {
      const v = m.moistureAt(x, y);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      expect(Math.abs(v - m.moistureAt(x + 1, y))).toBeLessThan(0.05);
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.5);
  });
});
