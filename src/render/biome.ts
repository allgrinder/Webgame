import { BIOME } from '../data/decor';
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
  constructor(private readonly map: GameMap) {}

  /** Fruchtbarkeit 0..1 (aus der Simulation, siehe TreeField). */
  fertility(tx: number, ty: number): number {
    return this.map.trees.fertility(tx, ty);
  }

  color(tx: number, ty: number): number {
    return biomeColor(this.fertility(tx, ty));
  }
}
