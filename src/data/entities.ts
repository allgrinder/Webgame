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
  /** Standard: Brennstoff. */
  readonly energy?: EnergyKind;
  readonly drain?: number;
}

/** Pumpjack: fördert Rohöl aus dem Feld unter seiner Mitte (Wiki: 10 × Ergiebigkeit pro s). */
export interface PumpjackDef extends EntityBase {
  readonly kind: 'pumpjack';
  readonly energyUsage: number;
  readonly miningSpeed: number;
  readonly capacity: number;
}

export interface InserterDef extends EntityBase {
  readonly kind: 'inserter';
  readonly energy: EnergyKind;
  /** Grundlast im Netz (W), nur elektrisch. */
  readonly drain: number;
  /** Drehgeschwindigkeit in Umdrehungen pro Tick (Prototyp). */
  readonly rotationSpeed: number;
  /** Ticks je Halbdrehung, wie im Spiel gemessen (ganzzahlig, abgerundet; Wiki: Ticks je Zyklus / 2). */
  readonly halfTurnTicks: number;
  /** Energie pro vollständigem Transfer (hin und zurück) in Joule. */
  readonly energyPerTransfer: number;
  /** Startenergie im Brennstoffpuffer in Joule. */
  readonly initialEnergy: number;
  /** Aufnahme- und Ablagepunkt relativ zur Mitte bei Richtung Nord (Ablage nach Norden), in Feldern. */
  readonly pickupVector: readonly [number, number];
  readonly dropVector: readonly [number, number];
  readonly fuelSlots: number;
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
  /** Einheiten Dampf je Einheit Wasser. */
  readonly steamPerWater: number;
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

/** Flüssigkeitsbehälter einer Maschine: Anschlüsse (lokales Feld, Richtung) bei Richtung Nord. */
export interface MachineFluidBox {
  readonly type: 'input' | 'output';
  readonly volume: number;
  readonly ports: readonly (readonly [number, number, 0 | 1 | 2 | 3])[];
}

export interface AssemblerDef extends EntityBase {
  readonly kind: 'assembler';
  readonly craftingSpeed: number;
  readonly energyUsage: number;
  readonly drain: number;
  /** Rezeptkategorien, die die Maschine herstellen kann. */
  readonly categories: readonly string[];
  readonly fluidBoxes?: readonly MachineFluidBox[];
}

export interface LabDef extends EntityBase {
  readonly kind: 'lab';
  readonly researchSpeed: number;
  readonly energyUsage: number;
  readonly drain: number;
  readonly inputs: readonly string[];
}

/** Rohr unterirdisch: verbindet sich über bis zu maxDistance Felder mit einem gegenüberliegenden Gegenstück. */
export interface PipeGroundDef extends EntityBase {
  readonly kind: 'pipe-ground';
  readonly capacity: number;
  readonly maxDistance: number;
}

/** Pumpe (elektrisch): fördert von hinten nach vorn. */
export interface FluidPumpDef extends EntityBase {
  readonly kind: 'pump';
  readonly energyUsage: number;
  /** Einheiten je Tick. */
  readonly pumpingSpeed: number;
  readonly capacity: number;
}

export interface TankDef extends EntityBase {
  readonly kind: 'tank';
  readonly capacity: number;
}

export interface LampDef extends EntityBase {
  readonly kind: 'lamp';
  readonly energyUsage: number;
}

export type EntityDef = BeltDef | DrillDef | FurnaceDef | InserterDef | ContainerDef | PipeDef | PumpDef | BoilerDef | GeneratorDef | PoleDef | AssemblerDef | LabDef | UndergroundDef | SplitterDef
  | PipeGroundDef | FluidPumpDef | TankDef | LampDef | PumpjackDef;

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
    kind: 'underground', id: 'fast-underground-belt', name: 'Schnelles Untergrundband', width: 1, height: 1, health: 160,
    item: 'fast-underground-belt', mineTime: 0.1, solid: false, rotatable: true, speed: 16, maxDistance: 7,
  },
  {
    kind: 'splitter', id: 'fast-splitter', name: 'Schneller Splitter', width: 2, height: 1, health: 180,
    item: 'fast-splitter', mineTime: 0.1, solid: false, rotatable: true, speed: 16,
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
    rotationSpeed: 0.013, halfTurnTicks: 38, energyPerTransfer: 66.9 * KJ, initialEnergy: 500 * KJ,
    pickupVector: [0, 1], dropVector: [0, -1.2], fuelSlots: 1,
    fuelInsertLimit: 5,
  },
  {
    kind: 'drill', id: 'electric-mining-drill', name: 'Elektrischer Bohrer', width: 3, height: 3, health: 300,
    item: 'electric-mining-drill', mineTime: 0.3, solid: true, rotatable: true, energy: 'electric',
    miningSpeed: 0.5, energyUsage: 90_000, miningAreaSize: 5, outputVector: [0, -1.85], fuelSlots: 0,
  },
  {
    kind: 'inserter', id: 'inserter', name: 'Greifarm', width: 1, height: 1, health: 150,
    item: 'inserter', mineTime: 0.1, solid: true, rotatable: true, energy: 'electric', drain: 400,
    // Wiki „Inserters“, Energie je Zyklus 6,65 kJ, 70 Ticks je Zyklus
    rotationSpeed: 0.014, halfTurnTicks: 35, energyPerTransfer: 6.65 * KJ, initialEnergy: 0,
    pickupVector: [0, 1], dropVector: [0, -1.2], fuelSlots: 0,
    fuelInsertLimit: 5,
  },
  {
    kind: 'inserter', id: 'long-handed-inserter', name: 'Langer Greifarm', width: 1, height: 1, health: 160,
    item: 'long-handed-inserter', mineTime: 0.1, solid: true, rotatable: true, energy: 'electric', drain: 400,
    // Wiki „Inserters“, Energie je Zyklus 7 kJ, 48 Ticks je Zyklus
    rotationSpeed: 0.02, halfTurnTicks: 24, energyPerTransfer: 7 * KJ, initialEnergy: 0,
    pickupVector: [0, 2], dropVector: [0, -2.2], fuelSlots: 0,
    fuelInsertLimit: 5,
  },
  {
    kind: 'pipe', id: 'pipe', name: 'Rohr', width: 1, height: 1, health: 100,
    item: 'pipe', mineTime: 0.1, solid: true, rotatable: false, capacity: 100,
  },
  {
    kind: 'offshore-pump', id: 'offshore-pump', name: 'Uferpumpe', width: 1, height: 2, health: 150,
    item: 'offshore-pump', mineTime: 0.1, solid: true, rotatable: true, pumpingSpeed: 20, capacity: 100, fluid: 'water',
  },
  {
    kind: 'boiler', id: 'boiler', name: 'Kessel', width: 3, height: 2, health: 200,
    item: 'boiler', mineTime: 0.2, solid: true, rotatable: true, energyUsage: 1_800_000, fuelSlots: 1,
    inputFluid: 'water', outputFluid: 'steam', targetTemperature: 165, steamPerWater: 10, capacity: 200,
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
    categories: ['crafting', 'advanced-crafting'],
  },
  {
    kind: 'lab', id: 'lab', name: 'Labor', width: 3, height: 3, health: 150,
    item: 'lab', mineTime: 0.2, solid: true, rotatable: false, researchSpeed: 1, energyUsage: 60_000, drain: 2_000,
    inputs: ['automation-science-pack', 'logistic-science-pack', 'chemical-science-pack'],
  },
  {
    kind: 'container', id: 'steel-chest', name: 'Stahlkiste', width: 1, height: 1, health: 350,
    item: 'steel-chest', mineTime: 0.2, solid: true, rotatable: false, slots: 48,
  },
  {
    kind: 'furnace', id: 'steel-furnace', name: 'Stahlofen', width: 2, height: 2, health: 300,
    item: 'steel-furnace', mineTime: 0.2, solid: true, rotatable: false, craftingSpeed: 2, energyUsage: 90_000, fuelSlots: 1,
  },
  {
    kind: 'inserter', id: 'fast-inserter', name: 'Schneller Greifarm', width: 1, height: 1, health: 150,
    item: 'fast-inserter', mineTime: 0.1, solid: true, rotatable: true, energy: 'electric', drain: 500,
    // Wiki „Inserters“: 0,04 U/Tick, 24 Ticks je Zyklus, 8,12 kJ je Zyklus
    rotationSpeed: 0.04, halfTurnTicks: 12, energyPerTransfer: 8.12 * KJ, initialEnergy: 0,
    pickupVector: [0, 1], dropVector: [0, -1.2], fuelSlots: 0,
    fuelInsertLimit: 5,
  },
  {
    kind: 'pole', id: 'medium-electric-pole', name: 'Mittlerer Strommast', width: 1, height: 1, health: 100,
    item: 'medium-electric-pole', mineTime: 0.1, solid: true, rotatable: false, wireReach: 9, supplyRadius: 3.5,
  },
  {
    kind: 'pole', id: 'big-electric-pole', name: 'Großer Strommast', width: 2, height: 2, health: 150,
    item: 'big-electric-pole', mineTime: 0.1, solid: true, rotatable: false, wireReach: 32, supplyRadius: 2,
  },
  {
    kind: 'lamp', id: 'lamp', name: 'Lampe', width: 1, height: 1, health: 100,
    item: 'lamp', mineTime: 0.1, solid: true, rotatable: false, energyUsage: 5_000,
  },
  {
    kind: 'assembler', id: 'assembling-machine-2', name: 'Montagemaschine 2', width: 3, height: 3, health: 350,
    item: 'assembling-machine-2', mineTime: 0.2, solid: true, rotatable: true, craftingSpeed: 0.75, energyUsage: 150_000, drain: 5_000,
    categories: ['crafting', 'advanced-crafting', 'crafting-with-fluid'],
    // Ein Flüssigkeitsbehälter mit Anschluss oben und unten in der Mitte (durchgängig)
    fluidBoxes: [{ type: 'input', volume: 1000, ports: [[1, 0, 0], [1, 2, 2]] }],
  },
  {
    kind: 'pipe-ground', id: 'pipe-to-ground', name: 'Rohr unterirdisch', width: 1, height: 1, health: 150,
    item: 'pipe-to-ground', mineTime: 0.1, solid: true, rotatable: true, capacity: 100, maxDistance: 10,
  },
  {
    kind: 'pump', id: 'pump', name: 'Pumpe', width: 1, height: 2, health: 180,
    item: 'pump', mineTime: 0.2, solid: true, rotatable: true, energyUsage: 30_000, pumpingSpeed: 20, capacity: 400,
  },
  {
    kind: 'tank', id: 'storage-tank', name: 'Lagertank', width: 3, height: 3, health: 500,
    item: 'storage-tank', mineTime: 0.5, solid: true, rotatable: true, capacity: 25_000,
  },
  {
    kind: 'pumpjack', id: 'pumpjack', name: 'Pumpjack', width: 3, height: 3, health: 200,
    item: 'pumpjack', mineTime: 0.5, solid: true, rotatable: true, energyUsage: 90_000, miningSpeed: 1, capacity: 1000,
  },
  {
    kind: 'assembler', id: 'oil-refinery', name: 'Ölraffinerie', width: 5, height: 5, health: 350,
    item: 'oil-refinery', mineTime: 0.2, solid: true, rotatable: true, craftingSpeed: 1, energyUsage: 420_000, drain: 14_000,
    categories: ['oil-processing'],
    fluidBoxes: [
      { type: 'input', volume: 1000, ports: [[1, 4, 2]] },
      { type: 'input', volume: 1000, ports: [[3, 4, 2]] },
      { type: 'output', volume: 1000, ports: [[0, 0, 0]] },
      { type: 'output', volume: 1000, ports: [[2, 0, 0]] },
      { type: 'output', volume: 1000, ports: [[4, 0, 0]] },
    ],
  },
  {
    kind: 'assembler', id: 'chemical-plant', name: 'Chemiefabrik', width: 3, height: 3, health: 300,
    item: 'chemical-plant', mineTime: 0.1, solid: true, rotatable: true, craftingSpeed: 1, energyUsage: 210_000, drain: 7_000,
    categories: ['chemistry'],
    fluidBoxes: [
      { type: 'input', volume: 1000, ports: [[0, 2, 2]] },
      { type: 'input', volume: 1000, ports: [[2, 2, 2]] },
      { type: 'output', volume: 1000, ports: [[0, 0, 0]] },
      { type: 'output', volume: 1000, ports: [[2, 0, 0]] },
    ],
  },
  {
    kind: 'furnace', id: 'electric-furnace', name: 'Elektrischer Ofen', width: 3, height: 3, health: 350,
    item: 'electric-furnace', mineTime: 0.2, solid: true, rotatable: false, craftingSpeed: 2, energyUsage: 180_000, fuelSlots: 0,
    energy: 'electric', drain: 6_000,
  },
  {
    kind: 'pole', id: 'substation', name: 'Umspannwerk', width: 2, height: 2, health: 200,
    item: 'substation', mineTime: 0.1, solid: true, rotatable: false, wireReach: 18, supplyRadius: 9,
  },
  {
    kind: 'belt', id: 'express-transport-belt', name: 'Express-Förderband', width: 1, height: 1, health: 170,
    item: 'express-transport-belt', mineTime: 0.1, solid: false, rotatable: true, speed: 24,
  },
  {
    kind: 'underground', id: 'express-underground-belt', name: 'Express-Untergrundband', width: 1, height: 1, health: 170,
    item: 'express-underground-belt', mineTime: 0.1, solid: false, rotatable: true, speed: 24, maxDistance: 9,
  },
  {
    kind: 'splitter', id: 'express-splitter', name: 'Express-Splitter', width: 2, height: 1, health: 190,
    item: 'express-splitter', mineTime: 0.1, solid: false, rotatable: true, speed: 24,
  },
  {
    kind: 'container', id: 'wooden-chest', name: 'Holzkiste', width: 1, height: 1, health: 100,
    item: 'wooden-chest', mineTime: 0.1, solid: true, rotatable: false, slots: 16,
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

/**
 * Füllgrenze für Greifarme (Wiki „Inserters“, Insertion limits): Zutaten für 1 Vorgang plus die Vorgänge,
 * die während einer Greifarm-Drehung (1,166 s) fertig werden (aufgerundet), mindestens 2, höchstens 100.
 * Gilt für Montagemaschinen, Öfen und (mit Forschungseinheiten) Labore.
 */
export const INSERTION_LIMIT = { swingSeconds: 1.166, minCrafts: 2, maxCrafts: 100 } as const;

/** Anzahl Vorgänge, bis zu der Greifarme Zutaten nachfüllen (Vorgangsdauer in Sekunden). */
export function insertionLimitCrafts(craftSeconds: number): number {
  const L = INSERTION_LIMIT;
  return Math.max(L.minCrafts, Math.min(L.maxCrafts, 1 + Math.ceil(L.swingSeconds / craftSeconds - 1e-9)));
}
