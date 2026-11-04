/** Feste Simulationsrate. Alle Zeitangaben in den Daten sind Sekunden und werden hierüber in Ticks umgerechnet. */
export const TICKS_PER_SECOND = 60;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** Watt -> Joule pro Tick (ganzzahlig). */
export function wattsToJoulesPerTick(watts: number): number {
  return Math.round(watts / TICKS_PER_SECOND);
}

export const KJ = 1_000;
export const MJ = 1_000_000;
