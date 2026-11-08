import { BARRELED } from './items';
/**
 * Technologien. Kosten: count Einheiten zu je time Sekunden, jede Einheit verbraucht ein Paket je Sorte.
 * Auslöser-Technologien (2.0) haben keine Kosten: sie werden erforscht, sobald trigger erfüllt ist
 * (z. B. 50 Eisenplatten hergestellt) und alle Voraussetzungen erforscht sind.
 * Quelle: Wiki, Infoboxen „… (research)“ (cost, cost-multiplier, required-technologies, effects, technology-trigger).
 */
export interface TechTrigger {
  /** craft-item: herstellen; mine-entity: abbauen/fördern (z. B. Rohöl). */
  readonly type: 'craft-item' | 'mine-entity';
  readonly item: string;
  readonly count: number;
}

/** Bonusarten der Forschung (Wiki „Research“, Abschnitt Bonusse). value: Prozent als Bruch (0,1 = +10 %) bzw. Anzahl. */
export type BonusType =
  | 'inserter-stack' | 'bulk-stack' | 'mining-productivity' | 'lab-speed' | 'toolbelt'
  | 'bullet-damage' | 'turret-damage' | 'shooting-speed' | 'robot-speed' | 'robot-cargo' | 'braking' | 'hand-mining';

export interface TechEffect {
  readonly type: BonusType;
  readonly value: number;
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
  /** Boni (Forschungsstufen). */
  readonly effects?: readonly TechEffect[];
  /** Stufe (Anzeige „… 3“). */
  readonly level?: number;
  /**
   * Unendliche Forschung: bleibt nach Abschluss erforschbar; Stufe = level + Anzahl Abschlüsse,
   * Kosten je Stufe aus der Formel (Wiki), effects gelten je Abschluss.
   */
  readonly infinite?: { readonly count: (level: number) => number };
}

/** Fässer füllen/leeren (Flüssigkeitshandhabung, Wiki). */
const BARREL_RECIPES = BARRELED.flatMap((f) => [`fill-${f.id}-barrel`, `empty-${f.id}-barrel`]);
const RED = ['automation-science-pack'];
const RED_GREEN = ['automation-science-pack', 'logistic-science-pack'];
const RGB = ['automation-science-pack', 'logistic-science-pack', 'chemical-science-pack'];
const RGBP = [...RGB, 'production-science-pack'];
const RGBU = [...RGB, 'utility-science-pack'];
const RGBPU = [...RGBP, 'utility-science-pack'];
const RGBPUS = [...RGBPU, 'space-science-pack'];
const RGM = [...RED_GREEN, 'military-science-pack'];
const RGMC = [...RGM, 'chemical-science-pack'];
const RGMCU = [...RGMC, 'utility-science-pack'];
const RGMCUS = [...RGMCU, 'space-science-pack'];

/**
 * Stufenforschung (Wiki „… (research)“): je Stufe Kosten, Zeit, Pakete, Wirkung. Stufe 1 hängt an pre,
 * jede weitere an der vorherigen. last.infinite macht die letzte Stufe unendlich.
 */
