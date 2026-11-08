import type { HeatExchangerDef, HeatPipeDef, ReactorDef } from '../../data/entities';
import { FLUID_UNIT, steamEnergyPerUnit } from '../../data/fluids';
import { ITEMS } from '../../data/items';
import { wattsToJoulesPerTick } from '../../data/time';
import { Status } from '../entity';
import { DX, DY, type Dir, rotCW } from '../geom';
import { Inventory, type InvData, type Stack } from '../inventory';
import { FluidBox, type FluidHolder, type FluidPort } from '../fluids';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode, invContents } from './base';
import { boxData, loadBox, rotateLocal } from './power';

/** Wärmeknoten (Wiki „Heat pipe“): Wärmemenge über 15 °C, Wärmekapazität in J/°C. */
export interface HeatNode {
  readonly id: number;
  heat: number;
  readonly heatCapacity: number;
  readonly maxTemperature: number;
  /** Felder mit Wärmeanschluss: [x, y, Richtung nach außen]. */
  heatConnections(): [number, number, Dir][];
}

export const AMBIENT = 15;

export function temperatureOf(n: HeatNode): number {
  return AMBIENT + n.heat / n.heatCapacity;
}

export function isHeatNode(e: unknown): e is HeatNode {
  return typeof (e as HeatNode | null)?.heatConnections === 'function';
}

/** Alle Randfelder einer Grundfläche mit Richtung nach außen. */
function edgeConnections(x: number, y: number, w: number, h: number): [number, number, Dir][] {
  const out: [number, number, Dir][] = [];
  for (let i = 0; i < w; i++) {
    out.push([x + i, y, 0]);
    out.push([x + i, y + h - 1, 2]);
  }
  for (let j = 0; j < h; j++) {
    out.push([x, y + j, 3]);
    out.push([x + w - 1, y + j, 1]);
  }
  return out;
}

// ------------------------------------------------------------------------- Kernreaktor

const CELL = 'uranium-fuel-cell';
const DEPLETED = 'depleted-uranium-fuel-cell';

export class ReactorEntity extends EntityBase implements HeatNode {
  readonly kind = 'reactor' as const;
  declare readonly def: ReactorDef;
  readonly fuel = new Inventory(1, (it) => it === CELL);
  readonly spent = new Inventory(1, (it) => it === DEPLETED);
  heat = 0;
  /** Restenergie des brennenden Brennstabs (J). */
  burning = 0;
  /** Benachbarte laufende Reaktoren (vom Wärmenetz gesetzt). */
  neighbours = 0;
  workTicks = 0;
  get heatCapacity(): number {
    return this.def.heatCapacity;
  }
  get maxTemperature(): number {
    return this.def.maxTemperature;
  }
  get temperature(): number {
    return temperatureOf(this);
  }
  get active(): boolean {
    return this.burning > 0;
  }
  heatConnections(): [number, number, Dir][] {
    return edgeConnections(this.x, this.y, this.w, this.h);
  }
  /** Wärmeleistung je Tick (J) mit Nachbarbonus (+100 % je laufendem Nachbarn, Wiki). */
  get heatPerTick(): number {
    return wattsToJoulesPerTick(this.def.consumption) * (1 + this.neighbours);
  }
  override update(w: World): void {
    if (this.burning <= 0) {
      // neuen Brennstab nur, wenn der abgebrannte Platz hat (Wiki: sonst steht der Reaktor)
      if (this.fuel.count(CELL) > 0 && this.spent.space(DEPLETED) > 0) {
        this.fuel.remove(CELL, 1);
        w.stats.used(CELL, 1);
        this.burning = ITEMS[CELL]!.fuelValue!;
      } else {
        this.status = this.fuel.count(CELL) > 0 ? Status.OutputBlocked : Status.NoFuel;
        return;
      }
    }
    // Der Reaktor brennt unabhängig vom Wärmebedarf; überschüssige Wärme über 1000 °C geht verloren
    const use = Math.min(this.burning, wattsToJoulesPerTick(this.def.consumption));
    this.burning -= use;
    const add = use * (1 + this.neighbours);
    this.heat = Math.min(this.heatCapacity * (this.maxTemperature - AMBIENT), this.heat + add);
    if (this.burning <= 0) {
      this.burning = 0;
      this.spent.add(DEPLETED, 1);
      w.crafted(DEPLETED, 1);
    }
    this.status = Status.Working;
    this.workTicks++;
  }
  override acceptAmount(item: string, _mode: InsertMode): number {
    return item === CELL ? this.fuel.space(item) : 0;
  }
  protected override doInsert(item: string, n: number): number {
    return this.fuel.add(item, n);
  }
  override take(_w: World, accept: (item: string) => boolean): string | null {
    // Greifarme holen abgebrannte Brennstäbe heraus
    if (this.spent.count(DEPLETED) > 0 && accept(DEPLETED)) {
      this.spent.remove(DEPLETED, 1);
      return DEPLETED;
    }
    return null;
  }
  override contents(): Stack[] {
    return [...invContents(this.fuel), ...invContents(this.spent)];
  }
  override guiSlots(): GuiSlots[] {
    return [{ label: 'Brennstab', inv: this.fuel }, { label: 'Abgebrannt', inv: this.spent }];
  }
  override save() {
    return { h: this.heat, b: this.burning, f: this.fuel.serialize(), s: this.spent.serialize(), work: this.workTicks };
  }
  override load(d: Record<string, unknown>): void {
    this.heat = (d.h as number) ?? 0;
    this.burning = (d.b as number) ?? 0;
    this.fuel.load((d.f as InvData) ?? []);
    this.spent.load((d.s as InvData) ?? []);
    this.workTicks = (d.work as number) ?? 0;
  }
}

