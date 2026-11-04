/** Flüssigkeiten. Mengen im Spiel in Einheiten; intern ganzzahlig in Tausendstel (FLUID_UNIT). */
export const FLUID_UNIT = 1000;

export interface FluidDef {
  readonly id: string;
  readonly name: string;
  /** Wärmekapazität (J je Einheit und °C). */
  readonly heatCapacity: number;
  readonly defaultTemperature: number;
  /** Darstellungsfarbe (sRGB) */
  readonly color: number;
}

export const FLUIDS: Readonly<Record<string, FluidDef>> = {
  water: { id: 'water', name: 'Wasser', heatCapacity: 200, defaultTemperature: 15, color: 0x3a6f9a },
  steam: { id: 'steam', name: 'Dampf', heatCapacity: 200, defaultTemperature: 165, color: 0xd8d8d8 },
};

/** Energie in Joule, die eine Einheit Dampf bei Zieltemperatur gegenüber Wasser trägt. */
export function steamEnergyPerUnit(targetTemperature: number): number {
  const w = FLUIDS.water;
  return (targetTemperature - w.defaultTemperature) * w.heatCapacity;
}
