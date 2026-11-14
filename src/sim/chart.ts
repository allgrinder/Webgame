import { CHART } from '../data/chart';
import { Status } from './entity';
import type { World } from './world';

const key = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
const unkey = (k: number): [number, number] => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768];
const chunkOf = (t: number) => Math.floor(t / CHART.chunk);

/**
 * Aufgedeckte Kartenabschnitte (Wiki „Radar“): Figur, Roboterhangar und Radar decken ihre Umgebung laufend auf,
 * Radare erkunden zusätzlich ferne Abschnitte. Nur Anzeige (Karte/Minimap); die Simulation bleibt unberührt.
 */
export class ChartSystem {
  /** Abschnitt → Tick der letzten Aufdeckung. */
  readonly seen = new Map<number, number>();
  /** Zähler für Kartenzeichnungen (ändert sich bei neuen Abschnitten). */
  version = 0;

  isCharted(tx: number, ty: number): boolean {
    return this.seen.has(key(chunkOf(tx), chunkOf(ty)));
  }
  chunkCharted(cx: number, cy: number): boolean {
    return this.seen.has(key(cx, cy));
  }
  /** Abschnitt gerade beobachtet (Gegner und Fahrzeuge sichtbar). */
  chunkLive(cx: number, cy: number, tick: number): boolean {
    const t = this.seen.get(key(cx, cy));
    return t !== undefined && tick - t <= CHART.liveSeconds * 60;
  }
  get count(): number {
    return this.seen.size;
  }

  chartChunk(cx: number, cy: number, tick: number): void {
    const k = key(cx, cy);
    if (!this.seen.has(k)) this.version++;
    this.seen.set(k, tick);
  }

  /** Quadrat mit Radius r (in Abschnitten) um das Feld (x, y). */
  chartAround(x: number, y: number, r: number, tick: number): void {
    const cx = chunkOf(Math.floor(x));
    const cy = chunkOf(Math.floor(y));
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) this.chartChunk(cx + dx, cy + dy, tick);
  }

  update(w: World): void {
    const tick = w.tick;
    if (this.seen.size === 0) {
      // neue Runde (oder alter Spielstand): Startgebiet und Umgebung aller Gebäude
      const p = w.player;
      this.chartAround(p ? p.px / 256 : 0, p ? p.py / 256 : 0, CHART.startRadius, tick);
      for (const e of w.entities.values()) this.chartAround(e.cx, e.cy, 1, tick);
    }
    if (tick % 60 !== 0) return;
    const p = w.player;
    if (p && !p.dead) this.chartAround(p.px / 256, p.py / 256, CHART.playerRadius, tick);
    for (const e of w.entities.values()) {
      if (e.status !== Status.Working) continue;
      if (e.kind === 'radar') this.chartAround(e.cx, e.cy, CHART.radarNearRadius, tick);
      else if (e.kind === 'roboport') this.chartAround(e.cx, e.cy, CHART.roboportRadius, tick);
    }
  }

  /**
   * Fernerkundung eines Radars: Ring für Ring nach außen (ab dem Nahbereich), je Ring von links oben im
   * Uhrzeigersinn; Unerkundetes zuerst, sonst der am längsten nicht gesehene Abschnitt. Liefert den Abschnitt.
   */
  scanFrom(x: number, y: number, tick: number): [number, number] | null {
    const cx = chunkOf(Math.floor(x));
    const cy = chunkOf(Math.floor(y));
    let oldest: [number, number] | null = null;
    let oldestT = Infinity;
    for (let r = CHART.radarNearRadius + 1; r <= CHART.radarFarRadius; r++) {
      for (const [dx, dy] of ring(r)) {
        const t = this.seen.get(key(cx + dx, cy + dy));
        if (t === undefined) {
          this.chartChunk(cx + dx, cy + dy, tick);
          return [cx + dx, cy + dy];
        }
        if (t < oldestT) {
          oldestT = t;
          oldest = [cx + dx, cy + dy];
        }
      }
    }
    if (oldest) this.chartChunk(oldest[0], oldest[1], tick);
    return oldest;
  }

  serialize(): number[] {
    const out: number[] = [];
    for (const [k, t] of this.seen) out.push(k, t);
    return out;
  }
  load(d: number[] | undefined): void {
    this.seen.clear();
    if (!d) return;
    for (let i = 0; i + 1 < d.length; i += 2) this.seen.set(d[i], d[i + 1]);
    this.version++;
  }
  /** Alle aufgedeckten Abschnitte (für Tests/Anzeige). */
  *chunks(): IterableIterator<[number, number]> {
    for (const k of this.seen.keys()) yield unkey(k);
  }
}

/** Ring mit Radius r: von der linken oberen Ecke im Uhrzeigersinn. */
function ring(r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = -r; x < r; x++) out.push([x, -r]);
  for (let y = -r; y < r; y++) out.push([r, y]);
  for (let x = r; x > -r; x--) out.push([x, r]);
  for (let y = r; y > -r; y--) out.push([-r, y]);
  return out;
}

/**
 * Nächster bekannter Fundort einer Ressource (nur aufgedeckte Abschnitte, Skill survival-crafting: „every tier's key
 * resource must be visible or hinted“). Sucht die nächstgelegenen Abschnitte zuerst, grob in 2er-Schritten.
 */
export function nearestChartedResource(w: World, resIndex: number, x: number, y: number, maxChunks = 900): { x: number; y: number; dist: number } | null {
  const pcx = chunkOf(Math.floor(x));
  const pcy = chunkOf(Math.floor(y));
  const chunks = [...w.chart.seen.keys()].map(unkey)
    .map(([cx, cy]) => ({ cx, cy, d: (cx - pcx) ** 2 + (cy - pcy) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, maxChunks);
  let best: { x: number; y: number; dist: number } | null = null;
  for (const c of chunks) {
    // weiter entfernte Abschnitte können nichts Näheres mehr liefern
    if (best && (Math.sqrt(c.d) - 1.5) * CHART.chunk > best.dist) break;
    const x0 = c.cx * CHART.chunk;
    const y0 = c.cy * CHART.chunk;
    for (let ty = y0; ty < y0 + CHART.chunk; ty += 2) {
      for (let tx = x0; tx < x0 + CHART.chunk; tx += 2) {
        const r = w.map.resourceAt(tx, ty);
        if (r.res !== resIndex || r.amount <= 0) continue;
        const dist = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (!best || dist < best.dist) best = { x: tx + 0.5, y: ty + 0.5, dist };
      }
    }
  }
  return best;
}

/** Himmelsrichtung von (x0, y0) nach (x1, y1), y wächst nach Süden. */
export function compassDe(x0: number, y0: number, x1: number, y1: number): string {
  const a = Math.atan2(x1 - x0, -(y1 - y0)); // 0 = Norden, im Uhrzeigersinn
  const names = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
