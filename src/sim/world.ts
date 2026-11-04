import { type EntityDef, entityDef } from '../data/entities';
import { isFuel } from '../data/items';
import { type RecipeDef, smeltingRecipeFor } from '../data/recipes';
import { RESOURCE_BY_INDEX } from '../data/resources';
import { BeltSystem } from './belts';
import { Status } from './entity';
import { type Dir, rotateVec, tileKey } from './geom';
import {
  type BeltEntity,
  DrillEntity,
  type Entity,
  FurnaceEntity,
  HALF_TURN,
  InserterEntity,
  InserterPhase,
  acceptAmount,
  entityContents,
  insertInto,
  itemId,
  itemIndex,
} from './machines';
import { GameMap } from './map';
import type { Player } from './player';

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
  /** Vorhandenes Band wird nur gedreht. */
  replace?: number;
}

/**
 * Die gesamte Simulation. Kennt weder DOM noch PixiJS.
 * step() rückt genau einen Tick (1/60 s) vor.
 */
export class World {
  tick = 0;
  readonly map: GameMap;
  readonly belts = new BeltSystem();
  readonly entities = new Map<number, Entity>();
  private readonly occupancy = new Map<number, number>();
  nextId = 1;
  player: Player | null = null;
  /** Wird bei jeder Gebäudeänderung erhöht (Renderer). */
  structureVersion = 0;

  constructor(readonly seed: number) {
    this.map = new GameMap(seed);
  }

  // ------------------------------------------------------------ Abfragen

  entityAt(x: number, y: number): Entity | undefined {
    const id = this.occupancy.get(tileKey(Math.floor(x), Math.floor(y)));
    return id === undefined ? undefined : this.entities.get(id);
  }

  static footprint(def: EntityDef, x: number, y: number): [number, number][] {
    const out: [number, number][] = [];
    for (let j = 0; j < def.height; j++) for (let i = 0; i < def.width; i++) out.push([x + i, y + j]);
    return out;
  }

  canPlace(name: string, x: number, y: number, dir: Dir): PlaceCheck {
    const def = entityDef(name);
    if (def.kind === 'belt') {
      const e = this.entityAt(x, y);
      if (e && e.kind === 'belt') return e.dir === dir ? { ok: false, reason: 'Gleiches Band' } : { ok: true, replace: e.id };
    }
    for (const [tx, ty] of World.footprint(def, x, y)) {
      if (this.occupancy.has(tileKey(tx, ty))) return { ok: false, reason: 'Belegt' };
    }
    if (def.solid && this.player && this.player.overlapsRect(x, y, def.width, def.height)) {
      return { ok: false, reason: 'Spieler im Weg' };
    }
    if (def.kind === 'drill') {
      const tmp = new DrillEntity(0, name, x, y, dir);
      if (!tmp.areaTiles().some(([tx, ty]) => this.map.resourceAt(tx, ty).amount > 0)) {
        return { ok: false, reason: 'Keine Ressourcen' };
      }
    }
    return { ok: true };
  }

  // ------------------------------------------------------------ Bauen

  place(name: string, x: number, y: number, dir: Dir, force = false): Entity | null {
    const chk = this.canPlace(name, x, y, dir);
    if (chk.replace !== undefined) {
      const e = this.entities.get(chk.replace)!;
      e.dir = dir;
      this.belts.setDir(e.id, dir);
      this.structureVersion++;
      return e;
    }
    if (!chk.ok && !force) return null;
    return this.create(this.nextId++, name, x, y, dir);
  }

  /** Legt ein Gebäude mit fester ID an (auch beim Laden). */
  create(id: number, name: string, x: number, y: number, dir: Dir): Entity {
    const def = entityDef(name);
    let e: Entity;
    switch (def.kind) {
      case 'belt':
        e = { kind: 'belt', id, name, x, y, dir, status: Status.Idle } satisfies BeltEntity;
        this.belts.add(id, x, y, dir);
        break;
      case 'drill':
        e = new DrillEntity(id, name, x, y, dir);
        break;
      case 'furnace':
        e = new FurnaceEntity(id, name, x, y, dir);
        break;
      case 'inserter':
        e = new InserterEntity(id, name, x, y, dir);
        break;
    }
    this.entities.set(id, e);
    for (const [tx, ty] of World.footprint(def, x, y)) this.occupancy.set(tileKey(tx, ty), id);
    if (id >= this.nextId) this.nextId = id + 1;
    this.structureVersion++;
    return e;
  }

