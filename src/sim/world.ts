import { type EntityDef, entityDef, sizeOf } from '../data/entities';
import { BeltSystem } from './belts';
import type { InsertMode } from './entities/base';
import { ENTITY_CLASSES } from './entities/registry';
import { type Dir, tileKey } from './geom';
import { DrillEntity, type Entity, itemId, itemIndex } from './machines';
import { FluidSystem } from './fluids';
import { GameMap } from './map';
import { PowerSystem } from './power';
import { ResearchSystem } from './research';
import type { Player } from './player';

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
  /** Vorhandenes Band wird nur gedreht. */
  replace?: number;
}

/** Item auf dem Boden (Position in 1/256 Feldern). */
export interface GroundItem {
  item: string;
  x: number;
  y: number;
}

/** Mindestabstand zweier Items auf dem Boden (Felder). */
const GROUND_SPACING = 0.28;

/**
 * Die gesamte Simulation. Kennt weder DOM noch PixiJS.
 * step() rückt genau einen Tick (1/60 s) vor.
 */
export class World {
  tick = 0;
  readonly map: GameMap;
  readonly belts = new BeltSystem();
  readonly fluids = new FluidSystem();
  readonly power = new PowerSystem();
  readonly research = new ResearchSystem();
  readonly entities = new Map<number, Entity>();
  private readonly occupancy = new Map<number, number>();
  /** Items auf dem Boden je Feld. */
  readonly ground = new Map<number, GroundItem[]>();
  nextId = 1;
  private _player: Player | null = null;
  get player(): Player | null {
    return this._player;
  }
  set player(p: Player | null) {
    this._player = p;
    if (p) {
      p.recipeUnlocked = (r) => this.research.recipeUnlocked(r);
      p.onCrafted = (item, n) => this.research.onCrafted(item, n);
    }
  }
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

