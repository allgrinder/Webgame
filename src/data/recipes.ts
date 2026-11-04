/**
 * Rezepte. category bestimmt, wo das Rezept hergestellt wird:
 *  - 'crafting': Handwerk (später Montagemaschinen)
 *  - 'smelting': Öfen (Rezept wird über die Zutat gewählt)
 */
export type RecipeCategory = 'crafting' | 'smelting';

export interface ItemAmount {
  readonly item: string;
  readonly amount: number;
}

export interface RecipeDef {
  readonly id: string;
  readonly category: RecipeCategory;
  /** Herstellungszeit in Sekunden bei Geschwindigkeit 1. */
  readonly time: number;
  readonly ingredients: readonly ItemAmount[];
  readonly results: readonly ItemAmount[];
}

const list: RecipeDef[] = [
  { id: 'iron-plate', category: 'smelting', time: 3.2, ingredients: [{ item: 'iron-ore', amount: 1 }], results: [{ item: 'iron-plate', amount: 1 }] },
  { id: 'copper-plate', category: 'smelting', time: 3.2, ingredients: [{ item: 'copper-ore', amount: 1 }], results: [{ item: 'copper-plate', amount: 1 }] },
  { id: 'stone-brick', category: 'smelting', time: 3.2, ingredients: [{ item: 'stone', amount: 2 }], results: [{ item: 'stone-brick', amount: 1 }] },
  { id: 'copper-cable', category: 'crafting', time: 0.5, ingredients: [{ item: 'copper-plate', amount: 1 }], results: [{ item: 'copper-cable', amount: 2 }] },
  { id: 'iron-stick', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-plate', amount: 1 }], results: [{ item: 'iron-stick', amount: 2 }] },
  { id: 'stone-furnace', category: 'crafting', time: 0.5, ingredients: [{ item: 'stone', amount: 5 }], results: [{ item: 'stone-furnace', amount: 1 }] },
  { id: 'iron-gear-wheel', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-plate', amount: 2 }], results: [{ item: 'iron-gear-wheel', amount: 1 }] },
  {
    id: 'burner-inserter', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-gear-wheel', amount: 1 }, { item: 'iron-plate', amount: 1 }],
    results: [{ item: 'burner-inserter', amount: 1 }],
  },
  {
    id: 'burner-mining-drill', category: 'crafting', time: 2,
    ingredients: [{ item: 'iron-gear-wheel', amount: 3 }, { item: 'iron-plate', amount: 3 }, { item: 'stone-furnace', amount: 1 }],
    results: [{ item: 'burner-mining-drill', amount: 1 }],
  },
  {
    id: 'transport-belt', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-gear-wheel', amount: 1 }, { item: 'iron-plate', amount: 1 }],
    results: [{ item: 'transport-belt', amount: 2 }],
  },
  { id: 'electronic-circuit', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-plate', amount: 1 }, { item: 'copper-cable', amount: 3 }], results: [{ item: 'electronic-circuit', amount: 1 }] },
  { id: 'pipe', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-plate', amount: 1 }], results: [{ item: 'pipe', amount: 1 }] },
  { id: 'offshore-pump', category: 'crafting', time: 0.5, ingredients: [{ item: 'pipe', amount: 3 }, { item: 'iron-gear-wheel', amount: 2 }], results: [{ item: 'offshore-pump', amount: 1 }] },
  { id: 'boiler', category: 'crafting', time: 0.5, ingredients: [{ item: 'stone-furnace', amount: 1 }, { item: 'pipe', amount: 4 }], results: [{ item: 'boiler', amount: 1 }] },
  {
    id: 'steam-engine', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-gear-wheel', amount: 8 }, { item: 'pipe', amount: 5 }, { item: 'iron-plate', amount: 10 }],
    results: [{ item: 'steam-engine', amount: 1 }],
  },
  // eigene Abweichung: Eisenstange statt Holz (es gibt kein Holz im Spiel)
  { id: 'small-electric-pole', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-stick', amount: 1 }, { item: 'copper-cable', amount: 2 }], results: [{ item: 'small-electric-pole', amount: 2 }] },
  {
    id: 'electric-mining-drill', category: 'crafting', time: 2,
    ingredients: [{ item: 'electronic-circuit', amount: 3 }, { item: 'iron-gear-wheel', amount: 5 }, { item: 'iron-plate', amount: 10 }],
    results: [{ item: 'electric-mining-drill', amount: 1 }],
  },
  {
    id: 'inserter', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 1 }, { item: 'iron-gear-wheel', amount: 1 }, { item: 'iron-plate', amount: 1 }],
    results: [{ item: 'inserter', amount: 1 }],
  },
  {
    id: 'long-handed-inserter', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-gear-wheel', amount: 1 }, { item: 'iron-plate', amount: 1 }, { item: 'inserter', amount: 1 }],
    results: [{ item: 'long-handed-inserter', amount: 1 }],
  },
  { id: 'iron-chest', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-plate', amount: 8 }], results: [{ item: 'iron-chest', amount: 1 }] },
];

export const RECIPES: Readonly<Record<string, RecipeDef>> = Object.freeze(Object.fromEntries(list.map((r) => [r.id, r])));
export const RECIPE_LIST: readonly RecipeDef[] = list;

export function recipe(id: string): RecipeDef {
  const r = RECIPES[id];
  if (!r) throw new Error(`Unbekanntes Rezept: ${id}`);
  return r;
}

/** Schmelzrezept zu einer Zutat (z. B. Eisenerz -> Eisenplatte). */
export function smeltingRecipeFor(itemId: string): RecipeDef | undefined {
  return list.find((r) => r.category === 'smelting' && r.ingredients[0]?.item === itemId);
}

/** Rezept, das ein Item per Hand herstellt. */
export function craftingRecipeFor(itemId: string): RecipeDef | undefined {
  return list.find((r) => r.category === 'crafting' && r.results.some((x) => x.item === itemId));
}
