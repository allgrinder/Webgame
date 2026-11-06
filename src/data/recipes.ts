/**
 * Rezepte. category bestimmt, wo das Rezept hergestellt wird:
 *  - 'crafting': Handwerk (später Montagemaschinen)
 *  - 'smelting': Öfen (Rezept wird über die Zutat gewählt)
 */
/**
 * advanced-crafting: nur in Montagemaschinen (z. B. Motor), nicht per Hand.
 * crafting-with-fluid: Montagemaschine 2/3 mit Flüssigkeit (z. B. Schmiermittel), oil-processing: Raffinerie,
 * chemistry: Chemiefabrik. Flüssigkeiten in Zutaten/Ergebnissen erkennt man an FLUIDS (src/data/fluids.ts).
 */
export type RecipeCategory = 'rocket-building' | 'crafting' | 'advanced-crafting' | 'crafting-with-fluid' | 'oil-processing' | 'chemistry' | 'smelting';

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
  {
    id: 'fast-transport-belt', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-gear-wheel', amount: 5 }, { item: 'transport-belt', amount: 1 }],
    results: [{ item: 'fast-transport-belt', amount: 1 }],
  },
  {
    id: 'underground-belt', category: 'crafting', time: 1,
    ingredients: [{ item: 'iron-plate', amount: 10 }, { item: 'transport-belt', amount: 5 }],
    results: [{ item: 'underground-belt', amount: 2 }],
  },
  {
    id: 'splitter', category: 'crafting', time: 1,
    ingredients: [{ item: 'electronic-circuit', amount: 5 }, { item: 'iron-plate', amount: 5 }, { item: 'transport-belt', amount: 4 }],
    results: [{ item: 'splitter', amount: 1 }],
  },
  {
    id: 'fast-underground-belt', category: 'crafting', time: 2,
    ingredients: [{ item: 'iron-gear-wheel', amount: 40 }, { item: 'underground-belt', amount: 2 }],
    results: [{ item: 'fast-underground-belt', amount: 2 }],
  },
  {
    id: 'fast-splitter', category: 'crafting', time: 2,
    ingredients: [{ item: 'electronic-circuit', amount: 10 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'splitter', amount: 1 }],
    results: [{ item: 'fast-splitter', amount: 1 }],
  },
  { id: 'steel-plate', category: 'smelting', time: 16, ingredients: [{ item: 'iron-plate', amount: 5 }], results: [{ item: 'steel-plate', amount: 1 }] },
  { id: 'steel-chest', category: 'crafting', time: 0.5, ingredients: [{ item: 'steel-plate', amount: 8 }], results: [{ item: 'steel-chest', amount: 1 }] },
  {
    id: 'steel-furnace', category: 'crafting', time: 3,
    ingredients: [{ item: 'steel-plate', amount: 6 }, { item: 'stone-brick', amount: 10 }], results: [{ item: 'steel-furnace', amount: 1 }],
  },
  {
    id: 'fast-inserter', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 2 }, { item: 'inserter', amount: 1 }, { item: 'iron-plate', amount: 2 }],
    results: [{ item: 'fast-inserter', amount: 1 }],
  },
  {
    id: 'medium-electric-pole', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'copper-cable', amount: 2 }, { item: 'iron-stick', amount: 4 }, { item: 'steel-plate', amount: 2 }],
    results: [{ item: 'medium-electric-pole', amount: 1 }],
  },
  {
    id: 'big-electric-pole', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'copper-cable', amount: 4 }, { item: 'iron-stick', amount: 8 }, { item: 'steel-plate', amount: 5 }],
    results: [{ item: 'big-electric-pole', amount: 1 }],
  },
  // Militär (Wiki)
  { id: 'firearm-magazine', category: 'crafting', time: 1, ingredients: [{ item: 'iron-plate', amount: 4 }], results: [{ item: 'firearm-magazine', amount: 1 }] },
  {
    id: 'piercing-rounds-magazine', category: 'crafting', time: 6,
    ingredients: [{ item: 'copper-plate', amount: 2 }, { item: 'firearm-magazine', amount: 2 }, { item: 'steel-plate', amount: 1 }],
    results: [{ item: 'piercing-rounds-magazine', amount: 2 }],
  },
  {
    id: 'pistol', category: 'crafting', time: 5,
    ingredients: [{ item: 'copper-plate', amount: 5 }, { item: 'iron-plate', amount: 5 }], results: [{ item: 'pistol', amount: 1 }],
  },
  {
    id: 'submachine-gun', category: 'crafting', time: 10,
    ingredients: [{ item: 'copper-plate', amount: 5 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'iron-plate', amount: 10 }],
    results: [{ item: 'submachine-gun', amount: 1 }],
  },
  {
    id: 'gun-turret', category: 'crafting', time: 8,
    ingredients: [{ item: 'copper-plate', amount: 10 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'iron-plate', amount: 20 }],
    results: [{ item: 'gun-turret', amount: 1 }],
  },
  {
    id: 'repair-pack', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 2 }, { item: 'iron-gear-wheel', amount: 2 }], results: [{ item: 'repair-pack', amount: 1 }],
  },
  { id: 'stone-wall', category: 'crafting', time: 0.5, ingredients: [{ item: 'stone-brick', amount: 5 }], results: [{ item: 'stone-wall', amount: 1 }] },
  {
    id: 'lamp', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'copper-cable', amount: 3 }, { item: 'electronic-circuit', amount: 1 }, { item: 'iron-plate', amount: 1 }],
    results: [{ item: 'lamp', amount: 1 }],
  },
  {
    id: 'assembling-machine-2', category: 'crafting', time: 0.5,
    ingredients: [
      { item: 'assembling-machine-1', amount: 1 }, { item: 'electronic-circuit', amount: 3 },
      { item: 'iron-gear-wheel', amount: 5 }, { item: 'steel-plate', amount: 2 },
    ],
    results: [{ item: 'assembling-machine-2', amount: 1 }],
  },
  { id: 'landfill', category: 'crafting', time: 0.5, ingredients: [{ item: 'stone', amount: 50 }], results: [{ item: 'landfill', amount: 1 }] },
  {
    id: 'engine-unit', category: 'advanced-crafting', time: 10,
    ingredients: [{ item: 'iron-gear-wheel', amount: 1 }, { item: 'pipe', amount: 2 }, { item: 'steel-plate', amount: 1 }],
    results: [{ item: 'engine-unit', amount: 1 }],
  },
  {
    id: 'pump', category: 'crafting', time: 2,
    ingredients: [{ item: 'engine-unit', amount: 1 }, { item: 'pipe', amount: 1 }, { item: 'steel-plate', amount: 1 }],
    results: [{ item: 'pump', amount: 1 }],
  },
  {
    id: 'storage-tank', category: 'crafting', time: 3,
    ingredients: [{ item: 'iron-plate', amount: 20 }, { item: 'steel-plate', amount: 5 }], results: [{ item: 'storage-tank', amount: 1 }],
  },
  {
    id: 'pipe-to-ground', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-plate', amount: 5 }, { item: 'pipe', amount: 10 }], results: [{ item: 'pipe-to-ground', amount: 2 }],
  },
  { id: 'basic-oil-processing', category: 'oil-processing', time: 5, ingredients: [{ item: 'crude-oil', amount: 100 }], results: [{ item: 'petroleum-gas', amount: 45 }] },
  {
    id: 'advanced-oil-processing', category: 'oil-processing', time: 5,
    ingredients: [{ item: 'crude-oil', amount: 100 }, { item: 'water', amount: 50 }],
    results: [{ item: 'heavy-oil', amount: 25 }, { item: 'light-oil', amount: 45 }, { item: 'petroleum-gas', amount: 55 }],
  },
  { id: 'heavy-oil-cracking', category: 'chemistry', time: 2, ingredients: [{ item: 'heavy-oil', amount: 40 }, { item: 'water', amount: 30 }], results: [{ item: 'light-oil', amount: 30 }] },
  { id: 'light-oil-cracking', category: 'chemistry', time: 2, ingredients: [{ item: 'light-oil', amount: 30 }, { item: 'water', amount: 30 }], results: [{ item: 'petroleum-gas', amount: 20 }] },
  { id: 'plastic-bar', category: 'chemistry', time: 1, ingredients: [{ item: 'coal', amount: 1 }, { item: 'petroleum-gas', amount: 20 }], results: [{ item: 'plastic-bar', amount: 2 }] },
  { id: 'sulfur', category: 'chemistry', time: 1, ingredients: [{ item: 'petroleum-gas', amount: 30 }, { item: 'water', amount: 30 }], results: [{ item: 'sulfur', amount: 2 }] },
  {
    id: 'sulfuric-acid', category: 'chemistry', time: 1,
    ingredients: [{ item: 'iron-plate', amount: 1 }, { item: 'sulfur', amount: 5 }, { item: 'water', amount: 100 }], results: [{ item: 'sulfuric-acid', amount: 50 }],
  },
  {
    id: 'battery', category: 'chemistry', time: 4,
    ingredients: [{ item: 'iron-plate', amount: 1 }, { item: 'copper-plate', amount: 1 }, { item: 'sulfuric-acid', amount: 20 }], results: [{ item: 'battery', amount: 1 }],
  },
  { id: 'lubricant', category: 'chemistry', time: 1, ingredients: [{ item: 'heavy-oil', amount: 10 }], results: [{ item: 'lubricant', amount: 10 }] },
  { id: 'solid-fuel-from-light-oil', category: 'chemistry', time: 1, ingredients: [{ item: 'light-oil', amount: 10 }], results: [{ item: 'solid-fuel', amount: 1 }] },
  { id: 'solid-fuel-from-petroleum-gas', category: 'chemistry', time: 1, ingredients: [{ item: 'petroleum-gas', amount: 20 }], results: [{ item: 'solid-fuel', amount: 1 }] },
  { id: 'solid-fuel-from-heavy-oil', category: 'chemistry', time: 1, ingredients: [{ item: 'heavy-oil', amount: 20 }], results: [{ item: 'solid-fuel', amount: 1 }] },
  {
    id: 'explosives', category: 'chemistry', time: 4,
    ingredients: [{ item: 'coal', amount: 1 }, { item: 'sulfur', amount: 1 }, { item: 'water', amount: 10 }], results: [{ item: 'explosives', amount: 2 }],
  },
  {
    id: 'advanced-circuit', category: 'crafting', time: 6,
    ingredients: [{ item: 'copper-cable', amount: 4 }, { item: 'electronic-circuit', amount: 2 }, { item: 'plastic-bar', amount: 2 }],
    results: [{ item: 'advanced-circuit', amount: 1 }],
  },
  {
    id: 'electric-engine-unit', category: 'crafting-with-fluid', time: 10,
    ingredients: [{ item: 'electronic-circuit', amount: 2 }, { item: 'engine-unit', amount: 1 }, { item: 'lubricant', amount: 15 }],
    results: [{ item: 'electric-engine-unit', amount: 1 }],
  },
  {
    id: 'chemical-science-pack', category: 'crafting', time: 24,
    ingredients: [{ item: 'advanced-circuit', amount: 3 }, { item: 'engine-unit', amount: 2 }, { item: 'sulfur', amount: 1 }],
    results: [{ item: 'chemical-science-pack', amount: 2 }],
  },
  {
    id: 'pumpjack', category: 'crafting', time: 5,
    ingredients: [{ item: 'electronic-circuit', amount: 5 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'pipe', amount: 10 }, { item: 'steel-plate', amount: 5 }],
    results: [{ item: 'pumpjack', amount: 1 }],
  },
  {
    id: 'oil-refinery', category: 'crafting', time: 8,
    ingredients: [
      { item: 'electronic-circuit', amount: 10 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'pipe', amount: 10 },
      { item: 'steel-plate', amount: 15 }, { item: 'stone-brick', amount: 10 },
    ],
    results: [{ item: 'oil-refinery', amount: 1 }],
  },
  {
    id: 'chemical-plant', category: 'crafting', time: 5,
    ingredients: [{ item: 'electronic-circuit', amount: 5 }, { item: 'iron-gear-wheel', amount: 5 }, { item: 'pipe', amount: 5 }, { item: 'steel-plate', amount: 5 }],
    results: [{ item: 'chemical-plant', amount: 1 }],
  },
  {
    id: 'electric-furnace', category: 'crafting', time: 5,
    ingredients: [{ item: 'advanced-circuit', amount: 5 }, { item: 'steel-plate', amount: 10 }, { item: 'stone-brick', amount: 10 }],
    results: [{ item: 'electric-furnace', amount: 1 }],
  },
  {
    id: 'solar-panel', category: 'crafting', time: 10,
    ingredients: [{ item: 'copper-plate', amount: 5 }, { item: 'electronic-circuit', amount: 15 }, { item: 'steel-plate', amount: 5 }],
    results: [{ item: 'solar-panel', amount: 1 }],
  },
  {
    id: 'accumulator', category: 'crafting', time: 10,
    ingredients: [{ item: 'battery', amount: 5 }, { item: 'iron-plate', amount: 2 }], results: [{ item: 'accumulator', amount: 1 }],
  },
  {
    id: 'substation', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'advanced-circuit', amount: 5 }, { item: 'copper-cable', amount: 6 }, { item: 'steel-plate', amount: 10 }],
    results: [{ item: 'substation', amount: 1 }],
  },
  {
    id: 'express-transport-belt', category: 'crafting-with-fluid', time: 0.5,
    ingredients: [{ item: 'fast-transport-belt', amount: 1 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'lubricant', amount: 20 }],
    results: [{ item: 'express-transport-belt', amount: 1 }],
  },
  {
    id: 'express-underground-belt', category: 'crafting-with-fluid', time: 2,
    ingredients: [{ item: 'fast-underground-belt', amount: 2 }, { item: 'iron-gear-wheel', amount: 80 }, { item: 'lubricant', amount: 40 }],
    results: [{ item: 'express-underground-belt', amount: 2 }],
  },
  {
    id: 'express-splitter', category: 'crafting-with-fluid', time: 2,
    ingredients: [
      { item: 'advanced-circuit', amount: 10 }, { item: 'fast-splitter', amount: 1 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'lubricant', amount: 80 },
    ],
    results: [{ item: 'express-splitter', amount: 1 }],
  },
  { id: 'wooden-chest', category: 'crafting', time: 0.5, ingredients: [{ item: 'wood', amount: 2 }], results: [{ item: 'wooden-chest', amount: 1 }] },
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
  { id: 'small-electric-pole', category: 'crafting', time: 0.5, ingredients: [{ item: 'copper-cable', amount: 2 }, { item: 'wood', amount: 1 }], results: [{ item: 'small-electric-pole', amount: 2 }] },
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
  {
    id: 'assembling-machine-1', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 3 }, { item: 'iron-gear-wheel', amount: 5 }, { item: 'iron-plate', amount: 9 }],
    results: [{ item: 'assembling-machine-1', amount: 1 }],
  },
  {
    id: 'lab', category: 'crafting', time: 2,
    ingredients: [{ item: 'electronic-circuit', amount: 10 }, { item: 'iron-gear-wheel', amount: 10 }, { item: 'transport-belt', amount: 4 }],
    results: [{ item: 'lab', amount: 1 }],
  },
  {
    id: 'automation-science-pack', category: 'crafting', time: 5,
    ingredients: [{ item: 'copper-plate', amount: 1 }, { item: 'iron-gear-wheel', amount: 1 }],
    results: [{ item: 'automation-science-pack', amount: 1 }],
  },
  {
    id: 'logistic-science-pack', category: 'crafting', time: 6,
    ingredients: [{ item: 'inserter', amount: 1 }, { item: 'transport-belt', amount: 1 }],
    results: [{ item: 'logistic-science-pack', amount: 1 }],
  },
  { id: 'iron-chest', category: 'crafting', time: 0.5, ingredients: [{ item: 'iron-plate', amount: 8 }], results: [{ item: 'iron-chest', amount: 1 }] },
  // Spätes Spiel (Wiki-Rezepte 2.0)
  ...(['speed', 'productivity', 'efficiency'] as const).flatMap((k) => [
    {
      id: `${k}-module`, category: 'crafting' as const, time: 15,
      ingredients: [{ item: 'advanced-circuit', amount: 5 }, { item: 'electronic-circuit', amount: 5 }], results: [{ item: `${k}-module`, amount: 1 }],
    },
    {
      id: `${k}-module-2`, category: 'crafting' as const, time: 30,
      ingredients: [{ item: 'advanced-circuit', amount: 5 }, { item: 'processing-unit', amount: 5 }, { item: `${k}-module`, amount: 4 }],
      results: [{ item: `${k}-module-2`, amount: 1 }],
    },
    {
      id: `${k}-module-3`, category: 'crafting' as const, time: 60,
      ingredients: [{ item: 'advanced-circuit', amount: 5 }, { item: 'processing-unit', amount: 5 }, { item: `${k}-module-2`, amount: 4 }],
      results: [{ item: `${k}-module-3`, amount: 1 }],
    },
  ]),
  {
    id: 'beacon', category: 'crafting', time: 15,
    ingredients: [{ item: 'advanced-circuit', amount: 20 }, { item: 'copper-cable', amount: 10 }, { item: 'electronic-circuit', amount: 20 }, { item: 'steel-plate', amount: 10 }],
    results: [{ item: 'beacon', amount: 1 }],
  },
  {
    id: 'assembling-machine-3', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'assembling-machine-2', amount: 2 }, { item: 'speed-module', amount: 4 }], results: [{ item: 'assembling-machine-3', amount: 1 }],
  },
  {
    id: 'processing-unit', category: 'crafting-with-fluid', time: 10,
    ingredients: [{ item: 'electronic-circuit', amount: 20 }, { item: 'advanced-circuit', amount: 2 }, { item: 'sulfuric-acid', amount: 5 }],
    results: [{ item: 'processing-unit', amount: 1 }],
  },
  {
    id: 'low-density-structure', category: 'crafting', time: 15,
    ingredients: [{ item: 'copper-plate', amount: 20 }, { item: 'steel-plate', amount: 2 }, { item: 'plastic-bar', amount: 5 }],
    results: [{ item: 'low-density-structure', amount: 1 }],
  },
  {
    id: 'rocket-fuel', category: 'crafting-with-fluid', time: 15,
    ingredients: [{ item: 'light-oil', amount: 10 }, { item: 'solid-fuel', amount: 10 }], results: [{ item: 'rocket-fuel', amount: 1 }],
  },
  {
    id: 'flying-robot-frame', category: 'crafting', time: 20,
    ingredients: [{ item: 'battery', amount: 2 }, { item: 'electric-engine-unit', amount: 1 }, { item: 'electronic-circuit', amount: 3 }, { item: 'steel-plate', amount: 1 }],
    results: [{ item: 'flying-robot-frame', amount: 1 }],
  },
  {
    id: 'production-science-pack', category: 'crafting', time: 21,
    ingredients: [{ item: 'electric-furnace', amount: 1 }, { item: 'productivity-module', amount: 1 }, { item: 'rail', amount: 30 }],
    results: [{ item: 'production-science-pack', amount: 3 }],
  },
  {
    id: 'utility-science-pack', category: 'crafting', time: 21,
    ingredients: [{ item: 'flying-robot-frame', amount: 1 }, { item: 'low-density-structure', amount: 3 }, { item: 'processing-unit', amount: 2 }],
    results: [{ item: 'utility-science-pack', amount: 3 }],
  },
  {
    id: 'concrete', category: 'crafting-with-fluid', time: 10,
    ingredients: [{ item: 'iron-ore', amount: 1 }, { item: 'stone-brick', amount: 5 }, { item: 'water', amount: 100 }], results: [{ item: 'concrete', amount: 10 }],
  },
  {
    id: 'roboport', category: 'crafting', time: 5,
    ingredients: [{ item: 'advanced-circuit', amount: 45 }, { item: 'iron-gear-wheel', amount: 45 }, { item: 'steel-plate', amount: 45 }],
    results: [{ item: 'roboport', amount: 1 }],
  },
  {
    id: 'construction-robot', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 2 }, { item: 'flying-robot-frame', amount: 1 }], results: [{ item: 'construction-robot', amount: 1 }],
  },
  {
    id: 'logistic-robot', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'advanced-circuit', amount: 2 }, { item: 'flying-robot-frame', amount: 1 }], results: [{ item: 'logistic-robot', amount: 1 }],
  },
  ...['passive-provider-chest', 'active-provider-chest', 'storage-chest', 'requester-chest', 'buffer-chest'].map((id) => ({
    id, category: 'crafting' as const, time: 0.5,
    ingredients: [{ item: 'advanced-circuit', amount: 1 }, { item: 'electronic-circuit', amount: 3 }, { item: 'steel-chest', amount: 1 }],
    results: [{ item: id, amount: 1 }],
  })),
  {
    id: 'rocket-silo', category: 'crafting', time: 30,
    ingredients: [
      { item: 'concrete', amount: 1000 }, { item: 'electric-engine-unit', amount: 200 }, { item: 'pipe', amount: 100 },
      { item: 'processing-unit', amount: 200 }, { item: 'steel-plate', amount: 1000 },
    ],
    results: [{ item: 'rocket-silo', amount: 1 }],
  },
  {
    id: 'rocket-part', category: 'rocket-building', time: 3,
    ingredients: [{ item: 'low-density-structure', amount: 10 }, { item: 'processing-unit', amount: 10 }, { item: 'rocket-fuel', amount: 10 }],
    results: [{ item: 'rocket-part', amount: 1 }],
  },
  {
    id: 'satellite', category: 'crafting', time: 5,
    ingredients: [
      { item: 'accumulator', amount: 100 }, { item: 'low-density-structure', amount: 100 }, { item: 'processing-unit', amount: 100 },
      { item: 'radar', amount: 5 }, { item: 'rocket-fuel', amount: 50 }, { item: 'solar-panel', amount: 100 },
    ],
    results: [{ item: 'satellite', amount: 1 }],
  },
  {
    id: 'cargo-landing-pad', category: 'crafting', time: 30,
    ingredients: [{ item: 'concrete', amount: 200 }, { item: 'processing-unit', amount: 10 }, { item: 'steel-plate', amount: 25 }],
    results: [{ item: 'cargo-landing-pad', amount: 1 }],
  },
  {
    id: 'radar', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 5 }, { item: 'iron-gear-wheel', amount: 5 }, { item: 'iron-plate', amount: 10 }],
    results: [{ item: 'radar', amount: 1 }],
  },
  {
    id: 'constant-combinator', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'copper-cable', amount: 5 }, { item: 'electronic-circuit', amount: 2 }], results: [{ item: 'constant-combinator', amount: 1 }],
  },
  ...['arithmetic-combinator', 'decider-combinator'].map((id) => ({
    id, category: 'crafting' as const, time: 0.5,
    ingredients: [{ item: 'copper-cable', amount: 5 }, { item: 'electronic-circuit', amount: 5 }], results: [{ item: id, amount: 1 }],
  })),
  {
    id: 'locomotive', category: 'crafting', time: 4,
    ingredients: [{ item: 'electronic-circuit', amount: 10 }, { item: 'engine-unit', amount: 20 }, { item: 'steel-plate', amount: 30 }],
    results: [{ item: 'locomotive', amount: 1 }],
  },
  {
    id: 'cargo-wagon', category: 'crafting', time: 1,
    ingredients: [{ item: 'iron-gear-wheel', amount: 10 }, { item: 'iron-plate', amount: 20 }, { item: 'steel-plate', amount: 20 }],
    results: [{ item: 'cargo-wagon', amount: 1 }],
  },
  {
    id: 'train-stop', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'electronic-circuit', amount: 5 }, { item: 'iron-plate', amount: 6 }, { item: 'iron-stick', amount: 6 }, { item: 'steel-plate', amount: 3 }],
    results: [{ item: 'train-stop', amount: 1 }],
  },
  {
    id: 'rail', category: 'crafting', time: 0.5,
    ingredients: [{ item: 'iron-stick', amount: 1 }, { item: 'steel-plate', amount: 1 }, { item: 'stone', amount: 1 }], results: [{ item: 'rail', amount: 2 }],
  },
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
