/**
 * Dekoration der Karte (nur Darstellung, ohne Einfluss auf die Simulation).
 * Eigene Werte. Sprites aus assets/blender/models/decals.py und flora.py.
 */
export type DecorLayer = 'decal' | 'flora';

export interface DecorKind {
  readonly id: string;
  /** Sprite-Präfix; Varianten werden als <prefix>.<n> gezählt. */
  readonly sprite: string;
  readonly layer: DecorLayer;
  /** Rastergröße in Feldern: höchstens ein Kandidat je Rasterzelle. */
  readonly cell: number;
  /** Grundwahrscheinlichkeit je Zelle. */
  readonly chance: number;
  /** Zusätzlicher Faktor in „Hainen“ (großräumiges Rauschen > grove.threshold). */
  readonly groveBoost?: number;
  /** Abstand zu Ressourcenfeldern (Felder), 0 = auch darauf. */
  readonly clearOfResources: number;
  /** Abstand zum Startpunkt (Felder). */
  readonly clearOfSpawn: number;
  /** Hat eine eigene Schattenebene (<sprite>.<n>.shadow). */
  readonly shadow: boolean;
  /** Flache Flecken zufällig drehen und strecken (nur ohne gerichtete Schatten sinnvoll). */
  readonly warp?: boolean;
  /** Nur direkt am Ufer (Wasser im Nachbarfeld). */
  readonly shore?: boolean;
  /** Faktor, wenn Wasser in der Nähe ist (Radius WATER_NEAR). */
  readonly waterBoost?: number;
}

export const DECOR: readonly DecorKind[] = [
  { id: 'tint', sprite: 'decal.tint', layer: 'decal', cell: 11, chance: 0.7, clearOfResources: 0, clearOfSpawn: 0, shadow: false, warp: true },
  { id: 'dirt', sprite: 'decal.dirt', layer: 'decal', cell: 10, chance: 0.3, clearOfResources: 0, clearOfSpawn: 0, shadow: false, warp: true },
  { id: 'gravel', sprite: 'decal.gravel', layer: 'decal', cell: 17, chance: 0.18, clearOfResources: 0, clearOfSpawn: 0, shadow: false, warp: true },
  { id: 'pebbles', sprite: 'decal.pebbles', layer: 'decal', cell: 3, chance: 0.22, clearOfResources: 0, clearOfSpawn: 0, shadow: false },
  { id: 'tuft', sprite: 'decal.tuft', layer: 'decal', cell: 3, chance: 0.3, clearOfResources: 1, clearOfSpawn: 0, shadow: false },
  { id: 'flowers', sprite: 'decal.flowers', layer: 'decal', cell: 5, chance: 0.18, clearOfResources: 1, clearOfSpawn: 0, shadow: false },
  { id: 'reed', sprite: 'flora.reed', layer: 'flora', cell: 2, chance: 0.4, shore: true, clearOfResources: 1, clearOfSpawn: 0, shadow: true },
  { id: 'shrub', sprite: 'flora.shrub', layer: 'flora', cell: 7, chance: 0.1, groveBoost: 3, waterBoost: 3, clearOfResources: 2, clearOfSpawn: 9, shadow: true },
  { id: 'boulder', sprite: 'flora.boulder', layer: 'flora', cell: 11, chance: 0.12, clearOfResources: 2, clearOfSpawn: 9, shadow: true },
  { id: 'tree', sprite: 'flora.tree', layer: 'flora', cell: 5, chance: 0.008, groveBoost: 45, waterBoost: 6, clearOfResources: 3, clearOfSpawn: 14, shadow: true },
];

/** Haine: großräumiges Rauschen bestimmt, wo Bäume und Sträucher gehäuft stehen. */
export const GROVE = {
  scale: 45,
  threshold: 0.58,
} as const;

/** Radius (Felder), in dem Wasser als „in der Nähe“ gilt. */
export const WATER_NEAR = 5;

/** Unterhalb dieses Zooms werden kleine Decals nicht gezeichnet (Leistung). */
export const DECOR_MIN_ZOOM_SMALL = 0.35;
