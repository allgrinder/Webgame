/**
 * Farbabstimmung des ganzen Bildes (nur Darstellung). Zwei Stufen:
 *  ground – Boden, Wasser, Erze, Decals: dunkler und satter, damit Gebäude und Bänder davor stehen.
 *  world  – alles in der Welt: etwas mehr Kontrast, warme Lichter, kühle Schatten (Split-Toning).
 * Quelle: eigene Abstimmung nach Bildvergleich (Messvorschlag), siehe docs/ART_STYLE.md „Licht und Farbe“.
 */
export interface Grade {
  /** Helligkeit (Faktor). */
  readonly brightness: number;
  /** Kontrast um den Drehpunkt (1 = unverändert). */
  readonly contrast: number;
  readonly pivot: number;
  /** Sättigung (1 = unverändert). */
  readonly saturation: number;
  /** Farbstich der Lichter: Faktoren für R, G, B. */
  readonly gain: readonly [number, number, number];
  /** Anhebung der Schatten: Summand für R, G, B (0..1). */
  readonly lift: readonly [number, number, number];
}

export const LOOK = {
  ground: { brightness: 0.8, contrast: 1.18, pivot: 0.42, saturation: 0.98, gain: [0.98, 1, 0.98], lift: [0, 0, 0] } as Grade,
  world: { brightness: 1.02, contrast: 1.1, pivot: 0.45, saturation: 1.04, gain: [1.03, 1.0, 0.95], lift: [0, 0.004, 0.016] } as Grade,
  /** Deckkraft der Schattenebene (Gebäude, Bäume, Items). */
  shadowAlpha: 0.74,
  /** Großflächige Helligkeitsschwankung des Bodens: Stärke (±) und Größe der Flecken in Feldern. */
  macro: { amp: 0.13, scale: 22, amp2: 0.06, scale2: 7 },
} as const;
