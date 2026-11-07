/** Darstellungswerte der Oberfläche (keine Spielmechanik). */
export const MINIMAP = {
  /** Größen (Bildschirmpixel Kantenlänge, Pixel je Feld); M schaltet klein → groß → aus. */
  sizes: [
    { px: 220, scale: 1.5 },
    { px: 440, scale: 1.25 },
  ],
  /** Neuzeichnen alle n Frames, Gelände eines Chunks neu berechnen nach n Frames (abgebautes Erz). */
  every: 8,
  terrainRefresh: 600,
  water: 0x2f5562,
  cliff: 0x4a3f33,
  waterEdge: 0x3e6a74,
  building: 0xd6cfbf,
  belt: 0xe0aa45,
  player: 0xffffff,
  view: 'rgba(255,255,255,0.75)',
  /** Abdunklung der Bodenfarbe (Wiesentextur ist hell, Kartenfarben sollen ruhiger wirken). */
  groundBase: 0x7c7848,
} as const;

/** Zeitfenster der Produktions- und Stromstatistik (wie im Original: 1 min, 10 min, 1 h, 10 h). */
export const STATS = {
  windows: [
    { label: '1 min', step: 1, count: 60 },
    { label: '10 min', step: 10, count: 60 },
    { label: '1 h', step: 60, count: 60 },
    { label: '10 h', step: 600, count: 60 },
  ],
} as const;
