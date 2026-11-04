import { MAPGEN } from '../data/mapgen';
import { RESOURCE_BY_INDEX, densityLevel, resourceById } from '../data/resources';
import { tileKey } from './geom';
import { hash01, hash32, valueNoise } from './rng';

const CS = MAPGEN.chunkSize;

export class Chunk {
  readonly ground = new Uint8Array(CS * CS);
  readonly resource = new Uint8Array(CS * CS);
  readonly amount = new Uint32Array(CS * CS);
  /** 1 = Wasser (nicht begehbar, nicht bebaubar). */
  readonly water = new Uint8Array(CS * CS);
  hasWater = false;
  /** Wird erhöht, wenn sich die sichtbare Darstellung ändert (Renderer-Cache). */
  version = 0;
  constructor(readonly cx: number, readonly cy: number) {}
}

/** Acht feste Richtungen ohne trigonometrische Funktionen (Determinismus). */
const DIRS8: readonly [number, number][] = [
  [1, 0], [0.70710678, 0.70710678], [0, 1], [-0.70710678, 0.70710678],
  [-1, 0], [-0.70710678, -0.70710678], [0, -1], [0.70710678, -0.70710678],
];

/** 16 Richtungen als Konstanten (cos, sin von k·22,5°), ohne Laufzeit-Trigonometrie. */
const DIRS16: readonly [number, number][] = [
  [1, 0], [0.92387953, 0.38268343], [0.70710678, 0.70710678], [0.38268343, 0.92387953],
  [0, 1], [-0.38268343, 0.92387953], [-0.70710678, 0.70710678], [-0.92387953, 0.38268343],
  [-1, 0], [-0.92387953, -0.38268343], [-0.70710678, -0.70710678], [-0.38268343, -0.92387953],
  [0, -1], [0.38268343, -0.92387953], [0.70710678, -0.70710678], [0.92387953, -0.38268343],
];

/** Teilellipse eines Feldes (Lage relativ zur Mitte, Halbachsen, Drehung). */
interface Lobe {
  ox: number;
  oy: number;
  rx: number;
  ry: number;
  c: number;
  s: number;
}

interface Patch {
  res: number;
  x: number;
  y: number;
  radius: number;
  richness: number;
  lobes: Lobe[];
  /** Reichweite für die Suche (Felder). */
  reach: number;
}