  static footprint(def: EntityDef, x: number, y: number, dir = 0): [number, number][] {
    const [w, h] = sizeOf(def, dir);
    const out: [number, number][] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j]);
    return out;
  }

  /** Felder der Uferpumpe: vorn (Ausgang, an Land) und hinten (im Wasser), abhängig von der Richtung. */
  static pumpTiles(x: number, y: number, dir: Dir): { front: [number, number]; back: [number, number] } {
    switch (dir) {
      case 0: return { front: [x, y], back: [x, y + 1] };
      case 1: return { front: [x + 1, y], back: [x, y] };
      case 2: return { front: [x, y + 1], back: [x, y] };
      default: return { front: [x, y], back: [x + 1, y] };
    }
  }

  canPlace(name: string, x: number, y: number, dir: Dir): PlaceCheck {
    const def = entityDef(name);
    if (def.kind === 'belt') {
      const e = this.entityAt(x, y);
      if (e && e.kind === 'belt' && e.name === name) return e.dir === dir ? { ok: false, reason: 'Gleiches Band' } : { ok: true, replace: e.id };
    }
    // Uferpumpe (1×2): vorderes Feld an Land, hinteres im Wasser
    const pumpTiles = def.kind === 'offshore-pump' ? World.pumpTiles(x, y, dir) : null;
    for (const [tx, ty] of World.footprint(def, x, y, dir)) {
      if (this.occupancy.has(tileKey(tx, ty))) return { ok: false, reason: 'Belegt' };
      if (pumpTiles && tx === pumpTiles.back[0] && ty === pumpTiles.back[1]) {
        if (!this.map.isWater(tx, ty)) return { ok: false, reason: 'Hinteres Feld muss im Wasser liegen' };
        continue;
      }
      if (this.map.isWater(tx, ty)) return { ok: false, reason: 'Wasser' };
    }
    const [w, h] = sizeOf(def, dir);
    if (def.solid && this.player && this.player.overlapsRect(x, y, w, h)) {
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
    const e = new ENTITY_CLASSES[def.kind](id, name, x, y, dir) as Entity;
    this.entities.set(id, e);
    for (const [tx, ty] of World.footprint(def, x, y, dir)) this.occupancy.set(tileKey(tx, ty), id);
    e.onCreated(this);
    if (id >= this.nextId) this.nextId = id + 1;
    this.structureVersion++;
    return e;
  }

  rotate(id: number, dir: Dir): boolean {
    const e = this.entities.get(id);
    if (!e || !entityDef(e.name).rotatable) return false;
    if (e.kind === 'underground') {
      e.flip();
      this.structureVersion++;
      return true;
    }
    if (e.def.width !== e.def.height) return false; // nicht quadratisch: zum Drehen neu bauen
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
    if (e.kind === 'belt' || e.kind === 'underground') {
      for (const idx of this.belts.remove(id)) out.push({ item: itemId(idx), count: 1 });
    } else if (e.kind === 'splitter') {
      for (const hid of e.halfIds) for (const idx of this.belts.remove(hid)) out.push({ item: itemId(idx), count: 1 });
    } else out.push(...e.contents());
    e.onRemoved(this);
    this.entities.delete(id);
    for (const [tx, ty] of World.footprint(def, e.x, e.y, e.dir)) this.occupancy.delete(tileKey(tx, ty));
    this.structureVersion++;
    return out;
  }

  // ------------------------------------------------------------ Simulation

  step(): void {
    this.fluids.ensure(this);
    this.power.ensure(this);
    this.power.update();
    this.belts.update();
    for (const e of this.entities.values()) e.update(this);
    this.player?.update(this);
    this.tick++;
  }

  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  /**
   * Item an einen Weltpunkt abgeben: Band (an der Stelle), Gebäude oder – wenn erlaubt – freier Boden.
   */
  deliverAt(px: number, py: number, item: string, mode: InsertMode, allowGround: boolean, from?: { dir: Dir }): boolean {
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    const target = this.entityAt(tx, ty);
    if (!target) return allowGround ? this.dropGround(px, py, item) : false;
    const bt = this.belts.tileAt(tx, ty);
    if (bt) return this.belts.insertAtPoint(bt, px - tx, py - ty, itemIndex(item), from ? BeltSystem.inserterDropLane(bt, from.dir) : undefined);
    return target.insert(item, 1, mode) === 1;
  }

  /** Nimmt ein passendes Item vom Feld an einem Weltpunkt: Band, Gebäude oder Boden. */
  takeAt(px: number, py: number, accept: (item: string) => boolean, from?: { dir: Dir; targetKind?: string }): string | null {
    const src = this.entityAt(px, py);
    if (!src) return this.takeGround(Math.floor(px), Math.floor(py), accept);
    const t = this.belts.tileAt(Math.floor(px), Math.floor(py));
    if (t) {
      const idx = this.belts.takeFromTile(t, (i) => accept(itemId(i)), from ? BeltSystem.inserterPickupLanes(t, from.dir) : undefined);
      return idx < 0 ? null : itemId(idx);
    }
    return src.take(this, accept, from);
  }

  /** Für Renderer und Tests. */
  drillOutputPoint(e: DrillEntity): [number, number] {
    return e.outputPoint();
  }

  // ------------------------------------------------------------ Items auf dem Boden

  /** Legt ein Item auf freien Boden, wenn die Stelle frei ist. */
  dropGround(px: number, py: number, item: string): boolean {
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    if (this.map.isWater(tx, ty) || this.entityAt(tx, ty)) return false;
    const k = tileKey(tx, ty);
    const list = this.ground.get(k) ?? [];
    const x = Math.round(px * 256);
    const y = Math.round(py * 256);
    const min = GROUND_SPACING * 256;
    if (list.some((g) => Math.abs(g.x - x) < min && Math.abs(g.y - y) < min)) return false;
    list.push({ item, x, y });
    this.ground.set(k, list);
    return true;
  }

  takeGround(tx: number, ty: number, accept: (item: string) => boolean = () => true): string | null {
    const k = tileKey(tx, ty);
    const list = this.ground.get(k);
    if (!list) return null;
    const i = list.findIndex((g) => accept(g.item));
    if (i < 0) return null;
    const [g] = list.splice(i, 1);
    if (!list.length) this.ground.delete(k);
    return g.item;
  }

  /** Alle Bodenitems im Umkreis (für Spieler-Aufheben). */
  groundNear(x: number, y: number, r: number): { key: number; g: GroundItem }[] {
    const out: { key: number; g: GroundItem }[] = [];
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        const k = tileKey(tx, ty);
        for (const g of this.ground.get(k) ?? []) {
          if (Math.hypot(g.x / 256 - x, g.y / 256 - y) <= r) out.push({ key: k, g });
        }
      }
    return out;
  }

  removeGround(key: number, g: GroundItem): void {
    const list = this.ground.get(key);
    if (!list) return;
    const i = list.indexOf(g);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.ground.delete(key);
  }
}
