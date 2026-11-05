import { BIOME } from '../data/decor';
import { MAPGEN } from '../data/mapgen';
import type { GameMap } from '../sim/map';

function lerpColor(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Bodenfarbe 0xRRGGBB für eine Fruchtbarkeit 0..1. */
export function biomeColor(f: number): number {
  return f < 0.5 ? lerpColor(BIOME.dry, BIOME.mid, f * 2) : lerpColor(BIOME.mid, BIOME.lush, (f - 0.5) * 2);
}

/**
 * Fruchtbarkeit je Feld (Feuchte + Wassernähe), je Chunk zwischengespeichert. Nur Darstellung:
 * Bodenfarbe, Bewuchs und Übersichtskarte.
 */
export class BiomeField {
  private readonly cache = new Map<number, Float32Array>();

  constructor(private readonly map: GameMap) {}

  fertility(tx: number, ty: number): number {
    const CS = MAPGEN.chunkSize;
    const cx = Math.floor(tx / CS);
    const cy = Math.floor(ty / CS);
    const key = (cx + 32768) * 65536 + (cy + 32768);
    let a = this.cache.get(key);
    if (!a) {
      a = this.build(cx, cy);
      this.cache.set(key, a);
    }
    return a[(ty - cy * CS) * CS + (tx - cx * CS)];
  }

  color(tx: number, ty: number): number {
    return biomeColor(this.fertility(tx, ty));
  }

  private build(cx: number, cy: number): Float32Array {
    const CS = MAPGEN.chunkSize;
    const out = new Float32Array(CS * CS);
    const R = BIOME.waterRange;
    let anyWater = false;
    for (let dy = -1; dy <= 1 && !anyWater; dy++) for (let dx = -1; dx <= 1 && !anyWater; dx++) if (this.map.getChunk(cx + dx, cy + dy).hasWater) anyWater = true;
    for (let i = 0; i < CS * CS; i++) {
      const tx = cx * CS + (i % CS);
      const ty = cy * CS + Math.floor(i / CS);
      let f = this.map.moistureAt(tx + 0.5, ty + 0.5);
      if (anyWater) {
        let best = R + 1;
        for (let oy = -R; oy <= R; oy++) {
          for (let ox = -R; ox <= R; ox++) {
            const d = Math.abs(ox) + Math.abs(oy) * 0.9;
            if (d >= best) continue;
            if (this.map.isWater(tx + ox, ty + oy)) best = d;
          }
        }
        if (best <= R) f += BIOME.waterBonus * (1 - best / (R + 1));
      }
      out[i] = Math.min(1, f);
    }
    return out;
  }
}
