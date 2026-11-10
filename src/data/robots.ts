/**
 * Roboter und Roboterhangar. Quellen: Wiki-Infoboxen „Roboport“, „Logistic robot“, „Construction robot“ (2.0),
 * Text „Logistic robot“ (0,05 Felder/Tick, ohne Strom 20 % Tempo, Ladung 1 Item).
 */
import { wattsToJoulesPerTick } from './time';

export interface RobotDef {
  readonly id: 'construction-robot' | 'logistic-robot';
  readonly name: string;
  /** Felder je Tick bei vollem Akku. */
  readonly speed: number;
  /** Verbrauch im Flug (J/Tick) – Infobox „energy“ (63,75 kW bzw. 75,9 kW). */
  readonly flyPerTick: number;
  /** Akku (J). */
  readonly capacity: number;
  /** Tragfähigkeit (Items) ohne Forschung. */
  readonly cargo: number;
}

export const ROBOTS: Readonly<Record<RobotDef['id'], RobotDef>> = {
  'construction-robot': { id: 'construction-robot', name: 'Bauroboter', speed: 0.06, flyPerTick: wattsToJoulesPerTick(75_900), capacity: 3_000_000, cargo: 1 },
  'logistic-robot': { id: 'logistic-robot', name: 'Logistikroboter', speed: 0.05, flyPerTick: wattsToJoulesPerTick(63_750), capacity: 1_500_000, cargo: 1 },
};

/** Tempo ohne Akkuladung (Anteil). */
export const ROBOT_LOW_POWER_SPEED = 0.2;

export const ROBOPORT = {
  /** Halbe Kantenlänge der Bereiche (50×50 Logistik, 110×110 Bau) um die Mitte. */
  logisticRadius: 25,
  constructionRadius: 55,
  robotSlots: 7,
  chargers: 4,
  /** Ladeleistung je Ladeplatz (W). */
  chargePower: 500_000,
  /** Nachladen des eigenen Speichers aus dem Netz (W). */
  bufferInput: 2_100_000,
  /** Eigener Speicher (J); Quelle 2 (factorio-data roboport, buffer_capacity 100 MJ). */
  buffer: 100_000_000,
  drain: 50_000,
  /** Suche nach beschädigten Gebäuden (Ticks, Messvorschlag). */
  repairScanEvery: 60,
  /** Aufgaben verteilen alle n Ticks (Messvorschlag). */
  dispatchEvery: 10,
} as const;

export function isRobot(item: string): item is RobotDef['id'] {
  return item === 'construction-robot' || item === 'logistic-robot';
}
