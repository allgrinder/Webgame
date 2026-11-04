/**
 * Bandphysik in ganzzahligen Positionen. Ein Feld ist 256 Positionen lang.
 * Quelle: Aufgabenstellung (Transport_belts/Physics), abgeglichen mit
 * factorio-data transport-belt speed = 0.03125 Felder/Tick = 8/256.
 */
export const BELT = {
  positionsPerTile: 256,
  /** Laufrichtung der Items: Positionen pro Tick (gelbes Band). */
  speed: 8,
  /** Mindestabstand zweier Items auf derselben Spur. */
  itemSpacing: 64,
  /** Spurlänge in Kurven. */
  curveInnerLength: 106,
  curveOuterLength: 295,
  /** Seitliches Einspeisen: Einfügepunkt als Abstand zum Feldende. */
  sideloadLate: 68,
  sideloadEarly: 188,
  /** Seitlicher Spurversatz von der Bandmitte in Feldern (nur Darstellung/Trefferprüfung). */
  laneOffset: 0.25,
} as const;
