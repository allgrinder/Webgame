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

/**
 * Tag und Nacht (Wiki „Time“, Days): ein Tag dauert 25.200 Ticks (7 min). Tageszeit 0 = Mittag.
 * Tag 0,75–0,25 hell, Abend 0,25–0,45 dunkler werdend, Nacht 0,45–0,55 dunkel, Morgen 0,55–0,75 heller.
 * Lampen schalten sich nachts ein (lampOn: ab dieser Dunkelheit).
 */
export const DAY = { ticks: 25_200, dusk: 0.25, evening: 0.45, morning: 0.55, dawn: 0.75, lampOn: 0.3 } as const;

/** Dunkelheit 0 (Tag) … 1 (Nacht) zur Tageszeit t (0..1). */
export function darknessAt(t: number): number {
  if (t < DAY.dusk || t >= DAY.dawn) return 0;
  if (t < DAY.evening) return (t - DAY.dusk) / (DAY.evening - DAY.dusk);
  if (t < DAY.morning) return 1;
  return 1 - (t - DAY.morning) / (DAY.dawn - DAY.morning);
}
