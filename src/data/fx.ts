/**
 * Effekte (nur Darstellung): Austrittspunkte in Modellkoordinaten des Gebäudes bei Richtung Nord
 * (x Osten, y Norden, z Höhe in Feldern, wie in den Blender-Modellen) und Partikelwerte.
 */
export type FxKind = 'smoke' | 'dust' | 'spark';

export interface Emitter {
  readonly kind: FxKind;
  readonly at: readonly [number, number, number];
  /** Partikel pro Sekunde, solange das Gebäude arbeitet. */
  readonly rate: number;
  /** Zufällige Streuung des Austrittspunkts (Felder). */
  readonly spread?: number;
}

export const EMITTERS: Readonly<Record<string, readonly Emitter[]>> = {
  'stone-furnace': [
    { kind: 'smoke', at: [0.25, 0.25, 1.42], rate: 2.2 },
    { kind: 'spark', at: [0.25, 0.25, 1.42], rate: 0.9 },
  ],
  'burner-mining-drill': [
    { kind: 'smoke', at: [0.55, 0.35, 1.42], rate: 1.8 },
    { kind: 'dust', at: [0, 0, 0.05], rate: 1.2, spread: 0.9 },
  ],
  boiler: [
    { kind: 'smoke', at: [-0.85, -0.55, 1.85], rate: 3.0 },
    { kind: 'spark', at: [-0.85, -0.55, 1.85], rate: 0.5 },
  ],
  'electric-mining-drill': [{ kind: 'dust', at: [0, 0, 0.05], rate: 2.0, spread: 1.4 }],
};

/** Partikelwerte je Art: Lebensdauer (s), Steigen und Wind (Felder/s), Größe Anfang/Ende, Deckkraft. */
export const FX = {
  smoke: { life: 3.6, rise: 0.38, wind: 0.2, jitter: 0.06, size0: 0.45, size1: 1.7, alpha: 0.5 },
  dust: { life: 1.3, rise: 0.12, wind: 0.08, jitter: 0.15, size0: 0.35, size1: 0.9, alpha: 0.55 },
  spark: { life: 0.9, rise: 0.9, wind: 0.15, jitter: 0.35, size0: 0.55, size1: 0.2, alpha: 1.0 },
  /** Staub beim Handabbau (Partikel pro Sekunde). */
  mineDustRate: 6,
  maxParticles: 700,
} as const;
