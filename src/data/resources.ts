/**
 * Abbaubare Ressourcen auf der Karte. Index 0 ist reserviert für "keine Ressource".
 * Neue Ressourcen hinten anfügen (Index wird im Spielstand gespeichert).
 */
export interface ResourceDef {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  /** Ergebnis-Item beim Abbau. */
  readonly result: string;
  /** Abbauzeit in Sekunden bei Abbaugeschwindigkeit 1. */
  readonly miningTime: number;
  /** Mengenschwellen für die sichtbare Dichte (aufsteigend, Anzahl = Dichtestufen - 1). */
  readonly densityThresholds: readonly number[];
}

export const RESOURCES: readonly ResourceDef[] = [
  { id: 'iron-ore', index: 1, name: 'Eisenerz', result: 'iron-ore', miningTime: 1, densityThresholds: [150, 400, 800] },
  { id: 'coal', index: 2, name: 'Kohle', result: 'coal', miningTime: 1, densityThresholds: [150, 400, 800] },
  { id: 'stone', index: 3, name: 'Stein', result: 'stone', miningTime: 1, densityThresholds: [150, 400, 800] },
];

export const RESOURCE_BY_INDEX: readonly (ResourceDef | undefined)[] = (() => {
  const arr: (ResourceDef | undefined)[] = [undefined];
  for (const r of RESOURCES) arr[r.index] = r;
  return arr;
})();

export function resourceById(id: string): ResourceDef {
  const r = RESOURCES.find((x) => x.id === id);
  if (!r) throw new Error(`Unbekannte Ressource: ${id}`);
  return r;
}

/** Dichtestufe 0..n für die Darstellung. */
export function densityLevel(def: ResourceDef, amount: number): number {
  let lvl = 0;
  for (const t of def.densityThresholds) if (amount >= t) lvl++;
  return lvl;
}
