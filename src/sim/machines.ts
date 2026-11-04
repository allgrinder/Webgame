import { type DrillDef, type FurnaceDef, type InserterDef, entityDef } from '../data/entities';
import { ITEMS, ITEM_IDS, isFuel } from '../data/items';
import { type RecipeDef, smeltingRecipeFor } from '../data/recipes';
import { RESOURCE_BY_INDEX } from '../data/resources';
import { secondsToTicks, wattsToJoulesPerTick } from '../data/time';
import { Burner } from './burner';
import { type EntityBase, Status } from './entity';
import type { Dir } from './geom';
import { Inventory } from './inventory';

export interface BeltEntity extends EntityBase {
  readonly kind: 'belt';
}

export class DrillEntity implements EntityBase {
  readonly kind = 'drill' as const;
  status = Status.Idle;
  readonly def: DrillDef;
  readonly burner: Burner;
  /** Fortschritt in Ticks für das aktuelle Erz. */
  progress = 0;
  /** Fertig abgebautes, noch nicht ausgegebenes Item. */
  output: string | null = null;
  /** Reihum-Zeiger über die Felder des Abbaubereichs. */
  cursor = 0;
  /** Animationsphase (nur Darstellung, zählt Arbeitsticks). */
  workTicks = 0;
  constructor(readonly id: number, readonly name: string, readonly x: number, readonly y: number, public dir: Dir) {
    this.def = entityDef(name) as DrillDef;
    this.burner = new Burner(this.def.fuelSlots);
  }
  get joulesPerTick(): number {
    return wattsToJoulesPerTick(this.def.energyUsage);
  }
  /** Ticks pro abgebautem Item für eine Ressource. */
  ticksPerItem(resIndex: number): number {
    const r = RESOURCE_BY_INDEX[resIndex]!;
    return secondsToTicks(r.miningTime / this.def.miningSpeed);
  }
  /** Felder des Abbaubereichs (feste Reihenfolge). */
  areaTiles(): [number, number][] {
    const size = this.def.miningAreaSize;
    const ox = this.x + (this.def.width - size) / 2;
    const oy = this.y + (this.def.height - size) / 2;
    const out: [number, number][] = [];
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) out.push([Math.floor(ox + i), Math.floor(oy + j)]);
    return out;
  }
}

export class FurnaceEntity implements EntityBase {
  readonly kind = 'furnace' as const;
  status = Status.Idle;
  readonly def: FurnaceDef;
  readonly burner: Burner;
  readonly source: Inventory;
  readonly result = new Inventory(1);
  /** Aktuelles Rezept während des Schmelzens. */
  recipe: RecipeDef | null = null;
  progress = 0;
  workTicks = 0;
  constructor(readonly id: number, readonly name: string, readonly x: number, readonly y: number, public dir: Dir) {
    this.def = entityDef(name) as FurnaceDef;
    this.burner = new Burner(this.def.fuelSlots);
    this.source = new Inventory(1, (i) => !!smeltingRecipeFor(i));
  }
  get joulesPerTick(): number {
    return wattsToJoulesPerTick(this.def.energyUsage);
  }
  recipeTicks(r: RecipeDef): number {
    return secondsToTicks(r.time / this.def.craftingSpeed);
  }
}

export enum InserterPhase {
  WaitPickup = 0,
  ToDrop = 1,
  WaitDrop = 2,
  ToPickup = 3,
}

/** Winkeleinheiten: 1000 = volle Umdrehung, halbe Drehung = 500. */
export const HALF_TURN = 500;