  rotate(id: number, dir: Dir): boolean {
    const e = this.entities.get(id);
    if (!e || !entityDef(e.name).rotatable) return false;
    e.dir = dir;
    if (e.kind === 'belt') this.belts.setDir(id, dir);
    this.structureVersion++;
    return true;
  }

  /** Entfernt ein Gebäude und liefert alle Items (inkl. Gebäude-Item und Bandinhalt). */
  remove(id: number): { item: string; count: number }[] {
    const e = this.entities.get(id);
    if (!e) return [];
    const def = entityDef(e.name);
    const out: { item: string; count: number }[] = [{ item: def.item, count: 1 }];
    if (e.kind === 'belt') {
      for (const idx of this.belts.remove(id)) out.push({ item: itemId(idx), count: 1 });
    } else out.push(...entityContents(e));
    this.entities.delete(id);
    for (const [tx, ty] of World.footprint(def, e.x, e.y)) this.occupancy.delete(tileKey(tx, ty));
    this.structureVersion++;
    return out;
  }

  // ------------------------------------------------------------ Simulation

  step(): void {
    this.belts.update();
    for (const e of this.entities.values()) {
      switch (e.kind) {
        case 'drill': this.updateDrill(e); break;
        case 'furnace': this.updateFurnace(e); break;
        case 'inserter': this.updateInserter(e); break;
        case 'belt': break;
      }
    }
    this.player?.update(this);
    this.tick++;
  }

  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  /** Item an einen Weltpunkt abgeben (Band, Ofen, Bohrer). */
  private deliverAt(px: number, py: number, item: string, mode: 'machine' | 'inserter'): boolean {
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    const target = this.entityAt(tx, ty);
    if (!target) return false;
    if (target.kind === 'belt') {
      const t = this.belts.tileById(target.id)!;
      return this.belts.insertAtPoint(t, px - tx, py - ty, itemIndex(item));
    }
    return insertInto(target, item, 1, mode) === 1;
  }

  drillOutputPoint(e: DrillEntity): [number, number] {
    const [vx, vy] = rotateVec(e.def.outputVector[0], e.def.outputVector[1], e.dir);
    return [e.x + e.def.width / 2 + vx, e.y + e.def.height / 2 + vy];
  }

  private updateDrill(e: DrillEntity): void {
    if (e.output) {
      const [px, py] = this.drillOutputPoint(e);
      if (!this.deliverAt(px, py, e.output, 'machine')) {
        e.status = Status.OutputBlocked;
        return;
      }
      e.output = null;
    }
    const area = e.areaTiles();
    let idx = -1;
    for (let k = 0; k < area.length; k++) {
      const c = (e.cursor + k) % area.length;
      if (this.map.resourceAt(area[c][0], area[c][1]).amount > 0) {
        idx = c;
        break;
      }
    }
    if (idx < 0) {
      e.status = Status.Depleted;
      return;
    }
    if (!e.burner.consume(e.joulesPerTick)) {
      e.status = Status.NoFuel;
      return;
    }
    e.status = Status.Working;
    e.progress++;
    e.workTicks++;
    const [tx, ty] = area[idx];
    const res = this.map.resourceAt(tx, ty).res;
    if (e.progress >= e.ticksPerItem(res)) {
      e.progress = 0;
      const mined = this.map.mineOne(tx, ty);
      e.cursor = (idx + 1) % area.length;
      if (mined) {
        e.output = RESOURCE_BY_INDEX[mined]!.result;
        const [px, py] = this.drillOutputPoint(e);
        if (this.deliverAt(px, py, e.output, 'machine')) e.output = null;
      }
    }
  }

  private updateFurnace(e: FurnaceEntity): void {
    if (!e.recipe) {
      const ing = e.source.firstItem();
      if (!ing) {
        e.status = Status.NoInput;
        return;
      }
      const r = this.smelting(ing);
      const res = r.results[0];
      if (e.result.space(res.item) < res.amount) {
        e.status = Status.OutputBlocked;
        return;
      }
      if (!e.burner.canSupply(e.joulesPerTick)) {
        e.status = Status.NoFuel;
        return;
      }
      if (e.source.count(ing) < r.ingredients[0].amount) {
        e.status = Status.NoInput;
        return;
      }
      e.source.remove(ing, r.ingredients[0].amount);
      e.recipe = r;
      e.progress = 0;
    }
    if (!e.burner.consume(e.joulesPerTick)) {
      e.status = Status.NoFuel;
      return;
    }
    e.status = Status.Working;
    e.progress++;
    e.workTicks++;
    if (e.progress >= e.recipeTicks(e.recipe)) {
      for (const r of e.recipe.results) e.result.add(r.item, r.amount);
      e.recipe = null;
      e.progress = 0;
    }
  }