function levels(
  id: string, name: string, pre: readonly string[], rows: readonly [count: number, time: number, packs: readonly string[], effects: readonly TechEffect[]][],
  infinite?: { count: (level: number) => number },
): TechDef[] {
  return rows.map(([count, time, packs, effects], i) => ({
    id: `${id}-${i + 1}`, name: `${name} ${i + 1}`, count, time, packs, level: i + 1,
    prerequisites: i === 0 ? pre : [`${id}-${i}`], unlocks: [], effects,
    ...(infinite && i === rows.length - 1 ? { infinite } : {}),
  }));
}
const E = (type: BonusType, value: number): TechEffect => ({ type, value });
/** Physischer Schaden (Wiki): Kugeln und Geschützturm je Stufe. */
const dmg = (b: number, t: number) => [E('bullet-damage', b), E('turret-damage', t)];

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
  // Militär (Wiki „Military“, „Gun turret (research)“, „Stone wall (research)“, „Military 2“)
  { id: 'military', name: 'Militär', count: 10, time: 15, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['submachine-gun'] },
  { id: 'gun-turret', name: 'Geschützturm', count: 10, time: 10, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['gun-turret'] },
  { id: 'repair-pack', name: 'Reparaturset', count: 25, time: 10, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['repair-pack'] },
  { id: 'stone-wall', name: 'Steinmauer', count: 10, time: 10, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['stone-wall'] },
  {
    id: 'military-2', name: 'Militär 2', count: 20, time: 15, packs: RED_GREEN,
    prerequisites: ['military', 'steel-processing', 'logistic-science-pack'], unlocks: ['piercing-rounds-magazine', 'grenade'],
  },
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
    prerequisites: ['automation-2', 'engine'], unlocks: ['pump', 'storage-tank', 'empty-barrel', ...BARREL_RECIPES],
  },
  { id: 'oil-gathering', name: 'Ölförderung', count: 100, time: 30, packs: RED_GREEN, prerequisites: ['fluid-handling'], unlocks: ['pumpjack'] },
  {
    id: 'oil-processing', name: 'Ölverarbeitung', count: 0, time: 0, packs: [], prerequisites: ['oil-gathering'],
    unlocks: ['basic-oil-processing', 'chemical-plant', 'oil-refinery', 'solid-fuel-from-petroleum-gas'],
    trigger: { type: 'mine-entity', item: 'crude-oil', count: 1 },
  },
  { id: 'plastics', name: 'Kunststoffe', count: 200, time: 30, packs: RED_GREEN, prerequisites: ['oil-processing'], unlocks: ['plastic-bar'] },
  { id: 'advanced-circuit', name: 'Fortgeschrittene Schaltkreise', count: 200, time: 15, packs: RED_GREEN, prerequisites: ['plastics'], unlocks: ['advanced-circuit'] },
  { id: 'sulfur-processing', name: 'Schwefelverarbeitung', count: 150, time: 30, packs: RED_GREEN, prerequisites: ['oil-processing'], unlocks: ['sulfur', 'sulfuric-acid'] },
  { id: 'battery', name: 'Batterie', count: 150, time: 30, packs: RED_GREEN, prerequisites: ['sulfur-processing'], unlocks: ['battery'] },
  {
    id: 'solar-energy', name: 'Solarenergie', count: 250, time: 30, packs: RED_GREEN,
    prerequisites: ['logistic-science-pack', 'steel-processing'], unlocks: ['solar-panel'],
  },
  {
    id: 'electric-energy-accumulators', name: 'Akkumulatoren', count: 150, time: 30, packs: RED_GREEN,
    prerequisites: ['battery', 'electric-energy-distribution-1'], unlocks: ['accumulator'],
  },
  { id: 'explosives', name: 'Sprengstoff', count: 100, time: 15, packs: RED_GREEN, prerequisites: ['sulfur-processing'], unlocks: ['explosives'] },
  // Wiki „Cliff explosives (research)“: 200 × (rot, grün), 15 s
  { id: 'cliff-explosives', name: 'Klippensprengstoff', count: 200, time: 15, packs: RED_GREEN, prerequisites: ['explosives', 'military-2'], unlocks: ['cliff-explosives'] },
  {
    id: 'chemical-science-pack', name: 'Chemie-Wissenschaft', count: 75, time: 10, packs: RED_GREEN,
    prerequisites: ['advanced-circuit', 'sulfur-processing'], unlocks: ['chemical-science-pack'],
  },
  {
    id: 'advanced-oil-processing', name: 'Fortgeschrittene Ölverarbeitung', count: 75, time: 30, packs: RGB, prerequisites: ['chemical-science-pack'],
    unlocks: ['advanced-oil-processing', 'heavy-oil-cracking', 'light-oil-cracking', 'solid-fuel-from-heavy-oil', 'solid-fuel-from-light-oil'],
  },
  { id: 'lubricant', name: 'Schmiermittel', count: 50, time: 30, packs: RGB, prerequisites: ['advanced-oil-processing'], unlocks: ['lubricant'] },
  { id: 'electric-engine', name: 'Elektromotor', count: 50, time: 30, packs: RGB, prerequisites: ['lubricant'], unlocks: ['electric-engine-unit'] },
  {
    id: 'advanced-material-processing-2', name: 'Fortgeschrittene Materialverarbeitung 2', count: 250, time: 30, packs: RGB,
    prerequisites: ['advanced-material-processing', 'chemical-science-pack'], unlocks: ['electric-furnace'],
  },
  {
    id: 'electric-energy-distribution-2', name: 'Elektrische Energieverteilung 2', count: 100, time: 45, packs: RGB,
    prerequisites: ['chemical-science-pack', 'electric-energy-distribution-1'], unlocks: ['substation'],
  },
  {
    id: 'logistics-2', name: 'Logistik 2', count: 200, time: 30, packs: RED_GREEN,
    prerequisites: ['logistics', 'logistic-science-pack'], unlocks: ['fast-transport-belt', 'fast-underground-belt', 'fast-splitter'],
  },
  // Spätes Spiel (2.0): Module, Leuchtfeuer, Montage 3, Logistik 3, Produktions-/Hightech-Wissenschaft
  { id: 'modules', name: 'Module', count: 100, time: 30, packs: RED_GREEN, prerequisites: ['advanced-circuit'], unlocks: [] },
  { id: 'speed-module', name: 'Geschwindigkeitsmodul', count: 50, time: 30, packs: RED_GREEN, prerequisites: ['modules'], unlocks: ['speed-module'] },
  { id: 'productivity-module', name: 'Produktivitätsmodul', count: 50, time: 30, packs: RED_GREEN, prerequisites: ['modules'], unlocks: ['productivity-module'] },
  { id: 'efficiency-module', name: 'Effizienzmodul', count: 50, time: 30, packs: RED_GREEN, prerequisites: ['modules'], unlocks: ['efficiency-module'] },
  { id: 'processing-unit', name: 'Prozessor', count: 300, time: 30, packs: RGB, prerequisites: ['chemical-science-pack'], unlocks: ['processing-unit'] },
  ...(['speed', 'productivity', 'efficiency'] as const).map((k) => ({
    id: `${k}-module-2`, name: `${k === 'speed' ? 'Geschwindigkeits' : k === 'productivity' ? 'Produktivitäts' : 'Effizienz'}modul 2`,
    count: 75, time: 30, packs: RGB, prerequisites: ['processing-unit', `${k}-module`], unlocks: [`${k}-module-2`],
  })),
  {
    id: 'low-density-structure', name: 'Leichtbauteil', count: 300, time: 45, packs: RGB,
    prerequisites: ['advanced-material-processing', 'chemical-science-pack'], unlocks: ['low-density-structure'],
  },
  { id: 'railway', name: 'Eisenbahn', count: 75, time: 30, packs: RED_GREEN, prerequisites: ['engine', 'logistics-2'], unlocks: ['cargo-wagon', 'iron-stick', 'locomotive', 'rail'] },
  {
    id: 'automated-rail-transportation', name: 'Automatischer Schienenverkehr', count: 200, time: 30, packs: RED_GREEN, prerequisites: ['railway'],
    unlocks: ['train-stop'],
  },
  {
    id: 'production-science-pack', name: 'Produktions-Wissenschaftspaket', count: 100, time: 30, packs: RGB,
    prerequisites: ['advanced-material-processing-2', 'productivity-module', 'railway'], unlocks: ['production-science-pack'],
  },
  ...(['speed', 'productivity', 'efficiency'] as const).map((k) => ({
    id: `${k}-module-3`, name: `${k === 'speed' ? 'Geschwindigkeits' : k === 'productivity' ? 'Produktivitäts' : 'Effizienz'}modul 3`,
    count: 300, time: 60, packs: RGBP, prerequisites: ['production-science-pack', `${k}-module-2`], unlocks: [`${k}-module-3`],
  })),
  { id: 'effect-transmission', name: 'Wirkungsübertragung', count: 75, time: 30, packs: RGBP, prerequisites: ['processing-unit', 'production-science-pack'], unlocks: ['beacon'] },
  {
    id: 'automation-3', name: 'Automatisierung 3', count: 150, time: 60, packs: RGBP,
    prerequisites: ['electric-engine', 'production-science-pack', 'speed-module'], unlocks: ['assembling-machine-3'],
  },
  {
    id: 'logistics-3', name: 'Logistik 3', count: 300, time: 15, packs: RGBP, prerequisites: ['lubricant', 'production-science-pack'],
    unlocks: ['express-transport-belt', 'express-underground-belt', 'express-splitter'],
  },
  { id: 'flammables', name: 'Brennstoffe', count: 50, time: 30, packs: RED_GREEN, prerequisites: ['oil-processing'], unlocks: [] },
  { id: 'rocket-fuel', name: 'Raketentreibstoff', count: 300, time: 45, packs: RGB, prerequisites: ['advanced-oil-processing', 'flammables'], unlocks: ['rocket-fuel'] },
  { id: 'robotics', name: 'Robotik', count: 75, time: 30, packs: RGB, prerequisites: ['battery', 'electric-engine'], unlocks: ['flying-robot-frame'] },
  {
    id: 'utility-science-pack', name: 'Hightech-Wissenschaftspaket', count: 100, time: 30, packs: RGB,
    prerequisites: ['low-density-structure', 'processing-unit', 'robotics'], unlocks: ['utility-science-pack'],
  },
  {
    id: 'construction-robotics', name: 'Bauroboter', count: 100, time: 30, packs: RGB, prerequisites: ['robotics'],
    unlocks: ['construction-robot', 'passive-provider-chest', 'roboport', 'storage-chest'],
  },
  {
    id: 'logistic-robotics', name: 'Logistikroboter', count: 250, time: 30, packs: RGB, prerequisites: ['robotics'],
    unlocks: ['logistic-robot', 'passive-provider-chest', 'roboport', 'storage-chest'],
  },
  {
    id: 'logistic-system', name: 'Logistiksystem', count: 500, time: 30, packs: RGBU, prerequisites: ['logistic-robotics', 'utility-science-pack'],
    unlocks: ['active-provider-chest', 'buffer-chest', 'requester-chest'],
  },
  {
    id: 'circuit-network', name: 'Schaltungsnetz', count: 100, time: 15, packs: RED_GREEN, prerequisites: ['logistic-science-pack'],
    unlocks: ['arithmetic-combinator', 'constant-combinator', 'decider-combinator', 'iron-stick'],
  },
  { id: 'radar', name: 'Radar', count: 20, time: 10, packs: RED, prerequisites: ['automation-science-pack'], unlocks: ['radar'] },
  {
    id: 'rocket-silo', name: 'Raketensilo', count: 1000, time: 60, packs: RGBPU,
    prerequisites: [
      'concrete', 'electric-energy-accumulators', 'productivity-module-3', 'radar', 'rocket-fuel', 'solar-energy', 'speed-module-3', 'utility-science-pack',
    ],
    unlocks: ['cargo-landing-pad', 'rocket-part', 'rocket-silo', 'satellite'],
  },
  { id: 'concrete', name: 'Beton', count: 250, time: 30, packs: RED_GREEN, prerequisites: ['advanced-material-processing', 'automation-2'], unlocks: ['concrete', 'iron-stick', 'hazard-concrete', 'refined-concrete', 'refined-hazard-concrete'] },
  // Forschungs-Boni (Wiki-Tabellen der jeweiligen „… (research)“-Seiten, Stand 2.0 Grundspiel)
  {
    id: 'military-science-pack', name: 'Militär-Wissenschaft', count: 30, time: 15, packs: RED_GREEN,
    prerequisites: ['military-2', 'stone-wall'], unlocks: ['military-science-pack'],
  },
  {
    id: 'bulk-inserter', name: 'Massengreifarm', count: 150, time: 30, packs: RED_GREEN,
    prerequisites: ['advanced-circuit', 'fast-inserter', 'logistics-2'], unlocks: ['bulk-inserter'],
  },
  ...levels('inserter-capacity-bonus', 'Greifarm-Kapazität', ['bulk-inserter'], [
    [200, 30, RED_GREEN, [E('bulk-stack', 1)]],
    [250, 30, RED_GREEN, [E('inserter-stack', 1), E('bulk-stack', 1)]],
    [250, 30, RGB, [E('bulk-stack', 1)]],
    [250, 30, RGBP, [E('bulk-stack', 1)]],
    [300, 30, RGBP, [E('bulk-stack', 2)]],
    [400, 30, RGBP, [E('bulk-stack', 2)]],
    [600, 30, RGBPU, [E('inserter-stack', 1), E('bulk-stack', 2)]],
  ]),
  ...levels('mining-productivity', 'Bergbau-Produktivität', ['advanced-circuit'], [
    [250, 60, RED_GREEN, [E('mining-productivity', 0.1)]],
    [500, 60, RGB, [E('mining-productivity', 0.1)]],
    [1000, 60, RGBPU, [E('mining-productivity', 0.1)]],
    [2500, 60, RGBPUS, [E('mining-productivity', 0.1)]],
  ], { count: (l) => 2500 * (l - 3) }),
  ...levels('research-speed', 'Laborgeschwindigkeit', ['automation-2'], [
    [100, 30, RED_GREEN, [E('lab-speed', 0.2)]],
    [200, 30, RED_GREEN, [E('lab-speed', 0.3)]],
    [250, 30, RGB, [E('lab-speed', 0.4)]],
    [500, 30, RGB, [E('lab-speed', 0.5)]],
    [500, 30, RGBP, [E('lab-speed', 0.5)]],
    [500, 30, RGBPU, [E('lab-speed', 0.6)]],
  ]),
  { id: 'toolbelt', name: 'Werkzeuggürtel', count: 100, time: 30, packs: RED_GREEN, prerequisites: ['logistic-science-pack'], unlocks: [], effects: [E('toolbelt', 10)] },
  {
    id: 'steel-axe', name: 'Stahlaxt', count: 0, time: 0, packs: [], prerequisites: ['steel-processing'], unlocks: [],
    trigger: { type: 'craft-item', item: 'steel-plate', count: 50 }, effects: [E('hand-mining', 1)],
  },
  ...levels('physical-projectile-damage', 'Physischer Projektilschaden', ['military'], [
    [100, 30, RED, dmg(0.1, 0.1)],
    [200, 30, RED_GREEN, dmg(0.1, 0.1)],
    [300, 60, RGM, dmg(0.2, 0.2)],
    [400, 60, RGM, dmg(0.2, 0.2)],
    [500, 60, RGMC, dmg(0.2, 0.2)],
    [600, 60, RGMCU, dmg(0.4, 0.4)],
    [1000, 60, RGMCUS, dmg(0.4, 0.7)],
  ], { count: (l) => 2 ** (l - 7) * 1000 }),
  ...levels('weapon-shooting-speed', 'Feuerrate', ['military'], [
    [100, 30, RED, [E('shooting-speed', 0.1)]],
    [200, 30, RED_GREEN, [E('shooting-speed', 0.2)]],
    [300, 60, RGM, [E('shooting-speed', 0.2)]],
    [400, 60, RGM, [E('shooting-speed', 0.3)]],
    [500, 60, RGMC, [E('shooting-speed', 0.3)]],
    [600, 60, RGMCU, [E('shooting-speed', 0.4)]],
  ]),
  ...levels('worker-robots-speed', 'Robotergeschwindigkeit', ['robotics'], [
    [50, 30, RGB, [E('robot-speed', 0.35)]],
    [100, 30, RGB, [E('robot-speed', 0.4)]],
    [150, 60, RGBU, [E('robot-speed', 0.45)]],
    [250, 60, RGBU, [E('robot-speed', 0.55)]],
    [500, 60, RGBPU, [E('robot-speed', 0.65)]],
    [1000, 60, RGBPUS, [E('robot-speed', 0.65)]],
  ], { count: (l) => 2 ** (l - 6) * 1000 }),
  ...levels('worker-robots-storage', 'Roboter-Frachtgröße', ['robotics'], [
    [200, 30, RGB, [E('robot-cargo', 1)]],
    [300, 60, RGBP, [E('robot-cargo', 1)]],
    [450, 60, RGBPU, [E('robot-cargo', 1)]],
  ]),
  ...levels('braking-force', 'Bremskraft', ['chemical-science-pack', 'railway'], [
    [100, 30, RGB, [E('braking', 0.1)]],
    [200, 30, RGB, [E('braking', 0.15)]],
    [250, 30, RGBP, [E('braking', 0.15)]],
    [350, 30, RGBP, [E('braking', 0.15)]],
    [450, 35, RGBP, [E('braking', 0.15)]],
    [550, 45, RGBPU, [E('braking', 0.15)]],
    [650, 60, RGBPU, [E('braking', 0.15)]],
  ]),
];

export const TECH_BY_ID: Readonly<Record<string, TechDef>> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Rezepte, die erst durch Forschung freigeschaltet werden. */
/** Länge der Forschungswarteschlange (Wiki „Research“: bis zu 7 Technologien). */
export const RESEARCH_QUEUE_MAX = 7;

export const LOCKED_RECIPES: ReadonlySet<string> = new Set(TECHS.flatMap((t) => t.unlocks));
