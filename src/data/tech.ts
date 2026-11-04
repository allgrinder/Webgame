/**
 * Technologien. Kosten: count Einheiten zu je time Sekunden, jede Einheit verbraucht ein Paket je Sorte.
 * Quelle: factorio-data technology.lua (automation, logistics, logistic-science-pack, logistics-2).
 */
export interface TechDef {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly time: number;
  readonly packs: readonly string[];
  readonly prerequisites: readonly string[];
  /** Freigeschaltete Rezepte. */
  readonly unlocks: readonly string[];
}

export const TECHS: readonly TechDef[] = [
  { id: 'automation', name: 'Automatisierung', count: 10, time: 10, packs: ['automation-science-pack'], prerequisites: [], unlocks: ['assembling-machine-1', 'long-handed-inserter'] },
  { id: 'logistics', name: 'Logistik', count: 20, time: 15, packs: ['automation-science-pack'], prerequisites: [], unlocks: ['splitter', 'underground-belt'] },
  { id: 'logistic-science-pack', name: 'Logistik-Wissenschaft', count: 75, time: 5, packs: ['automation-science-pack'], prerequisites: [], unlocks: ['logistic-science-pack'] },
  {
    id: 'logistics-2', name: 'Logistik 2', count: 200, time: 30, packs: ['automation-science-pack', 'logistic-science-pack'],
    prerequisites: ['logistics', 'logistic-science-pack'], unlocks: ['fast-transport-belt'],
  },
];

export const TECH_BY_ID: Readonly<Record<string, TechDef>> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Rezepte, die erst durch Forschung freigeschaltet werden. */
export const LOCKED_RECIPES: ReadonlySet<string> = new Set(TECHS.flatMap((t) => t.unlocks));
