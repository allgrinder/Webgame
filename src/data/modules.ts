/**
 * Module und Leuchtfeuer. Quellen: Wiki „Module“, „Speed module“ ff., „Beacon“ (Infoboxen und Text).
 * Wirkungen addieren sich; Geschwindigkeit, Verbrauch (und Verschmutzung) fallen nie unter 20 % des Grundwerts.
 */
export type ModuleCategory = 'speed' | 'productivity' | 'efficiency';

export interface ModuleDef {
  readonly id: string;
  readonly category: ModuleCategory;
  readonly tier: number;
  /** Anteile, z. B. 0.2 = +20 %. */
  readonly speed: number;
  readonly productivity: number;
  readonly consumption: number;
  readonly pollution: number;
}

const list: ModuleDef[] = [
  { id: 'speed-module', category: 'speed', tier: 1, speed: 0.2, productivity: 0, consumption: 0.5, pollution: 0 },
  { id: 'speed-module-2', category: 'speed', tier: 2, speed: 0.3, productivity: 0, consumption: 0.6, pollution: 0 },
  { id: 'speed-module-3', category: 'speed', tier: 3, speed: 0.5, productivity: 0, consumption: 0.7, pollution: 0 },
  { id: 'productivity-module', category: 'productivity', tier: 1, speed: -0.05, productivity: 0.04, consumption: 0.4, pollution: 0.05 },
  { id: 'productivity-module-2', category: 'productivity', tier: 2, speed: -0.1, productivity: 0.06, consumption: 0.6, pollution: 0.07 },
  { id: 'productivity-module-3', category: 'productivity', tier: 3, speed: -0.15, productivity: 0.1, consumption: 0.8, pollution: 0.1 },
  { id: 'efficiency-module', category: 'efficiency', tier: 1, speed: 0, productivity: 0, consumption: -0.3, pollution: 0 },
  { id: 'efficiency-module-2', category: 'efficiency', tier: 2, speed: 0, productivity: 0, consumption: -0.4, pollution: 0 },
  { id: 'efficiency-module-3', category: 'efficiency', tier: 3, speed: 0, productivity: 0, consumption: -0.5, pollution: 0 },
];

export const MODULES: Readonly<Record<string, ModuleDef>> = Object.freeze(Object.fromEntries(list.map((m) => [m.id, m])));

export function isModule(item: string): boolean {
  return item in MODULES;
}

/** Untergrenze für Geschwindigkeit und Verbrauch (Anteil des Grundwerts). */
export const MODULE_MIN_FACTOR = 0.2;

export const BEACON = {
  /** Übertragungsstärke je Leuchtfeuer: distributionEffectivity / √(Zahl der wirkenden Leuchtfeuer). Wiki „Beacon“ (2.0). */
  distributionEffectivity: 1.5,
  /** Wirkbereich: Felder über den Rand hinaus (9×9 um ein 3×3-Leuchtfeuer). */
  supplyRange: 3,
  /** Erlaubte Module (keine Produktivität). */
  allowed: ['speed', 'efficiency'] as readonly ModuleCategory[],
} as const;

/**
 * Rezepte, die Produktivitätsmodule erlauben (Zwischenprodukte laut Wiki „Module“ / Kategorie „Intermediate products“;
 * Ziegel ja, Beton nein).
 */
export const PRODUCTIVITY_RECIPES: ReadonlySet<string> = new Set([
  'iron-plate', 'copper-plate', 'steel-plate', 'stone-brick',
  'iron-gear-wheel', 'copper-cable', 'iron-stick', 'electronic-circuit', 'advanced-circuit', 'processing-unit',
  'engine-unit', 'electric-engine-unit', 'flying-robot-frame', 'low-density-structure', 'rocket-fuel', 'rocket-part',
  'plastic-bar', 'sulfur', 'sulfuric-acid', 'battery', 'explosives', 'lubricant',
  'solid-fuel-from-light-oil', 'solid-fuel-from-petroleum-gas', 'solid-fuel-from-heavy-oil',
  'basic-oil-processing', 'advanced-oil-processing', 'heavy-oil-cracking', 'light-oil-cracking',
  'automation-science-pack', 'logistic-science-pack', 'chemical-science-pack', 'production-science-pack', 'utility-science-pack',
]);
