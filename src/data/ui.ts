/** Darstellungswerte der Oberfläche (keine Spielmechanik). */
export const MINIMAP = {
  /** Kantenlänge in Feldern (quadratischer Ausschnitt um den Spieler bzw. die Kamera). */
  tiles: 128,
  /** Bildschirmpixel je Feld. */
  scale: 1.5,
  /** Neuzeichnen alle n Frames. */
  every: 20,
  grass: 0x6b6a3e,
  grassDark: 0x5c5c36,
  water: 0x2d4f5c,
  building: 0xb9b2a3,
  belt: 0xd4a040,
  player: 0xffffff,
} as const;
