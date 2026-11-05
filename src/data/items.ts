import { MJ } from './time';

/**
 * Item-Definitionen. Neue Items: hier eintragen, Symbol in assets/blender/models/items.py ergänzen.
 * Quellen: docs/GAME_DATA.md
 */
export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly stackSize: number;
  /** Brennwert in Joule (nur Brennstoffe). */
  readonly fuelValue?: number;
  /** Gebäude, das dieses Item platziert. */
  readonly placeResult?: string;
  /** Sortierreihenfolge im Inventar. */
  readonly order: number;
}

const list: ItemDef[] = [
  { id: 'iron-ore', name: 'Eisenerz', stackSize: 50, order: 10 },
  { id: 'coal', name: 'Kohle', stackSize: 50, fuelValue: 4 * MJ, order: 11 },
  { id: 'wood', name: 'Holz', stackSize: 100, fuelValue: 2 * MJ, order: 9 },
  { id: 'wooden-chest', name: 'Holzkiste', stackSize: 50, placeResult: 'wooden-chest', order: 33 },
  { id: 'stone', name: 'Stein', stackSize: 50, order: 12 },
  { id: 'iron-plate', name: 'Eisenplatte', stackSize: 100, order: 20 },
  { id: 'iron-gear-wheel', name: 'Zahnrad', stackSize: 100, order: 21 },
  { id: 'copper-ore', name: 'Kupfererz', stackSize: 50, order: 13 },
  { id: 'copper-plate', name: 'Kupferplatte', stackSize: 100, order: 22 },
  { id: 'copper-cable', name: 'Kupferkabel', stackSize: 200, order: 23 },
  { id: 'iron-stick', name: 'Eisenstange', stackSize: 100, order: 24 },
  { id: 'stone-brick', name: 'Steinziegel', stackSize: 100, order: 25 },
  { id: 'transport-belt', name: 'Förderband', stackSize: 100, placeResult: 'transport-belt', order: 30 },
  { id: 'fast-transport-belt', name: 'Schnelles Förderband', stackSize: 100, placeResult: 'fast-transport-belt', order: 35 },
  { id: 'underground-belt', name: 'Untergrundband', stackSize: 50, placeResult: 'underground-belt', order: 36 },
  { id: 'splitter', name: 'Splitter', stackSize: 50, placeResult: 'splitter', order: 37 },
  { id: 'fast-underground-belt', name: 'Schnelles Untergrundband', stackSize: 50, placeResult: 'fast-underground-belt', order: 38 },
  { id: 'fast-splitter', name: 'Schneller Splitter', stackSize: 50, placeResult: 'fast-splitter', order: 39 },
  { id: 'burner-inserter', name: 'Brennstoff-Greifarm', stackSize: 50, placeResult: 'burner-inserter', order: 31 },
  { id: 'burner-mining-drill', name: 'Brennstoff-Bohrer', stackSize: 50, placeResult: 'burner-mining-drill', order: 32 },
  { id: 'stone-furnace', name: 'Steinofen', stackSize: 50, placeResult: 'stone-furnace', order: 33 },
  { id: 'iron-chest', name: 'Eisenkiste', stackSize: 50, placeResult: 'iron-chest', order: 34 },
  { id: 'electronic-circuit', name: 'Elektronischer Schaltkreis', stackSize: 200, order: 26 },
  { id: 'pipe', name: 'Rohr', stackSize: 100, placeResult: 'pipe', order: 40 },
  { id: 'offshore-pump', name: 'Uferpumpe', stackSize: 20, placeResult: 'offshore-pump', order: 41 },
  { id: 'boiler', name: 'Kessel', stackSize: 50, placeResult: 'boiler', order: 42 },
  { id: 'steam-engine', name: 'Dampfmaschine', stackSize: 10, placeResult: 'steam-engine', order: 43 },
  { id: 'small-electric-pole', name: 'Kleiner Strommast', stackSize: 50, placeResult: 'small-electric-pole', order: 44 },
  { id: 'electric-mining-drill', name: 'Elektrischer Bohrer', stackSize: 50, placeResult: 'electric-mining-drill', order: 45 },
  { id: 'inserter', name: 'Greifarm', stackSize: 50, placeResult: 'inserter', order: 46 },
  { id: 'assembling-machine-1', name: 'Montagemaschine', stackSize: 50, placeResult: 'assembling-machine-1', order: 48 },
  { id: 'lab', name: 'Labor', stackSize: 10, placeResult: 'lab', order: 49 },
  { id: 'automation-science-pack', name: 'Automatisierungs-Wissenschaftspaket', stackSize: 200, order: 60 },
  { id: 'logistic-science-pack', name: 'Logistik-Wissenschaftspaket', stackSize: 200, order: 61 },
  { id: 'steel-plate', name: 'Stahlplatte', stackSize: 100, order: 27 },
  { id: 'engine-unit', name: 'Motor', stackSize: 50, order: 28 },
  { id: 'landfill', name: 'Landaufschüttung', stackSize: 100, order: 70 },
  { id: 'steel-chest', name: 'Stahlkiste', stackSize: 50, placeResult: 'steel-chest', order: 35 },
  { id: 'steel-furnace', name: 'Stahlofen', stackSize: 50, placeResult: 'steel-furnace', order: 36 },
  { id: 'fast-inserter', name: 'Schneller Greifarm', stackSize: 50, placeResult: 'fast-inserter', order: 47 },
  { id: 'medium-electric-pole', name: 'Mittlerer Strommast', stackSize: 50, placeResult: 'medium-electric-pole', order: 44 },
  { id: 'big-electric-pole', name: 'Großer Strommast', stackSize: 50, placeResult: 'big-electric-pole', order: 44 },
  { id: 'lamp', name: 'Lampe', stackSize: 50, placeResult: 'lamp', order: 50 },
  { id: 'assembling-machine-2', name: 'Montagemaschine 2', stackSize: 50, placeResult: 'assembling-machine-2', order: 48 },
  { id: 'pipe-to-ground', name: 'Rohr unterirdisch', stackSize: 50, placeResult: 'pipe-to-ground', order: 40 },
  { id: 'pump', name: 'Pumpe', stackSize: 50, placeResult: 'pump', order: 41 },
  { id: 'storage-tank', name: 'Lagertank', stackSize: 50, placeResult: 'storage-tank', order: 41 },
  { id: 'plastic-bar', name: 'Kunststoff', stackSize: 100, order: 80 },
  { id: 'sulfur', name: 'Schwefel', stackSize: 50, order: 81 },
  { id: 'battery', name: 'Batterie', stackSize: 200, order: 82 },
  { id: 'solid-fuel', name: 'Festbrennstoff', stackSize: 50, fuelValue: 12 * MJ, order: 83 },
  { id: 'explosives', name: 'Sprengstoff', stackSize: 50, order: 84 },
  { id: 'advanced-circuit', name: 'Fortgeschrittener Schaltkreis', stackSize: 200, order: 85 },
  { id: 'electric-engine-unit', name: 'Elektromotor', stackSize: 50, order: 86 },
  { id: 'chemical-science-pack', name: 'Chemie-Wissenschaftspaket', stackSize: 200, order: 62 },
  { id: 'pumpjack', name: 'Pumpjack', stackSize: 20, placeResult: 'pumpjack', order: 90 },
  { id: 'oil-refinery', name: 'Ölraffinerie', stackSize: 10, placeResult: 'oil-refinery', order: 91 },
  { id: 'chemical-plant', name: 'Chemiefabrik', stackSize: 10, placeResult: 'chemical-plant', order: 92 },
  { id: 'electric-furnace', name: 'Elektrischer Ofen', stackSize: 50, placeResult: 'electric-furnace', order: 36 },
  { id: 'substation', name: 'Umspannwerk', stackSize: 50, placeResult: 'substation', order: 44 },
  { id: 'express-transport-belt', name: 'Express-Förderband', stackSize: 100, placeResult: 'express-transport-belt', order: 39 },
  { id: 'express-underground-belt', name: 'Express-Untergrundband', stackSize: 50, placeResult: 'express-underground-belt', order: 39 },
  { id: 'express-splitter', name: 'Express-Splitter', stackSize: 50, placeResult: 'express-splitter', order: 39 },
  { id: 'long-handed-inserter', name: 'Langer Greifarm', stackSize: 50, placeResult: 'long-handed-inserter', order: 47 },
];

export const ITEMS: Readonly<Record<string, ItemDef>> = Object.freeze(
  Object.fromEntries(list.map((i) => [i.id, i])),
);

export const ITEM_IDS: readonly string[] = list.map((i) => i.id);

export function item(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unbekanntes Item: ${id}`);
  return def;
}

export function isFuel(id: string): boolean {
  return (ITEMS[id]?.fuelValue ?? 0) > 0;
}
