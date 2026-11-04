/** Parameter der Kartengenerierung (eigene Werte, keine Vorlage). */
export const MAPGEN = {
  chunkSize: 32,
  groundVariants: 8,
  /** Startfelder nahe (0,0): Entfernung vom Ursprung, Radius, Menge im Zentrum. */
  startPatches: [
    { resource: 'iron-ore', distance: 11, radius: 6, richness: 1200 },
    { resource: 'coal', distance: 10, radius: 5, richness: 900 },
    { resource: 'stone', distance: 11, radius: 4.5, richness: 700 },
  ],
  /** Zufällige Felder: Raster, Wahrscheinlichkeit, Radiusbereich, Reichtum (steigt mit Entfernung). */
  patchCell: 80,
  patchChance: 0.55,
  patchRadiusMin: 5,
  patchRadiusMax: 12,
  patchRichnessBase: 600,
  patchRichnessPerTile: 2,
  /** Kein zufälliges Feld näher als dieser Abstand zum Start. */
  startExclusionRadius: 48,
  /** Gewichtung zufälliger Felder je Ressource. */
  patchWeights: [
    { resource: 'iron-ore', weight: 4 },
    { resource: 'coal', weight: 3 },
    { resource: 'stone', weight: 2 },
  ],
  /** Rauschanteil am Feldrand (0..1). */
  edgeNoise: 0.35,
} as const;
