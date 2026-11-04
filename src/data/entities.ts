import { KJ } from './time';

/**
 * Gebäude-Prototypen. kind bestimmt das Verhalten in src/sim/.
 * Neue Gebäude: Eintrag hier + Item in items.ts + Rezept in recipes.ts.
 */
interface EntityBase {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly health: number;
  /** Item, das beim Abbauen zurückgegeben wird. */
  readonly item: string;
  /** Abbauzeit für den Spieler in Sekunden (bei Abbaugeschwindigkeit 1). */
  readonly mineTime: number;
  /** Spieler kann nicht hindurchlaufen. */
  readonly solid: boolean;
  readonly rotatable: boolean;
}

export interface BeltDef extends EntityBase {
  readonly kind: 'belt';
}

export interface DrillDef extends EntityBase {
  readonly kind: 'drill';
  readonly miningSpeed: number;
  /** Leistungsaufnahme in Watt. */
  readonly energyUsage: number;
  /** Abbaubereich (quadratisch, zentriert auf das Gebäude), in Feldern. */
  readonly miningAreaSize: number;
  /** Ausgabepunkt relativ zur Gebäudemitte bei Richtung Nord, in Feldern. */
  readonly outputVector: readonly [number, number];
  readonly fuelSlots: number;
}

export interface FurnaceDef extends EntityBase {
  readonly kind: 'furnace';
  readonly craftingSpeed: number;
  readonly energyUsage: number;
  readonly fuelSlots: number;
}

export interface InserterDef extends EntityBase {
  readonly kind: 'inserter';
  /** Drehgeschwindigkeit in Umdrehungen pro Tick. */
  readonly rotationSpeed: number;
  /** Energie pro vollständigem Transfer (hin und zurück) in Joule. */
  readonly energyPerTransfer: number;
  /** Startenergie im Brennstoffpuffer in Joule. */
  readonly initialEnergy: number;
  /** Aufnahme- und Ablagepunkt relativ zur Mitte bei Richtung Nord (Ablage nach Norden), in Feldern. */
  readonly pickupVector: readonly [number, number];
  readonly dropVector: readonly [number, number];
  readonly fuelSlots: number;
  /** Greifarm füllt Zutaten in Maschinen nur bis zu so vielen Herstellvorgängen. */
  readonly ingredientLimitCrafts: number;
  /** Greifarm füllt Brennstoff in fremde Brennstoffslots nur bis zu dieser Anzahl. */
  readonly fuelInsertLimit: number;
}

export type EntityDef = BeltDef | DrillDef | FurnaceDef | InserterDef;

const list: EntityDef[] = [
  {
    kind: 'belt', id: 'transport-belt', name: 'Förderband', width: 1, height: 1, health: 150,
    item: 'transport-belt', mineTime: 0.1, solid: false, rotatable: true,
  },
  {
    kind: 'drill', id: 'burner-mining-drill', name: 'Brennstoff-Bohrer', width: 2, height: 2, health: 150,
    item: 'burner-mining-drill', mineTime: 0.3, solid: true, rotatable: true,
    miningSpeed: 0.25, energyUsage: 150_000, miningAreaSize: 2, outputVector: [-0.35, -1.3], fuelSlots: 1,
  },
  {
    kind: 'furnace', id: 'stone-furnace', name: 'Steinofen', width: 2, height: 2, health: 200,
    item: 'stone-furnace', mineTime: 0.2, solid: true, rotatable: false,
    craftingSpeed: 1, energyUsage: 90_000, fuelSlots: 1,
  },
  {
    kind: 'inserter', id: 'burner-inserter', name: 'Brennstoff-Greifarm', width: 1, height: 1, health: 100,
    item: 'burner-inserter', mineTime: 0.1, solid: true, rotatable: true,
    rotationSpeed: 0.013, energyPerTransfer: 69.4 * KJ, initialEnergy: 500 * KJ,
    pickupVector: [0, 1], dropVector: [0, -1.2], fuelSlots: 1,
    ingredientLimitCrafts: 2, fuelInsertLimit: 5,
  },
];

export const ENTITIES: Readonly<Record<string, EntityDef>> = Object.freeze(Object.fromEntries(list.map((e) => [e.id, e])));

export function entityDef(id: string): EntityDef {
  const d = ENTITIES[id];
  if (!d) throw new Error(`Unbekanntes Gebäude: ${id}`);
  return d;
}
