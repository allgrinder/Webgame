import { ENTITIES } from '../data/entities';
import { FLUIDS } from '../data/fluids';
import { ITEMS } from '../data/items';
import { START_INVENTORY } from '../data/player';
import { RECIPE_LIST, type RecipeDef } from '../data/recipes';
import { RESOURCES } from '../data/resources';
import { LOCKED_RECIPES, TECHS, type TechDef } from '../data/tech';

/**
 * Fortschrittsgraph (Skill survival-crafting, „every craftable item is reachable from the starting resources“):
 * Ausgehend von Startinventar, Handabbau und Bäumen wird Schritt für Schritt alles freigeschaltet, was mit
 * erreichbaren Zutaten, Maschinen und Forschungen herstellbar ist. `step` zählt die Runden – grob die Ausbaustufe.
 */
export interface Progression {
  /** Item bzw. Flüssigkeit → erste Runde, in der es erreichbar ist. */
  items: Map<string, number>;
  /** Technologie → Runde. */
  techs: Map<string, number>;
  /** Rezept → Runde. */
  recipes: Map<string, number>;
}

/** Sonderquellen außerhalb der Rezepte: Ergebnis ← nötige Dinge (alle müssen erreichbar sein). */
export const SPECIAL_SOURCES: readonly { item: string; needs: readonly string[]; tech?: string; how: string }[] = [
  { item: 'wood', needs: [], how: 'Bäume fällen' },
  { item: 'water', needs: ['offshore-pump'], how: 'Uferpumpe am Wasser' },
  { item: 'crude-oil', needs: ['pumpjack'], how: 'Pumpjack auf einer Ölquelle' },
  { item: 'steam', needs: ['boiler', 'water'], how: 'Kessel mit Wasser und Brennstoff' },
  { item: 'steam-hot', needs: ['heat-exchanger', 'nuclear-reactor', 'uranium-fuel-cell', 'water'], how: 'Wärmetauscher am Kernreaktor' },
  { item: 'depleted-uranium-fuel-cell', needs: ['nuclear-reactor', 'uranium-fuel-cell'], how: 'Abgebrannte Brennstäbe aus dem Kernreaktor' },
  { item: 'space-science-pack', needs: ['rocket-silo', 'rocket-part', 'satellite'], how: 'Rakete starten (Fracht kommt zurück)' },
];

/** Maschinen, die ein Rezept herstellen können (Item-Namen). 'crafting' geht auch von Hand. */
export function machinesFor(r: RecipeDef): string[] {
  const out: string[] = [];
  for (const e of Object.values(ENTITIES)) {
    const d = e as { kind: string; categories?: readonly string[]; item?: string };
    const ok = r.category === 'smelting' ? d.kind === 'furnace'
      : r.category === 'rocket-building' ? d.kind === 'rocket-silo'
      : !!d.categories?.includes(r.category);
    if (ok && d.item) out.push(d.item);
  }
  return out;
}

export function progression(): Progression {
  const items = new Map<string, number>();
  const techs = new Map<string, number>();
  const recipes = new Map<string, number>();
  const unlockedBy = new Map<string, TechDef[]>();
  for (const t of TECHS) for (const r of t.unlocks) unlockedBy.set(r, [...(unlockedBy.get(r) ?? []), t]);
  const has = (i: string) => items.has(i);
  const add = (i: string, step: number) => {
    if (items.has(i)) return false;
    items.set(i, step);
    return true;
  };
  // Start: Inventar, Handabbau (feste Rohstoffe ohne Flüssigkeit), Bäume
  for (const s of START_INVENTORY) add(s.item, 0);
  for (const r of RESOURCES) if (!r.fluid && !r.requiresFluid) add(r.result, 0);
  for (let step = 1; step < 200; step++) {
    let changed = false;
    for (const sp of SPECIAL_SOURCES) {
      if (!has(sp.item) && sp.needs.every(has)) changed = add(sp.item, step) || changed;
    }
    // Uranerz: elektrischer Bohrer + Flüssigkeit + Forschung (Wiki „Uranium ore“)
    for (const r of RESOURCES) {
      if (!r.requiresFluid || has(r.result)) continue;
      if (has('electric-mining-drill') && has(r.requiresFluid.fluid) && techs.has(r.requiresFluid.tech)) changed = add(r.result, step) || changed;
    }
    // Forschung
    const labOk = [...Object.values(ENTITIES)].some((e) => e.kind === 'lab' && has((e as { item: string }).item));
    for (const t of TECHS) {
      if (techs.has(t.id) || !t.prerequisites.every((p) => techs.has(p))) continue;
      const ok = t.trigger ? has(t.trigger.item) : labOk && t.packs.every(has);
      if (ok) {
        techs.set(t.id, step);
        changed = true;
      }
    }
    // Rezepte
    for (const r of RECIPE_LIST) {
      if (recipes.has(r.id)) continue;
      const free = !LOCKED_RECIPES.has(r.id) || (unlockedBy.get(r.id) ?? []).some((t) => techs.has(t.id));
      if (!free || !r.ingredients.every((g) => has(g.item))) continue;
      const hand = r.category === 'crafting';
      if (!hand && !machinesFor(r).some(has)) continue;
      recipes.set(r.id, step);
      for (const x of r.results) add(x.item, step);
      changed = true;
    }
    if (!changed) break;
  }
  return { items, techs, recipes };
}

/** Alles, was es im Spiel gibt (Items und Flüssigkeiten). */
export function allProducts(): string[] {
  return [...Object.keys(ITEMS), ...Object.keys(FLUIDS)];
}
