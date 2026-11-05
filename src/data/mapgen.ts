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
  /**
   * Ölfelder: Gruppen einzelner Quellen (Wiki: Pumpjack fördert 10 × Ergiebigkeit/s). Ergiebigkeit in Prozent,
   * steigt mit der Entfernung; Mindestabstand zum Start.
   */
  oil: { cell: 110, chance: 0.55, minDistance: 70, wellsMin: 4, wellsMax: 10, radius: 7, spacing: 3, yieldMin: 60, yieldMax: 200, yieldPerTile: 0.25 },
  /** Startsee in Sichtweite (verzerrte Ellipse) in einer Richtung ohne Startfeld. */
  startLake: { distance: 34, radiusMin: 8, radiusMax: 11 },
  /** Kleine Teiche (verzerrte Ellipsen). */
  ponds: { cell: 64, chance: 0.32, radiusMin: 4, radiusMax: 8 },
  /**
   * Bäume (fällbar, liefern Holz). Je Art ein Raster (höchstens ein Baum je Zelle), Grundwahrscheinlichkeit,
   * Faktor in Hainen und in Wassernähe, Abhängigkeit von der Fruchtbarkeit wie bei der Deko (src/data/decor.ts).
   * Holzmenge und Abbauzeit: Wiki „Wood“ / Infobox „Tree“ (Baum 4 Holz, 0,55 s; abgestorben 2 Holz, 0,5 s).
   */
  trees: {
    kinds: [
      { id: 'tree', sprite: 'flora.tree', cell: 5, chance: 0.008, groveBoost: 45, waterBoost: 6, fertility: 1.4, wood: 4, mineTime: 0.55 },
      { id: 'conifer', sprite: 'flora.conifer', cell: 6, chance: 0.004, groveBoost: 35, waterBoost: 2, fertility: 0.9, wood: 4, mineTime: 0.55 },
      { id: 'dead', sprite: 'flora.deadtree', cell: 13, chance: 0.05, groveBoost: 0, waterBoost: 0, fertility: -1.3, wood: 2, mineTime: 0.5 },
    ],
    /** Varianten je Art (Anzahl Sprites); die Darstellung nimmt variant % vorhandene Sprites. */
    variants: 8,
    clearOfSpawn: 14,
    clearOfResources: 3,
    grove: { scale: 45, threshold: 0.58 },
    waterNear: 5,
  },
} as const;
