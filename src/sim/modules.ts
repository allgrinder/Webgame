import { BEACON, MODULES, MODULE_MIN_FACTOR, isModule } from '../data/modules';
import { tileKey } from './geom';
import { Inventory } from './inventory';
import type { World } from './world';

/** Summe der Modulwirkungen (Anteile, additiv). */
export interface Effects {
  speed: number;
  productivity: number;
  consumption: number;
}

export const NO_EFFECTS: Readonly<Effects> = Object.freeze({ speed: 0, productivity: 0, consumption: 0 });

/** Gebäude mit Modulplätzen. */
export interface ModuleHost {
  readonly id: number;
  readonly modules: Inventory | null;
}

/** Modulplätze: nur Module, je Platz eines (Stapelgröße 1). */
export function moduleInventory(slots: number, accept: (item: string) => boolean = isModule): Inventory | null {
  if (slots <= 0) return null;
  const inv = new Inventory(slots, accept);
  inv.maxPerSlot = 1;
  return inv;
}

export function addEffects(into: Effects, inv: Inventory | null, scale = 1): void {
  if (!inv) return;
  for (const s of inv.slots) {
    if (!s) continue;
    const m = MODULES[s.item];
    if (!m) continue;
    into.speed += m.speed * s.count * scale;
    into.productivity += m.productivity * s.count * scale;
    into.consumption += m.consumption * s.count * scale;
  }
}

export function speedFactor(e: Effects): number {
  return Math.max(MODULE_MIN_FACTOR, 1 + e.speed);
}
export function consumptionFactor(e: Effects): number {
  return Math.max(MODULE_MIN_FACTOR, 1 + e.consumption);
}
export function productivityBonus(e: Effects): number {
  return Math.max(0, e.productivity);
}

/** Leuchtfeuer in der Welt (für die Zuordnung zu Maschinen). */
export interface BeaconLike {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly modules: Inventory | null;
  /** Hatte im letzten Tick Strom. */
  powered: boolean;
}

/**
 * Leuchtfeuer → Maschinen: jede Maschine mit Modulplätzen, deren Grundfläche den Wirkbereich (9×9) berührt.
 * Wirkung je Leuchtfeuer = Module × 1,5 / √n (n = Zahl der wirkenden Leuchtfeuer). Quelle: Wiki „Beacon“.
 */
export class BeaconSystem {
  private version = -1;
  /** Maschinen-ID → Leuchtfeuer-IDs. */
  readonly sources = new Map<number, number[]>();

  ensure(w: World): void {
    if (this.version === w.structureVersion) return;
    this.version = w.structureVersion;
    this.sources.clear();
    const r = BEACON.supplyRange;
    for (const b of w.entities.values()) {
      if (b.kind !== 'beacon') continue;
      const seen = new Set<number>();
      for (let y = b.y - r; y < b.y + b.h + r; y++) {
        for (let x = b.x - r; x < b.x + b.w + r; x++) {
          const id = w.occupantAt(tileKey(x, y));
          if (id === undefined || seen.has(id) || id === b.id) continue;
          seen.add(id);
          const e = w.entities.get(id) as unknown as ModuleHost | undefined;
          if (!e?.modules || (e as unknown as { kind: string }).kind === 'beacon') continue;
          const list = this.sources.get(id);
          if (list) list.push(b.id);
          else this.sources.set(id, [b.id]);
        }
      }
    }
  }

  /** Gesamtwirkung auf eine Maschine (eigene Module + Leuchtfeuer). */
  effects(w: World, host: ModuleHost, out: Effects = { speed: 0, productivity: 0, consumption: 0 }): Effects {
    out.speed = 0;
    out.productivity = 0;
    out.consumption = 0;
    addEffects(out, host.modules);
    const src = this.sources.get(host.id);
    if (src) {
      let n = 0;
      for (const id of src) {
        const b = w.entities.get(id) as unknown as BeaconLike | undefined;
        if (b?.powered && b.modules && !b.modules.isEmpty()) n++;
      }
      if (n > 0) {
        const k = BEACON.distributionEffectivity / Math.sqrt(n);
        for (const id of src) {
          const b = w.entities.get(id) as unknown as BeaconLike | undefined;
          if (b?.powered) addEffects(out, b.modules, k);
        }
      }
    }
    return out;
  }
}