  private smelting(item: string): RecipeDef {
    const r = smeltingRecipeFor(item);
    if (!r) throw new Error(`Kein Schmelzrezept für ${item}`);
    return r;
  }

  inserterPoints(e: InserterEntity): { pickup: [number, number]; drop: [number, number] } {
    const cx = e.x + 0.5;
    const cy = e.y + 0.5;
    const [px, py] = rotateVec(e.def.pickupVector[0], e.def.pickupVector[1], e.dir);
    const [dx, dy] = rotateVec(e.def.dropVector[0], e.def.dropVector[1], e.dir);
    return { pickup: [cx + px, cy + py], drop: [cx + dx, cy + dy] };
  }

  private updateInserter(e: InserterEntity): void {
    const { pickup, drop } = this.inserterPoints(e);
    const dst = this.entityAt(drop[0], drop[1]);
    const half = e.halfSwingEnergy;
    // Drehbudget dieses Ticks; Rest wird bei sofortigem Phasenwechsel weitergegeben.
    let budget = e.turnPerTick;
    for (let guard = 0; guard < 6; guard++) {
      switch (e.phase) {
        case InserterPhase.WaitPickup: {
          if (!dst || dst.kind === 'inserter') {
            e.status = Status.NoTarget;
            return;
          }
          const src = this.entityAt(pickup[0], pickup[1]);
          // Selbstversorgung: leerer Brennstoffslot -> eigenen Brennstoff greifen
          if (e.burner.fuel.isEmpty() && src) {
            const fuel = this.takeFrom(src, (it) => isFuel(it));
            if (fuel) {
              e.burner.fuel.add(fuel, 1);
              e.status = Status.Working;
              return;
            }
          }
          if (!e.burner.canSupply(half)) {
            e.status = Status.NoFuel;
            return;
          }
          const accept = (it: string) => dst.kind === 'belt' || acceptAmount(dst, it, 'inserter') > 0;
          const item = src ? this.takeFrom(src, accept) : null;
          if (!item) {
            e.status = Status.NoInput;
            return;
          }
          e.burner.consume(half);
          e.held = item;
          e.phase = InserterPhase.ToDrop;
          e.progress = 0;
          e.status = Status.Working;
          continue;
        }
        case InserterPhase.ToDrop:
        case InserterPhase.ToPickup: {
          const step = Math.min(budget, HALF_TURN - e.progress);
          e.progress += step;
          budget -= step;
          if (e.progress < HALF_TURN) return;
          e.progress = 0;
          e.phase = e.phase === InserterPhase.ToDrop ? InserterPhase.WaitDrop : InserterPhase.WaitPickup;
          continue;
        }
        case InserterPhase.WaitDrop: {
          if (e.held) {
            if (!dst || !this.deliverAt(drop[0], drop[1], e.held, 'inserter')) {
              e.status = dst ? Status.OutputBlocked : Status.NoTarget;
              return;
            }
            e.held = null;
          }
          if (!e.burner.consume(half)) {
            e.status = Status.NoFuel;
            return;
          }
          e.status = Status.Working;
          e.phase = InserterPhase.ToPickup;
          e.progress = 0;
          continue;
        }
      }
    }
  }

  /** Nimmt ein passendes Item aus einem Gebäude (für Greifarme). */
  private takeFrom(src: Entity, accept: (item: string) => boolean): string | null {
    if (src.kind === 'belt') {
      const t = this.belts.tileById(src.id)!;
      const idx = this.belts.takeFromTile(t, (i) => accept(itemId(i)));
      return idx < 0 ? null : itemId(idx);
    }
    if (src.kind === 'furnace') {
      const it = src.result.firstItem(accept);
      if (it) {
        src.result.remove(it, 1);
        return it;
      }
    }
    return null;
  }
}
