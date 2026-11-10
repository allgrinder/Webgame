/**
 * Rüstung und Ausrüstung (Wiki-Infoboxen „Heavy armor“, „Modular armor“, „Power armor“, „Personal roboport“,
 * „Portable solar panel“, „Personal battery“; Werte für normale Qualität).
 * Vereinfachung: Widerstand gegen „physisch“ gilt für jeden Schaden an der Figur.
 */
export interface ArmorDef {
  readonly id: string;
  /** Rasterbreite × -höhe für Ausrüstung (0 = kein Raster). */
  readonly gridW: number;
  readonly gridH: number;
  /** Zusätzliche Inventarplätze. */
  readonly inventoryBonus: number;
  /** Physischer Widerstand: fester Abzug und Anteil. */
  readonly flat: number;
  readonly percent: number;
}

export const ARMORS: Readonly<Record<string, ArmorDef>> = {
  'heavy-armor': { id: 'heavy-armor', gridW: 0, gridH: 0, inventoryBonus: 0, flat: 6, percent: 0.3 },
  'modular-armor': { id: 'modular-armor', gridW: 5, gridH: 5, inventoryBonus: 10, flat: 6, percent: 0.3 },
  'power-armor': { id: 'power-armor', gridW: 6, gridH: 8, inventoryBonus: 20, flat: 8, percent: 0.3 },
};

export type EquipmentKind = 'roboport' | 'solar' | 'battery';

export interface EquipmentDef {
  readonly id: string;
  readonly kind: EquipmentKind;
  readonly w: number;
  readonly h: number;
  /** Speicher (J). */
  readonly capacity?: number;
  /** Leistung bei vollem Tageslicht (W). */
  readonly power?: number;
  /** Roboterhangar: Roboter, Ladeplätze, Ladeleistung je Platz (W), Baufläche (Kantenlänge). */
  readonly robots?: number;
  readonly chargers?: number;
  readonly chargePower?: number;
  readonly area?: number;
}

export const EQUIPMENT: Readonly<Record<string, EquipmentDef>> = {
  'personal-roboport-equipment': {
    id: 'personal-roboport-equipment', kind: 'roboport', w: 2, h: 2, capacity: 35_000_000, robots: 10, chargers: 2, chargePower: 1_000_000, area: 30,
  },
  'solar-panel-equipment': { id: 'solar-panel-equipment', kind: 'solar', w: 1, h: 1, power: 30_000 },
  'battery-equipment': { id: 'battery-equipment', kind: 'battery', w: 1, h: 2, capacity: 20_000_000 },
};

export const isArmor = (item: string): boolean => item in ARMORS;
export const isEquipment = (item: string): boolean => item in EQUIPMENT;

/** Persönliche Roboter starten erst ab 20 % Ladung des Hangarspeichers (Wiki „Personal roboport“). */
export const PERSONAL_ROBOPORT_MIN_CHARGE = 0.2;
/** Reparatur durch Roboter: Lebenspunkte je Tick (Messvorschlag; Reparaturset hält 300 Punkte, Wiki „Repair pack“). */
export const ROBOT_REPAIR_PER_TICK = 2;
