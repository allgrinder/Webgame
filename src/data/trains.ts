/**
 * Züge. Quellen: Wiki „Locomotive“ (Formel je Tick, Tabelle weight/air_resistance/friction/braking, Höchsttempo
 * 1,2 Felder/Tick, Brennstoff-Boni), Infoboxen „Locomotive“ (600 kW, 3 Brennstoffplätze), „Cargo wagon“ (40 Plätze).
 * Gleise vereinfacht: gerade 2×2 und 90°-Bögen 4×4 (Radius 3) auf einem 2-Felder-Raster.
 */
export interface RollingStockDef {
  readonly id: 'locomotive' | 'cargo-wagon';
  readonly name: string;
  readonly weight: number;
  readonly airResistance: number;
  readonly friction: number;
  readonly braking: number;
  /** Länge auf dem Gleis (Felder) und Abstand zum nächsten Fahrzeug. */
  readonly length: number;
  readonly slots: number;
}

export const ROLLING_STOCK: Readonly<Record<RollingStockDef['id'], RollingStockDef>> = {
  locomotive: { id: 'locomotive', name: 'Lokomotive', weight: 2000, airResistance: 0.0075, friction: 0.5, braking: 10, length: 6, slots: 3 },
  'cargo-wagon': { id: 'cargo-wagon', name: 'Güterwagen', weight: 1000, airResistance: 0.01, friction: 0.5, braking: 3, length: 6, slots: 40 },
};

export const TRAIN = {
  /** Zugkraft je Lokomotive in Fahrtrichtung. */
  force: 10,
  maxSpeed: 1.2,
  /** Leistung der Lokomotive (W) beim Beschleunigen. */
  power: 600_000,
  /** Abstand zwischen zwei Fahrzeugen (Mitte zu Mitte). */
  spacing: 7,
  /** Kupplungsweite beim Aufstellen (Felder). */
  coupleDistance: 8.5,
  /** Gleise je Bogen (1.1: 4 Schienen je Bogen). */
  railsPerCurve: 4,
} as const;

/** Brennstoff-Boni (Wiki „Locomotive“): Beschleunigung, Höchsttempo. */
export const FUEL_BONUS: Readonly<Record<string, { accel: number; top: number }>> = {
  'solid-fuel': { accel: 1.2, top: 1.05 },
  'rocket-fuel': { accel: 1.8, top: 1.15 },
};

export type WaitCondition = 'time' | 'full' | 'empty' | 'inactivity';
export interface ScheduleEntry {
  station: string;
  wait: WaitCondition;
  /** Sekunden für 'time' und 'inactivity'. */
  seconds: number;
}
