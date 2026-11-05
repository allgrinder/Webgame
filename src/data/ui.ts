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
  waterEdge: 0x3e6a74,
  building: 0xd6cfbf,
  belt: 0xe0aa45,
  player: 0xffffff,
  view: 'rgba(255,255,255,0.75)',
  /** Abdunklung der Bodenfarbe (Wiesentextur ist hell, Kartenfarben sollen ruhiger wirken). */
  groundBase: 0x7c7848,
} as const;