export class InserterEntity implements EntityBase {
  readonly kind = 'inserter' as const;
  status = Status.Idle;
  readonly def: InserterDef;
  readonly burner: Burner;
  phase = InserterPhase.WaitPickup;
  /** Drehfortschritt der aktuellen Halbdrehung in Tausendstel-Umdrehungen. */
  progress = 0;
  held: string | null = null;
  constructor(readonly id: number, readonly name: string, readonly x: number, readonly y: number, public dir: Dir) {
    this.def = entityDef(name) as InserterDef;
    this.burner = new Burner(this.def.fuelSlots, this.def.initialEnergy);
  }
  /** Drehung pro Tick in Tausendstel-Umdrehungen. */
  get turnPerTick(): number {
    return Math.round(this.def.rotationSpeed * 1000);
  }
  get halfSwingEnergy(): number {
    return Math.round(this.def.energyPerTransfer / 2);
  }
  /** Armwinkel 0 (Aufnahme) .. 1 (Ablage). */
  armT(): number {
    switch (this.phase) {
      case InserterPhase.WaitPickup: return 0;
      case InserterPhase.ToDrop: return this.progress / HALF_TURN;
      case InserterPhase.WaitDrop: return 1;
      case InserterPhase.ToPickup: return 1 - this.progress / HALF_TURN;
    }
  }
}

export type Entity = BeltEntity | DrillEntity | FurnaceEntity | InserterEntity;

export function itemIndex(id: string): number {
  const i = ITEM_IDS.indexOf(id);
  if (i < 0) throw new Error(`Unbekanntes Item ${id}`);
  return i;
}
export function itemId(index: number): string {
  return ITEM_IDS[index];
}

/** Wieviele Items dieses Typs ein Gebäude annimmt. mode 'inserter' beachtet die Füllgrenzen. */
export function acceptAmount(e: Entity, item: string, mode: 'machine' | 'inserter' | 'player'): number {
  switch (e.kind) {
    case 'furnace': {
      const r = smeltingRecipeFor(item);
      if (r) {
        const space = e.source.space(item);
        if (mode !== 'inserter') return space;
        const ins = entityDef('burner-inserter') as InserterDef;
        const limit = ins.ingredientLimitCrafts * r.ingredients[0].amount;
        return Math.max(0, Math.min(space, limit - e.source.count(item)));
      }
      if (isFuel(item)) return fuelAccept(e.burner, item, mode);
      return 0;
    }
    case 'drill':
      return isFuel(item) ? fuelAccept(e.burner, item, mode) : 0;
    case 'inserter':
      return mode === 'player' && isFuel(item) ? e.burner.fuel.space(item) : 0;
    case 'belt':
      return 0;
  }
}

function fuelAccept(b: Burner, item: string, mode: 'machine' | 'inserter' | 'player'): number {
  const space = b.fuel.space(item);
  if (mode !== 'inserter') return space;
  const ins = entityDef('burner-inserter') as InserterDef;
  return Math.max(0, Math.min(space, ins.fuelInsertLimit - b.fuel.count(item)));
}

/** Fügt Items in ein Gebäude ein (ohne Bänder). Gibt eingefügte Menge zurück. */
export function insertInto(e: Entity, item: string, amount: number, mode: 'machine' | 'inserter' | 'player'): number {
  const n = Math.min(amount, acceptAmount(e, item, mode));
  if (n <= 0) return 0;
  switch (e.kind) {
    case 'furnace':
      return smeltingRecipeFor(item) ? e.source.add(item, n) : e.burner.fuel.add(item, n);
    case 'drill':
    case 'inserter':
      return e.burner.fuel.add(item, n);
    case 'belt':
      return 0;
  }
}

/** Alle Inhalte eines Gebäudes (beim Abbauen an den Spieler). */
export function entityContents(e: Entity): { item: string; count: number }[] {
  const out: { item: string; count: number }[] = [];
  const add = (inv: Inventory) => out.push(...inv.contents());
  switch (e.kind) {
    case 'drill':
      add(e.burner.fuel);
      if (e.output) out.push({ item: e.output, count: 1 });
      break;
    case 'furnace':
      add(e.burner.fuel);
      add(e.source);
      add(e.result);
      if (e.recipe) for (const ing of e.recipe.ingredients) out.push({ item: ing.item, count: ing.amount });
      break;
    case 'inserter':
      add(e.burner.fuel);
      if (e.held) out.push({ item: e.held, count: 1 });
      break;
    case 'belt':
      break;
  }
  return out;
}

export function stackSize(item: string): number {
  return ITEMS[item]?.stackSize ?? 1;
}
