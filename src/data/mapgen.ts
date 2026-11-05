/** Parameter der Kartengenerierung (eigene Werte, keine Vorlage). */
export const MAPGEN = {
  chunkSize: 32,
  groundVariants: 8,
  /** Startfelder nahe (0,0): Entfernung vom Ursprung, Radius, Menge im Zentrum. */
  startPatches: [
    { resource: 'iron-ore', distance: 11, radius: 6, richness: 1200 },
    { resource: 'coal', distance: 10, radius: 5, richness: 900 },
    { resource: 'stone', distance: 11, radius: 4.5, richness: 700 },
    { resource: 'copper-ore', distance: 12, radius: 5, richness: 1000 },
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
    { resource: 'copper-ore', weight: 3 },
  ],
  /** Verzerrung der Feldform (Anteil des Radius). */
  patchWarp: 0.35,
  /** Breite der Ausläufer außerhalb des Feldrandes (Feldwert). */
  patchFringe: 0.18,
  /** Freier Radius um den Startpunkt (keine Ressourcen). */
  spawnFree: 3,
  /**
   * Feuchte: großräumiges Rauschen 0..1 (trockene Steppe bis feuchte Wiese). Steuert Seenhäufigkeit,
   * Bodenfarbe und Bewuchs. contrast spreizt die Werte um 0,5.
   */
  moisture: { scale: 230, contrast: 1.9 },
  /**
   * Seen: fraktales Rauschen mit Verzerrung (Buchten, Inseln) über dem Schwellwert; feuchte Gegenden
   * bekommen mehr Wasser. Kein Wasser näher als spawnClear, weicher Übergang über spawnFade.
   */
  lakes: { scale: 150, warp: 45, warpScale: 70, octaves: 4, threshold: 0.635, moistureBias: 0.2, spawnClear: 20, spawnFade: 60 },
  /**
   * Flüsse: Nulllinie eines verzerrten Rauschens (|n − 0,5| < Breite). Breite schwankt entlang des Laufs;
   * wo sie unter fordBelow fällt, entsteht eine Furt (Land), damit die Karte begehbar bleibt.
   */
  rivers: { scale: 380, warp: 60, warpScale: 90, width: 0.009, widthScale: 45, fordBelow: 0.38 },
  /** Startsee in Sichtweite (verzerrte Ellipse) in einer Richtung ohne Startfeld. */
  startLake: { distance: 34, radiusMin: 8, radiusMax: 11 },
  /** Kleine Teiche (verzerrte Ellipsen). */
  ponds: { cell: 64, chance: 0.32, radiusMin: 4, radiusMax: 8 },
} as const;
