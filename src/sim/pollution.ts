import { POLLUTION, POLLUTION_PER_MINUTE } from '../data/enemies';
import { Status } from './entity';
import type { World } from './world';

const key = (cx: number, cy: number) => cx * 100003 + cy;
const unkey = (k: number): [number, number] => {
  const cy = ((k % 100003) + 100003) % 100003;
  const cy2 = cy > 50001 ? cy - 100003 : cy;
  return [(k - cy2) / 100003, cy2];
};

/**
 * Verschmutzung je Kartenabschnitt (32×32 Felder), wie im Original vereinfacht: arbeitende Gebäude stoßen aus,
 * alle POLLUTION.interval Ticks wandert ein Anteil in die vier Nachbarn, Boden und Nester nehmen auf.
 */
export class PollutionSystem {
  readonly chunks = new Map<number, number>();
  /** Gesamter Ausstoß (Entwicklung der Gegner). */
  totalEmitted = 0;

  at(x: number, y: number): number {
    const C = POLLUTION.chunk;
    return this.chunks.get(key(Math.floor(x / C), Math.floor(y / C))) ?? 0;
  }

  chunkAt(cx: number, cy: number): number {
    return this.chunks.get(key(cx, cy)) ?? 0;
  }

  add(x: number, y: number, amount: number): void {
    const C = POLLUTION.chunk;
    const k = key(Math.floor(x / C), Math.floor(y / C));
    this.chunks.set(k, (this.chunks.get(k) ?? 0) + amount);
  }

  /** Nimmt bis zu amount aus einem Abschnitt (Nester). */
  take(cx: number, cy: number, amount: number): number {
    const k = key(cx, cy);
    const have = this.chunks.get(k) ?? 0;
    const n = Math.min(have, amount);
    if (n > 0) this.chunks.set(k, have - n);
    return n;
  }

  update(w: World): void {
    if (w.tick % POLLUTION.interval !== 0) return;
    const f = POLLUTION.interval / 3600;
    // Ausstoß arbeitender Gebäude (je Takt gesammelt)
    for (const e of w.entities.values()) {
      const pm = POLLUTION_PER_MINUTE[e.name];
      if (!pm || e.status !== Status.Working) continue;
      const a = pm * f;
      this.add(e.cx, e.cy, a);
      this.totalEmitted += a;
    }
    // Verteilung
    const moves: [number, number][] = [];
    // feste Reihenfolge (Gleitkomma-Summen deterministisch, auch nach dem Laden)
    const sorted = [...this.chunks.entries()].sort((a, b) => a[0] - b[0]);
    for (const [k, v] of sorted) {
      if (v < POLLUTION.minSpread) continue;
      const [cx, cy] = unkey(k);
      const part = v * POLLUTION.diffusion;
      moves.push([k, -part * 4]);
      moves.push([key(cx + 1, cy), part], [key(cx - 1, cy), part], [key(cx, cy + 1), part], [key(cx, cy - 1), part]);
    }
    for (const [k, d] of moves) this.chunks.set(k, (this.chunks.get(k) ?? 0) + d);
    // Aufnahme: Nester (Angriffe), dann Boden
    w.enemies.absorbPollution(w, this);
    const ground = POLLUTION.groundAbsorbPerMinute * f;
    const after = [...this.chunks.entries()].sort((a, b) => a[0] - b[0]);
    this.chunks.clear();
    for (const [k, v] of after) {
      // Boden plus Bäume (Wiki: je Baum 0,001/s)
      const [cx, cy] = unkey(k);
      const n = v - ground - w.map.trees.treesIn(cx, cy).length * POLLUTION.treeAbsorbPerMinute * f;
      if (n > 0.01) this.chunks.set(k, n);
    }
  }

  serialize(): { c: [number, number][]; t: number } {
    return { c: [...this.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v]), t: this.totalEmitted };
  }

  load(d?: { c: [number, number][]; t: number }): void {
    this.chunks.clear();
    if (!d) return;
    for (const [k, v] of d.c) this.chunks.set(k, v);
    this.totalEmitted = d.t ?? 0;
  }

  static unkey = unkey;
}
