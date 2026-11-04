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
  { id: 'transport-belt', name: 'Förderband', stackSize: 100, placeResult: 'transport-belt', order: 30 },
  { id: 'burner-inserter', name: 'Brennstoff-Greifarm', stackSize: 50, placeResult: 'burner-inserter', order: 31 },
  { id: 'burner-mining-drill', name: 'Brennstoff-Bohrer', stackSize: 50, placeResult: 'burner-mining-drill', order: 32 },
  { id: 'stone-furnace', name: 'Steinofen', stackSize: 50, placeResult: 'stone-furnace', order: 33 },
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
