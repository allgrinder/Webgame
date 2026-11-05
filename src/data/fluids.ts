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
  'crude-oil': { id: 'crude-oil', name: 'Rohöl', heatCapacity: 100, defaultTemperature: 25, color: 0x2a2018 },
  'heavy-oil': { id: 'heavy-oil', name: 'Schweröl', heatCapacity: 100, defaultTemperature: 25, color: 0xa04a18 },
  'light-oil': { id: 'light-oil', name: 'Leichtöl', heatCapacity: 100, defaultTemperature: 25, color: 0xc8a020 },
  'petroleum-gas': { id: 'petroleum-gas', name: 'Erdgas', heatCapacity: 100, defaultTemperature: 25, color: 0x5a3a6a },
  lubricant: { id: 'lubricant', name: 'Schmiermittel', heatCapacity: 100, defaultTemperature: 25, color: 0x2e7a3a },
  'sulfuric-acid': { id: 'sulfuric-acid', name: 'Schwefelsäure', heatCapacity: 100, defaultTemperature: 25, color: 0xc8c020 },
};

export function isFluid(id: string): boolean {
  return id in FLUIDS;
}

/** Energie in Joule, die eine Einheit Dampf bei Zieltemperatur gegenüber Wasser trägt. */
export function steamEnergyPerUnit(targetTemperature: number): number {
  const w = FLUIDS.water;
  return (targetTemperature - w.defaultTemperature) * w.heatCapacity;
}
