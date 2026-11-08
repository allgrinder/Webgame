import { describe, expect, it } from 'vitest';
import type { TrainStopEntity } from '../../src/sim/machines';
import { railPiece, type RailShape } from '../../src/sim/rails';
import { World } from '../../src/sim/world';

const SHAPES: RailShape[] = ['straight', 'curve', 'diagonal', 'half', 'half-mirror'];

describe('Diagonale Gleise: Geometrie', () => {
  it('Enden auf Kantenmitten des 2er-Rasters, Lage stetig, Richtung passt zu den Enden', () => {
    for (const shape of SHAPES) {
      for (let dir = 0; dir < 4; dir++) {
        const p = railPiece({ id: 1, x: 10, y: 20, dir, shape });
        for (const e of p.ends) {
          // Knoten: (ungerade, gerade) oder (gerade, ungerade)
          expect(Math.abs(e.x - Math.round(e.x))).toBeLessThan(1e-9);
          expect(Math.abs(e.y - Math.round(e.y))).toBeLessThan(1e-9);
          expect((Math.round(e.x) + Math.round(e.y)) % 2).toBe(1);
          expect(Math.hypot(e.ox, e.oy)).toBeCloseTo(1, 9);
        }
        const a = p.pose(0);
        const b = p.pose(p.length);
        expect(a.x).toBeCloseTo(p.ends[0].x, 9);
        expect(a.y).toBeCloseTo(p.ends[0].y, 9);
        expect(b.x).toBeCloseTo(p.ends[1].x, 9);
        expect(b.y).toBeCloseTo(p.ends[1].y, 9);
        expect(a.dx).toBeCloseTo(-p.ends[0].ox, 9);
        expect(a.dy).toBeCloseTo(-p.ends[0].oy, 9);
        expect(b.dx).toBeCloseTo(p.ends[1].ox, 9);
        expect(b.dy).toBeCloseTo(p.ends[1].oy, 9);
        // Bogenlänge = Parameter (Schritte gleich lang, Richtung tangential)
        const n = 64;
        for (let i = 0; i < n; i++) {
          const q0 = p.pose((i / n) * p.length);
          const q1 = p.pose(((i + 1) / n) * p.length);
          expect(Math.hypot(q1.x - q0.x, q1.y - q0.y)).toBeCloseTo(p.length / n, 3);
          expect(q0.dx * q1.dx + q0.dy * q1.dy).toBeGreaterThan(0.99);
        }
      }
    }
  });

  it('Übergang endet mit 45° auf der Diagonale und schließt an Diagonalstücke an', () => {
    const half = railPiece({ id: 1, x: 0, y: 6, dir: 0, shape: 'half' });
    expect(half.ends[1]).toMatchObject({ x: 2, y: 7 });
    expect(half.ends[1].ox).toBeCloseTo(Math.SQRT1_2, 9);
    expect(half.ends[1].oy).toBeCloseTo(-Math.SQRT1_2, 9);
    const diag = railPiece({ id: 2, x: 2, y: 6, dir: 0, shape: 'diagonal' });
    expect(diag.ends[0]).toMatchObject({ x: 2, y: 7 });
    expect(diag.ends[0].ox + half.ends[1].ox).toBeCloseTo(0, 9);
  });
});

describe('Diagonale Gleise: Zugfahrt', () => {
  it('Zug fährt nach Norden, über Übergang und Diagonale nach Osten zum Bahnhof', () => {
    const w = new World(3);
    w.map.clearTrees(-20, -20, 60, 60);
    for (let y = -10; y < 50; y++) for (let x = -10; x < 40; x++) {
      w.map.setWater(x, y, false);
      w.map.setResource(x, y, 0, 0);
    }
    const put = (name: string, x: number, y: number, dir: 0 | 1 | 2 | 3) => expect(w.place(name, x, y, dir), `${name} ${x},${y}`).toBeTruthy();
    for (let y = 10; y <= 30; y += 2) put('straight-rail', 0, y, 0);
    put('half-rail', 0, 6, 0);
    put('diagonal-rail', 2, 6, 0);
    put('diagonal-rail', 2, 4, 2);
    put('diagonal-rail', 4, 4, 0);
    put('half-rail-mirror', 4, 2, 3);
    for (let x = 8; x <= 26; x += 2) put('straight-rail', x, 2, 1);
    w.trains.rails.ensure(w);
    // durchgehend verbunden: vom untersten Stück bis zum letzten östlichen
    const first = [...w.trains.rails.pieces.values()].find((p) => p.ends[1].y === 32 || p.ends[0].y === 32)!;
    let cur = { piece: first.id, end: (first.ends[0].y === 32 ? 1 : 0) as 0 | 1 };
    let count = 1;
    for (;;) {
      const nx = w.trains.rails.next(cur.piece, cur.end);
      if (!nx.length) break;
      cur = { piece: nx[0].piece, end: nx[0].end === 0 ? 1 : 0 };
      count++;
    }
    expect(count).toBe(11 + 5 + 10);
    const last = w.trains.rails.pieces.get(cur.piece)!;
    expect(last.ends[cur.end]).toMatchObject({ x: 28, y: 3 });

    const stop = w.place('train-stop', 20, 4, 1) as TrainStopEntity;
    expect(stop).toBeTruthy();
    stop.stationName = 'Ost';
    const loco = w.trains.place(w, 'locomotive', 1, 26, 0, -1)!;
    expect(loco).toBeTruthy();
    loco.inv.add('coal', 20);
    const t = w.trains.trains[0];
    t.schedule = [{ station: 'Ost', wait: 'time', seconds: 5 }];
    t.state = 'moving';
    let diagonal = false;
    for (let i = 0; i < 60 * 30 && (t.state as string) !== 'waiting'; i++) {
      w.step();
      if (Math.abs(Math.abs(loco.pose.dx) - Math.SQRT1_2) < 0.01 && Math.abs(Math.abs(loco.pose.dy) - Math.SQRT1_2) < 0.01) diagonal = true;
    }
    expect(diagonal).toBe(true);
    expect(t.state).toBe('waiting');
    expect(loco.pose.y).toBeCloseTo(3, 3);
    expect(loco.pose.x).toBeGreaterThan(16);
  });
});
