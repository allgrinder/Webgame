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
  { id: 'stone', name: 'Stein', stackSize: 50, order: 12 },
  { id: 'iron-plate', name: 'Eisenplatte', stackSize: 100, order: 20 },
  { id: 'iron-gear-wheel', name: 'Zahnrad', stackSize: 100, order: 21 },
  { id: 'copper-ore', name: 'Kupfererz', stackSize: 50, order: 13 },
  { id: 'copper-plate', name: 'Kupferplatte', stackSize: 100, order: 22 },
  { id: 'copper-cable', name: 'Kupferkabel', stackSize: 200, order: 23 },
  { id: 'iron-stick', name: 'Eisenstange', stackSize: 100, order: 24 },
  { id: 'stone-brick', name: 'Steinziegel', stackSize: 100, order: 25 },
  { id: 'transport-belt', name: 'Förderband', stackSize: 100, placeResult: 'transport-belt', order: 30 },
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
