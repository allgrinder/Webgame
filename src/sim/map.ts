import { MAPGEN } from '../data/mapgen';
import { RESOURCE_BY_INDEX, densityLevel, resourceById } from '../data/resources';
import { tileKey } from './geom';
import { hash01, hash32, valueNoise } from './rng';

const CS = MAPGEN.chunkSize;

export class Chunk {
  readonly ground = new Uint8Array(CS * CS);
  readonly resource = new Uint8Array(CS * CS);
  readonly amount = new Uint32Array(CS * CS);
  /** Wird erhöht, wenn sich die sichtbare Darstellung ändert (Renderer-Cache). */
  version = 0;
  constructor(readonly cx: number, readonly cy: number) {}
}

/** Acht feste Richtungen ohne trigonometrische Funktionen (Determinismus). */
const DIRS8: readonly [number, number][] = [
  [1, 0], [0.70710678, 0.70710678], [0, 1], [-0.70710678, 0.70710678],
  [-1, 0], [-0.70710678, -0.70710678], [0, -1], [0.70710678, -0.70710678],
];

interface Patch {
  res: number;
  x: number;
  y: number;
  radius: number;
  richness: number;
}

export function chunkKey(cx: number, cy: number): number {
  return tileKey(cx, cy);
}

/**
 * Endlose, per Seed erzeugte Karte. Chunks entstehen bei Bedarf; abgebaute Mengen
 * werden als Abweichung gespeichert, damit der Spielstand klein bleibt.
 */
export class GameMap {
  private readonly chunks = new Map<number, Chunk>();
  /** chunkKey -> (Index im Chunk -> [Ressource, aktuelle Menge]) */
  private readonly modified = new Map<number, Map<number, [number, number]>>();
  private readonly startPatches: Patch[];

  constructor(readonly seed: number) {
    const base = hash32(seed, 77) % 8;
    this.startPatches = MAPGEN.startPatches.map((p, i) => {
      const [dx, dy] = DIRS8[(base + i * 3) % 8];
      return {
        res: resourceById(p.resource).index,
        x: dx * p.distance,
        y: dy * p.distance,
        radius: p.radius,
        richness: p.richness,
      };
    });
  }

  getChunk(cx: number, cy: number): Chunk {
    const k = chunkKey(cx, cy);
    let c = this.chunks.get(k);
    if (!c) {
      c = this.generate(cx, cy);
      const mods = this.modified.get(k);
      if (mods) for (const [i, [res, amt]] of mods) {
        c.amount[i] = amt;
        c.resource[i] = amt === 0 ? 0 : res;
      }
      this.chunks.set(k, c);
    }
    return c;
  }