/** Natürliche Form aus 2–4 ineinanderlaufenden, gedrehten Ellipsen. */
function makeLobes(seed: number, a: number, b: number, R: number): Lobe[] {
  const h = (k: number) => hash01(seed, a, b, 100 + k);
  const n = 2 + Math.floor(h(0) * 3);
  const lobes: Lobe[] = [];
  for (let i = 0; i < n; i++) {
    const [c, s] = DIRS16[Math.floor(h(10 + i) * 16)];
    const [dx, dy] = DIRS16[Math.floor(h(20 + i) * 16)];
    const dist = i === 0 ? 0 : R * (0.35 + 0.45 * h(30 + i));
    const big = i === 0 ? 1 : 0.75;
    lobes.push({
      ox: dx * dist,
      oy: dy * dist,
      rx: R * big * (0.6 + 0.45 * h(40 + i)),
      ry: R * big * (0.35 + 0.35 * h(50 + i)),
      c,
      s,
    });
  }
  return lobes;
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
        lobes: makeLobes(seed, 9000 + i, 77, p.radius),
        reach: p.radius * 2.3,
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

  /** Geänderte Wasserfelder (Feldschlüssel -> Wasser ja/nein), werden gespeichert. */
  private readonly waterMods = new Map<number, boolean>();

  /** Wasser direkt setzen (Szenen, Tests, später Landfüllung). */
  setWater(x: number, y: number, water: boolean): void {
    const cx = Math.floor(x / CS);
    const cy = Math.floor(y / CS);
    const c = this.getChunk(cx, cy);
    const i = (y - cy * CS) * CS + (x - cx * CS);
    if ((c.water[i] === 1) !== water) this.waterMods.set(tileKey(x, y), water);
    c.water[i] = water ? 1 : 0;
    if (water) c.hasWater = true;
    c.version++;
  }

  serializeWater(): [number, number, number][] {
    return [...this.waterMods.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768, v ? 1 : 0]);
  }

  loadWater(list: [number, number, number][]): void {
    for (const [x, y, v] of list) this.setWater(x, y, v === 1);
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
      const r = p.reach;
      if (p.x + r >= x0 && p.x - r <= x1 && p.y + r >= y0 && p.y - r <= y1) out.push(p);
    }
    const cell = MAPGEN.patchCell;
    const reach = MAPGEN.patchRadiusMax * 2.3;
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
          lobes: makeLobes(this.seed, gx, gy, radius),
          reach: radius * 2.3,
        });
      }
    }
    return out;
  }

  /** Wert eines Feldes an einem Punkt: > 0 innen, Rand bei 0 (mit verzerrten Koordinaten). */
  private patchValue(p: Patch, px: number, py: number): number {
    const W = MAPGEN.patchWarp * p.radius;
    const wx = px + W * (valueNoise(this.seed + p.res * 7 + 1, px / 6, py / 6) - 0.5) * 2;
    const wy = py + W * (valueNoise(this.seed + p.res * 7 + 2, px / 6, py / 6) - 0.5) * 2;
    let v = -Infinity;
    for (const l of p.lobes) {
      const dx = wx - (p.x + l.ox);
      const dy = wy - (p.y + l.oy);
      const u = (dx * l.c + dy * l.s) / l.rx;
      const w = (-dx * l.s + dy * l.c) / l.ry;
      const lv = 1 - Math.sqrt(u * u + w * w);
      if (lv > v) v = lv;
    }
    return v;
  }

  /** Wasser: Seen aus großräumigem Rauschen plus kleine Teiche; nicht in der Nähe des Starts. */
  private waterAt(x: number, y: number, ponds: Patch[]): boolean {
    const L = MAPGEN.lakes;
    const d = Math.sqrt(x * x + y * y);
    const fall = Math.min(1, Math.max(0, (d - L.spawnClear) / L.spawnFade));
    if (fall <= 0) return false;
    const n = 0.7 * valueNoise(this.seed + 901, x / L.scale, y / L.scale) + 0.3 * valueNoise(this.seed + 902, x / L.detail, y / L.detail);
    if (n - (1 - fall) * 0.6 > L.threshold) return true;
    for (const p of ponds) if (this.patchValue(p, x + 0.5, y + 0.5) > 0) return true;
    return false;
  }

  private pondsNear(x0: number, y0: number, x1: number, y1: number): Patch[] {
    const P = MAPGEN.ponds;
    const out: Patch[] = [];
    const reach = P.radiusMax * 2.3;
    for (let gy = Math.floor((y0 - reach) / P.cell); gy <= Math.floor((y1 + reach) / P.cell); gy++) {
      for (let gx = Math.floor((x0 - reach) / P.cell); gx <= Math.floor((x1 + reach) / P.cell); gx++) {
        if (hash01(this.seed, gx, gy, 61) >= P.chance) continue;
        const px = (gx + 0.2 + hash01(this.seed, gx, gy, 62) * 0.6) * P.cell;
        const py = (gy + 0.2 + hash01(this.seed, gx, gy, 63) * 0.6) * P.cell;
        if (Math.sqrt(px * px + py * py) < MAPGEN.lakes.spawnClear + P.radiusMax) continue;
        const r = P.radiusMin + hash01(this.seed, gx, gy, 64) * (P.radiusMax - P.radiusMin);
        out.push({ res: 0, x: px, y: py, radius: r, richness: 0, lobes: makeLobes(this.seed + 5, gx, gy, r), reach: r * 2.3 });
      }
    }
    return out;
  }

  isWater(x: number, y: number): boolean {
    const cx = Math.floor(x / CS);
    const cy = Math.floor(y / CS);
    const c = this.getChunk(cx, cy);
    return c.water[(Math.floor(y) - cy * CS) * CS + (Math.floor(x) - cx * CS)] === 1;
  }

  private generate(cx: number, cy: number): Chunk {
    const c = new Chunk(cx, cy);
    const x0 = cx * CS;
    const y0 = cy * CS;
    const ponds = this.pondsNear(x0, y0, x0 + CS, y0 + CS);
    for (let i = 0; i < CS * CS; i++) {
      const x = x0 + (i % CS);
      const y = y0 + Math.floor(i / CS);
      c.ground[i] = hash32(this.seed, x, y, 9) % 256;
      if (this.waterAt(x, y, ponds)) {
        c.water[i] = 1;
        c.hasWater = true;
      }
    }
    const patches = this.patchesNear(x0, y0, x0 + CS, y0 + CS);
    if (patches.length === 0) return c;
    const fringe = MAPGEN.patchFringe;
    for (let i = 0; i < CS * CS; i++) {
      if (c.water[i]) continue;
      const x = x0 + (i % CS);
      const y = y0 + Math.floor(i / CS);
      if (x * x + y * y < MAPGEN.spawnFree * MAPGEN.spawnFree) continue;
      let best = -Infinity;
      let bestP: Patch | null = null;
      for (const p of patches) {
        if (Math.abs(x - p.x) > p.reach || Math.abs(y - p.y) > p.reach) continue;
        const v = this.patchValue(p, x + 0.5, y + 0.5);
        if (v > best) {
          best = v;
          bestP = p;
        }
      }
      if (!bestP) continue;
      // Ausläufer: vereinzelte Felder knapp außerhalb des Randes
      if (best <= 0) {
        if (best < -fringe) continue;
        const k = 1 + best / fringe;
        if (hash01(this.seed, x, y, 71) > 0.45 * k * k) continue;
      }
      const rich = 0.6 + 0.8 * valueNoise(this.seed + bestP.res * 13, x / 4.5, y / 4.5);
      c.resource[i] = bestP.res;
      c.amount[i] = Math.max(10, Math.round(bestP.richness * (0.3 + Math.max(0, best) * 0.9) * rich));
    }
    return c;
  }
}
