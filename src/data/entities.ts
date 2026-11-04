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
  /** Positionen pro Tick (256 pro Feld). */
  readonly speed: number;
}

export interface UndergroundDef extends EntityBase {
  readonly kind: 'underground';
  readonly speed: number;
  /** Größter Abstand Eingang–Ausgang in Feldern. */
  readonly maxDistance: number;
}

export interface SplitterDef extends EntityBase {
  readonly kind: 'splitter';
  readonly speed: number;
}

/** Energieart: Brennstoff (Burner) oder Strom (elektrisches Netz). */
export type EnergyKind = 'burner' | 'electric';

export interface DrillDef extends EntityBase {
  readonly kind: 'drill';
  readonly energy: EnergyKind;
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
  readonly energy: EnergyKind;
  /** Grundlast im Netz (W), nur elektrisch. */
  readonly drain: number;
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

export interface ContainerDef extends EntityBase {
  readonly kind: 'container';
  readonly slots: number;
}

export interface PipeDef extends EntityBase {
  readonly kind: 'pipe';
  /** Fassungsvermögen (Einheiten). */
  readonly capacity: number;
}

export interface PumpDef extends EntityBase {
  readonly kind: 'offshore-pump';
  /** Fördermenge in Einheiten pro Tick. */
  readonly pumpingSpeed: number;
  readonly capacity: number;
  readonly fluid: string;
}

export interface BoilerDef extends EntityBase {
  readonly kind: 'boiler';
  readonly energyUsage: number;
  readonly fuelSlots: number;
  readonly inputFluid: string;
  readonly outputFluid: string;
  /** Zieltemperatur des Dampfes (°C) – bestimmt die Energie je Einheit. */
  readonly targetTemperature: number;
  readonly capacity: number;
}

export interface GeneratorDef extends EntityBase {
  readonly kind: 'generator';
  /** Höchstleistung (W). */
  readonly maxPower: number;
  /** Dampfverbrauch bei voller Leistung (Einheiten pro Tick). */
  readonly fluidPerTick: number;
  readonly fluid: string;
  readonly capacity: number;
}

export interface PoleDef extends EntityBase {
  readonly kind: 'pole';
  /** Kabelreichweite (Felder, Mittelpunkt zu Mittelpunkt). */
  readonly wireReach: number;
  /** Versorgungsbereich: Abstand vom Mittelpunkt (Felder), quadratisch. */
  readonly supplyRadius: number;
}

export interface AssemblerDef extends EntityBase {
  readonly kind: 'assembler';
  readonly craftingSpeed: number;
  readonly energyUsage: number;
  readonly drain: number;
}

export interface LabDef extends EntityBase {
  readonly kind: 'lab';
  readonly researchSpeed: number;
  readonly energyUsage: number;
  readonly drain: number;
  readonly inputs: readonly string[];
}

export type EntityDef = BeltDef | DrillDef | FurnaceDef | InserterDef | ContainerDef | PipeDef | PumpDef | BoilerDef | GeneratorDef | PoleDef | AssemblerDef | LabDef | UndergroundDef | SplitterDef;

const list: EntityDef[] = [
  {
    kind: 'belt', id: 'transport-belt', name: 'Förderband', width: 1, height: 1, health: 150,
    item: 'transport-belt', mineTime: 0.1, solid: false, rotatable: true, speed: 8,
  },
  {
    kind: 'belt', id: 'fast-transport-belt', name: 'Schnelles Förderband', width: 1, height: 1, health: 160,
    item: 'fast-transport-belt', mineTime: 0.1, solid: false, rotatable: true, speed: 16,
  },
  {
    kind: 'underground', id: 'underground-belt', name: 'Untergrundband', width: 1, height: 1, health: 150,
    item: 'underground-belt', mineTime: 0.1, solid: false, rotatable: true, speed: 8, maxDistance: 5,
  },
  {
    kind: 'splitter', id: 'splitter', name: 'Splitter', width: 2, height: 1, health: 170,
    item: 'splitter', mineTime: 0.1, solid: false, rotatable: true, speed: 8,
  },
  {
    kind: 'drill', id: 'burner-mining-drill', name: 'Brennstoff-Bohrer', width: 2, height: 2, health: 150,
    item: 'burner-mining-drill', mineTime: 0.3, solid: true, rotatable: true, energy: 'burner',
    miningSpeed: 0.25, energyUsage: 150_000, miningAreaSize: 2, outputVector: [-0.35, -1.3], fuelSlots: 1,
  },
  {
    kind: 'furnace', id: 'stone-furnace', name: 'Steinofen', width: 2, height: 2, health: 200,
    item: 'stone-furnace', mineTime: 0.2, solid: true, rotatable: false,
    craftingSpeed: 1, energyUsage: 90_000, fuelSlots: 1,
  },
  {
    kind: 'inserter', id: 'burner-inserter', name: 'Brennstoff-Greifarm', width: 1, height: 1, health: 100,
    item: 'burner-inserter', mineTime: 0.1, solid: true, rotatable: true, energy: 'burner', drain: 0,
    rotationSpeed: 0.013, energyPerTransfer: 69.4 * KJ, initialEnergy: 500 * KJ,
    pickupVector: [0, 1], dropVector: [0, -1.2], fuelSlots: 1,
    ingredientLimitCrafts: 2, fuelInsertLimit: 5,
  },
  {
    kind: 'drill', id: 'electric-mining-drill', name: 'Elektrischer Bohrer', width: 3, height: 3, health: 300,
    item: 'electric-mining-drill', mineTime: 0.3, solid: true, rotatable: true, energy: 'electric',
    miningSpeed: 0.5, energyUsage: 90_000, miningAreaSize: 5, outputVector: [0, -1.85], fuelSlots: 0,
  },
  {
    kind: 'inserter', id: 'inserter', name: 'Greifarm', width: 1, height: 1, health: 150,
    item: 'inserter', mineTime: 0.1, solid: true, rotatable: true, energy: 'electric', drain: 400,
    // 13,2 kW × Zyklus (1000/14 Ticks = 1,19 s) ≈ 15,7 kJ je Transfer
    rotationSpeed: 0.014, energyPerTransfer: 15.7 * KJ, initialEnergy: 0,
    pickupVector: [0, 1], dropVector: [0, -1.2], fuelSlots: 0,
    ingredientLimitCrafts: 2, fuelInsertLimit: 5,
  },
  {
    kind: 'inserter', id: 'long-handed-inserter', name: 'Langer Greifarm', width: 1, height: 1, health: 160,
    item: 'long-handed-inserter', mineTime: 0.1, solid: true, rotatable: true, energy: 'electric', drain: 400,
    // 20 kW × Zyklus (1000/20 Ticks = 0,83 s) ≈ 16,7 kJ je Transfer
    rotationSpeed: 0.02, energyPerTransfer: 16.7 * KJ, initialEnergy: 0,
    pickupVector: [0, 2], dropVector: [0, -2.2], fuelSlots: 0,
    ingredientLimitCrafts: 2, fuelInsertLimit: 5,
  },
  {
    kind: 'pipe', id: 'pipe', name: 'Rohr', width: 1, height: 1, health: 100,
    item: 'pipe', mineTime: 0.1, solid: true, rotatable: false, capacity: 100,
  },
  {
    kind: 'offshore-pump', id: 'offshore-pump', name: 'Uferpumpe', width: 1, height: 1, health: 150,
    item: 'offshore-pump', mineTime: 0.1, solid: true, rotatable: true, pumpingSpeed: 20, capacity: 100, fluid: 'water',
  },
  {
    kind: 'boiler', id: 'boiler', name: 'Kessel', width: 3, height: 2, health: 200,
    item: 'boiler', mineTime: 0.2, solid: true, rotatable: true, energyUsage: 1_800_000, fuelSlots: 1,
    inputFluid: 'water', outputFluid: 'steam', targetTemperature: 165, capacity: 200,
  },
  {
    kind: 'generator', id: 'steam-engine', name: 'Dampfmaschine', width: 3, height: 5, health: 400,
    item: 'steam-engine', mineTime: 0.3, solid: true, rotatable: true, maxPower: 900_000, fluidPerTick: 0.5,
    fluid: 'steam', capacity: 200,
  },
  {
    kind: 'pole', id: 'small-electric-pole', name: 'Kleiner Strommast', width: 1, height: 1, health: 100,
    item: 'small-electric-pole', mineTime: 0.1, solid: true, rotatable: false, wireReach: 7.5, supplyRadius: 2.5,
  },
  {
    kind: 'assembler', id: 'assembling-machine-1', name: 'Montagemaschine', width: 3, height: 3, health: 300,
    item: 'assembling-machine-1', mineTime: 0.2, solid: true, rotatable: false, craftingSpeed: 0.5, energyUsage: 75_000, drain: 2_500,
  },
  {
    kind: 'lab', id: 'lab', name: 'Labor', width: 3, height: 3, health: 150,
    item: 'lab', mineTime: 0.2, solid: true, rotatable: false, researchSpeed: 1, energyUsage: 60_000, drain: 2_000,
    inputs: ['automation-science-pack', 'logistic-science-pack'],
  },
  {
    kind: 'container', id: 'iron-chest', name: 'Eisenkiste', width: 1, height: 1, health: 200,
    item: 'iron-chest', mineTime: 0.2, solid: true, rotatable: false, slots: 32,
  },
];

export const ENTITIES: Readonly<Record<string, EntityDef>> = Object.freeze(Object.fromEntries(list.map((e) => [e.id, e])));

export function entityDef(id: string): EntityDef {
  const d = ENTITIES[id];
  if (!d) throw new Error(`Unbekanntes Gebäude: ${id}`);
  return d;
}

/** Grundfläche (Breite, Höhe) in Feldern für eine Richtung; bei Ost/West getauscht. */
export function sizeOf(def: EntityDef, dir: number): [number, number] {
  return dir % 2 === 1 ? [def.height, def.width] : [def.width, def.height];
}