// ------------------------------------------------------------------------- Wärmerohr

export class HeatPipeEntity extends EntityBase implements HeatNode {
  readonly kind = 'heat-pipe' as const;
  declare readonly def: HeatPipeDef;
  heat = 0;
  get heatCapacity(): number {
    return this.def.heatCapacity;
  }
  get maxTemperature(): number {
    return this.def.maxTemperature;
  }
  get temperature(): number {
    return temperatureOf(this);
  }
  heatConnections(): [number, number, Dir][] {
    return [[this.x, this.y, 0], [this.x, this.y, 1], [this.x, this.y, 2], [this.x, this.y, 3]];
  }
  override update(): void {
    this.status = this.temperature >= 500 ? Status.Working : Status.Idle;
  }
  override save() {
    return { h: this.heat };
  }
  override load(d: Record<string, unknown>): void {
    this.heat = (d.h as number) ?? 0;
  }
}

// ------------------------------------------------------------------------- Wärmetauscher

export class HeatExchangerEntity extends EntityBase implements HeatNode, FluidHolder {
  readonly kind = 'heat-exchanger' as const;
  declare readonly def: HeatExchangerDef;
  readonly water: FluidBox;
  readonly steam: FluidBox;
  heat = 0;
  workTicks = 0;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.water = new FluidBox(this.def.capacity * FLUID_UNIT, this.def.inputFluid);
    this.steam = new FluidBox(this.def.capacity * FLUID_UNIT, this.def.outputFluid);
  }
  get heatCapacity(): number {
    return this.def.heatCapacity;
  }
  get maxTemperature(): number {
    return this.def.maxTemperature;
  }
  get temperature(): number {
    return temperatureOf(this);
  }
  /** Wärmeeingang: Mitte der hinteren Reihe, nach hinten (gegenüber dem Dampfausgang, wie die Feuerung des Kessels). */
  heatConnections(): [number, number, Dir][] {
    const [rx, ry] = rotateLocal(1, this.def.height - 1, this.def.width, this.def.height, this.dir);
    return [[this.x + rx, this.y + ry, rotCW(2, this.dir)]];
  }
  get joulesPerTick(): number {
    return wattsToJoulesPerTick(this.def.energyUsage);
  }
  get steamPerTick(): number {
    return Math.round((this.joulesPerTick * FLUID_UNIT) / steamEnergyPerUnit(this.def.targetTemperature));
  }
  fluidBoxes(): FluidBox[] {
    return [this.water, this.steam];
  }
  fluidPorts(): FluidPort[] {
    const { width: w, height: h } = this.def;
    const port = (box: FluidBox, lx: number, ly: number, d: Dir): FluidPort => {
      const [rx, ry] = rotateLocal(lx, ly, w, h, this.dir);
      return { box, tx: this.x + rx, ty: this.y + ry, dir: rotCW(d, this.dir) };
    };
    // wie der Kessel: Dampf oben Mitte, Wasser an beiden Schmalseiten unten
    return [port(this.steam, 1, 0, 0), port(this.water, 0, 1, 3), port(this.water, w - 1, 1, 1)];
  }
  override update(w: World): void {
    // nur Wärme oberhalb von 500 °C ist nutzbar (Wiki)
    const usable = this.heat - this.heatCapacity * (this.def.minTemperature - 15);
    if (usable <= 0) {
      this.status = Status.NoFuel;
      return;
    }
    const wn = this.water.net;
    const sn = this.steam.net;
    const full = this.steamPerTick;
    const amt = sn ? Math.min(full, sn.space(this.def.outputFluid), Math.floor((usable / this.joulesPerTick) * full)) : 0;
    const water = Math.ceil(amt / this.def.steamPerWater);
    if (!wn || wn.fluid !== this.def.inputFluid || wn.amount < Math.max(1, water)) {
      this.status = Status.NoInput;
      return;
    }
    if (!sn || amt <= 0) {
      this.status = Status.Idle;
      return;
    }
    this.heat -= Math.ceil((this.joulesPerTick * amt) / full);
    wn.take(this.def.inputFluid, water);
    sn.add(this.def.outputFluid, amt);
    w.stats.made(this.def.outputFluid, amt / FLUID_UNIT);
    this.status = Status.Working;
    this.workTicks++;
  }
  override save() {
    return { h: this.heat, w: boxData(this.water), s: boxData(this.steam), work: this.workTicks };
  }
  override load(d: Record<string, unknown>): void {
    this.heat = (d.h as number) ?? 0;
    loadBox(this.water, d.w);
    loadBox(this.steam, d.s);
    this.workTicks = (d.work as number) ?? 0;
  }
}

/** Nachbarfeld einer Wärmeverbindung. */
export function across(c: [number, number, Dir]): [number, number] {
  return [c[0] + DX[c[2]], c[1] + DY[c[2]]];
}
