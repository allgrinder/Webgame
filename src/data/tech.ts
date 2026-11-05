/**
 * Technologien. Kosten: count Einheiten zu je time Sekunden, jede Einheit verbraucht ein Paket je Sorte.
 * Auslöser-Technologien (2.0) haben keine Kosten: sie werden erforscht, sobald trigger erfüllt ist
 * (z. B. 50 Eisenplatten hergestellt) und alle Voraussetzungen erforscht sind.
 * Quelle: Wiki, Infoboxen „… (research)“ (cost, cost-multiplier, required-technologies, effects, technology-trigger).
 */
export interface TechTrigger {
  readonly type: 'craft-item';
  readonly item: string;
  readonly count: number;
}

export interface TechDef {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly time: number;
  readonly packs: readonly string[];
  readonly prerequisites: readonly string[];
  /** Freigeschaltete Rezepte. */
  readonly unlocks: readonly string[];
  readonly trigger?: TechTrigger;
}

const RED = ['automation-science-pack'];
const RED_GREEN = ['automation-science-pack', 'logistic-science-pack'];

export const TECHS: readonly TechDef[] = [
  {
    id: 'steam-power', name: 'Dampfkraft', count: 0, time: 0, packs: [], prerequisites: [],
    unlocks: ['pipe', 'pipe-to-ground', 'offshore-pump', 'boiler', 'steam-engine'],
    trigger: { type: 'craft-item', item: 'iron-plate', count: 50 },
  },
  {
    id: 'electronics', name: 'Elektronik', count: 0, time: 0, packs: [], prerequisites: [],
    unlocks: ['copper-cable', 'electronic-circuit', 'inserter', 'lab', 'small-electric-pole'],
    trigger: { type: 'craft-item', item: 'copper-plate', count: 10 },
  },
  {
    id: 'automation-science-pack', name: 'Automatisierungs-Wissenschaft', count: 0, time: 0, packs: [],
    prerequisites: ['electronics', 'steam-power'], unlocks: ['automation-science-pack'],
    trigger: { type: 'craft-item', item: 'lab', count: 1 },
  },
  { id: 'electric-mining-drill', name: 'Elektrischer Bohrer', count: 25, time: 10, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['electric-mining-drill'] },
  { id: 'automation', name: 'Automatisierung', count: 10, time: 10, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['assembling-machine-1', 'long-handed-inserter'] },
  { id: 'logistics', name: 'Logistik', count: 20, time: 15, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['splitter', 'underground-belt'] },
  { id: 'logistic-science-pack', name: 'Logistik-Wissenschaft', count: 75, time: 5, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['logistic-science-pack'] },
  { id: 'steel-processing', name: 'Stahlverarbeitung', count: 50, time: 5, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['steel-plate', 'steel-chest'] },
  { id: 'fast-inserter', name: 'Schneller Greifarm', count: 30, time: 15, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['fast-inserter'] },
  { id: 'lamp', name: 'Lampe', count: 10, time: 15, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['lamp'] },
  {
    id: 'electric-energy-distribution-1', name: 'Elektrische Energieverteilung 1', count: 120, time: 30, packs: RED_GREEN,
    prerequisites: ['logistic-science-pack', 'steel-processing'], unlocks: ['medium-electric-pole', 'big-electric-pole', 'iron-stick'],
  },
  {
    id: 'advanced-material-processing', name: 'Fortgeschrittene Materialverarbeitung', count: 75, time: 30, packs: RED_GREEN,
    prerequisites: ['logistic-science-pack', 'steel-processing'], unlocks: ['steel-furnace'],
  },
  {
    id: 'automation-2', name: 'Automatisierung 2', count: 40, time: 15, packs: RED_GREEN,
    prerequisites: ['automation', 'logistic-science-pack', 'steel-processing'], unlocks: ['assembling-machine-2'],
  },
  { id: 'landfill', name: 'Landaufschüttung', count: 50, time: 30, packs: RED_GREEN, prerequisites: ['logistic-science-pack'], unlocks: ['landfill'] },
  { id: 'engine', name: 'Motor', count: 100, time: 15, packs: RED_GREEN, prerequisites: ['logistic-science-pack', 'steel-processing'], unlocks: ['engine-unit'] },
  {
    id: 'fluid-handling', name: 'Flüssigkeitshandhabung', count: 50, time: 15, packs: RED_GREEN,
    prerequisites: ['automation-2', 'engine'], unlocks: ['pump', 'storage-tank'],
  },
  {
    id: 'logistics-2', name: 'Logistik 2', count: 200, time: 30, packs: RED_GREEN,
    prerequisites: ['logistics', 'logistic-science-pack'], unlocks: ['fast-transport-belt', 'fast-underground-belt', 'fast-splitter'],
  },
];

export const TECH_BY_ID: Readonly<Record<string, TechDef>> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Rezepte, die erst durch Forschung freigeschaltet werden. */
export const LOCKED_RECIPES: ReadonlySet<string> = new Set(TECHS.flatMap((t) => t.unlocks));
