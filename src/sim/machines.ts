/**
 * Schnittstelle zu den Gebäudeklassen (src/sim/entities/) für Welt, Renderer, HUD und Tests.
 */
import { ITEMS, ITEM_IDS } from '../data/items';
import type { InsertMode } from './entities/base';
import { BeltEntity, ContainerEntity, DrillEntity, FurnaceEntity } from './entities/basic';
import { HALF_TURN, InserterEntity, InserterPhase } from './entities/inserter';

export { BeltEntity, ContainerEntity, DrillEntity, FurnaceEntity, HALF_TURN, InserterEntity, InserterPhase };
export type { InsertMode };

export type Entity = BeltEntity | DrillEntity | FurnaceEntity | InserterEntity | ContainerEntity;

export function itemIndex(id: string): number {
  const i = ITEM_IDS.indexOf(id);
  if (i < 0) throw new Error(`Unbekanntes Item ${id}`);
  return i;
}
export function itemId(index: number): string {
  return ITEM_IDS[index];
}

export function acceptAmount(e: Entity, item: string, mode: InsertMode): number {
  return e.acceptAmount(item, mode);
}

export function insertInto(e: Entity, item: string, amount: number, mode: InsertMode): number {
  return e.insert(item, amount, mode);
}

export function entityContents(e: Entity): { item: string; count: number }[] {
  return e.contents();
}

export function stackSize(item: string): number {
  return ITEMS[item]?.stackSize ?? 1;
}