  /** Bereits erzeugte Chunks (für den Renderer). */
  peekChunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
  }

  resourceAt(x: number, y: number): { res: number; amount: number } {
    const cx = Math.floor(x / CS);
    const cy = Math.floor(y / CS);
    const c = this.getChunk(cx, cy);
    const i = (y - cy * CS) * CS + (x - cx * CS);
    return { res: c.resource[i], amount: c.amount[i] };
  }

  /** Eine Einheit abbauen. Gibt die Ressourcen-ID des Feldes zurück oder 0. */
  mineOne(x: number, y: number): number {
    const cx = Math.floor(x / CS);
    const cy = Math.floor(y / CS);
    const c = this.getChunk(cx, cy);
    const i = (y - cy * CS) * CS + (x - cx * CS);
    const res = c.resource[i];
    if (res === 0 || c.amount[i] === 0) return 0;
    const def = RESOURCE_BY_INDEX[res]!;
    const before = densityLevel(def, c.amount[i]);
    const amt = c.amount[i] - 1;
    c.amount[i] = amt;
    if (amt === 0) {
      c.resource[i] = 0;
      c.version++;
    } else if (densityLevel(def, amt) !== before) c.version++;
    this.record(cx, cy, i, res, amt);
    return res;
  }

  /** Ressource direkt setzen (Szenen, Editor). amount 0 entfernt sie. */
  setResource(x: number, y: number, res: number, amount: number): void {
    const cx = Math.floor(x / CS);
    const cy = Math.floor(y / CS);
    const c = this.getChunk(cx, cy);
    const i = (y - cy * CS) * CS + (x - cx * CS);
    c.resource[i] = amount > 0 ? res : 0;
    c.amount[i] = amount > 0 ? amount : 0;
    c.version++;
    this.record(cx, cy, i, res, c.amount[i]);
  }

  private record(cx: number, cy: number, i: number, res: number, amt: number): void {
    const k = chunkKey(cx, cy);
    let mods = this.modified.get(k);
    if (!mods) this.modified.set(k, (mods = new Map()));
    mods.set(i, [res, amt]);
  }

  serializeModifications(): [number, number, number, number, number][] {
    const out: [number, number, number, number, number][] = [];
    const keys = [...this.modified.keys()].sort((a, b) => a - b);
    for (const k of keys) {
      const mods = this.modified.get(k)!;
      const idx = [...mods.keys()].sort((a, b) => a - b);
      for (const i of idx) {
        const cx = Math.floor(k / 65536) - 32768;
        const cy = (k % 65536) - 32768;
        const [res, amt] = mods.get(i)!;
        out.push([cx, cy, i, amt, res]);
      }
    }
    return out;
  }

  loadModifications(list: [number, number, number, number, number][]): void {
    for (const [cx, cy, i, amt, res] of list) {
      this.record(cx, cy, i, res, amt);
      const c = this.chunks.get(chunkKey(cx, cy));
      if (c) {
        c.amount[i] = amt;
        c.resource[i] = amt === 0 ? 0 : res;
        c.version++;
      }
    }
  }

  private patchesNear(x0: number, y0: number, x1: number, y1: number): Patch[] {
    const out: Patch[] = [];
    for (const p of this.startPatches) {
      const r = p.radius * 1.6;
      if (p.x + r >= x0 && p.x - r <= x1 && p.y + r >= y0 && p.y - r <= y1) out.push(p);
    }
    const cell = MAPGEN.patchCell;
    const reach = MAPGEN.patchRadiusMax * 1.6;
    const gx0 = Math.floor((x0 - reach) / cell);
    const gx1 = Math.floor((x1 + reach) / cell);
    const gy0 = Math.floor((y0 - reach) / cell);
    const gy1 = Math.floor((y1 + reach) / cell);
    const totalWeight = MAPGEN.patchWeights.reduce((s, w) => s + w.weight, 0);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (hash01(this.seed, gx, gy, 1) >= MAPGEN.patchChance) continue;
        const px = (gx + 0.15 + hash01(this.seed, gx, gy, 2) * 0.7) * cell;
        const py = (gy + 0.15 + hash01(this.seed, gx, gy, 3) * 0.7) * cell;
        const dist = Math.sqrt(px * px + py * py);
        if (dist < MAPGEN.startExclusionRadius) continue;
        let pick = hash01(this.seed, gx, gy, 4) * totalWeight;
        let resId: string = MAPGEN.patchWeights[0].resource;
        for (const w of MAPGEN.patchWeights) {
          if (pick < w.weight) { resId = w.resource; break; }
          pick -= w.weight;
        }
        const radius = MAPGEN.patchRadiusMin + hash01(this.seed, gx, gy, 5) * (MAPGEN.patchRadiusMax - MAPGEN.patchRadiusMin);
        out.push({
          res: resourceById(resId).index,
          x: px,
          y: py,
          radius,
          richness: MAPGEN.patchRichnessBase + dist * MAPGEN.patchRichnessPerTile,
        });
      }
    }
    return out;
  }

  private generate(cx: number, cy: number): Chunk {
    const c = new Chunk(cx, cy);
    const x0 = cx * CS;
    const y0 = cy * CS;
    for (let i = 0; i < CS * CS; i++) {
      const x = x0 + (i % CS);
      const y = y0 + Math.floor(i / CS);
      c.ground[i] = hash32(this.seed, x, y, 9) % 256;
    }
    const patches = this.patchesNear(x0, y0, x0 + CS, y0 + CS);
    if (patches.length === 0) return c;
    for (let i = 0; i < CS * CS; i++) {
      const x = x0 + (i % CS);
      const y = y0 + Math.floor(i / CS);
      let best = 0;
      let bestRes = 0;
      let bestRich = 0;
      for (const p of patches) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        const d = Math.sqrt(dx * dx + dy * dy) / p.radius;
        if (d > 1.6) continue;
        const n = valueNoise(this.seed + p.res * 1013, x / 3.5, y / 3.5);
        const v = 1 - d + (n - 0.5) * 2 * MAPGEN.edgeNoise;
        if (v > best) {
          best = v;
          bestRes = p.res;
          bestRich = p.richness;
        }
      }
      if (best > 0) {
        c.resource[i] = bestRes;
        c.amount[i] = Math.max(1, Math.round(bestRich * (0.35 + best)));
      }
    }
    return c;
  }
}
