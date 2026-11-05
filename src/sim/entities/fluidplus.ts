import type { FluidPumpDef, LampDef, PipeGroundDef, PumpjackDef, TankDef } from '../../data/entities';
import { FLUID_UNIT } from '../../data/fluids';
import { DAY, wattsToJoulesPerTick } from '../../data/time';
import { ElectricSource } from '../energy';
import { Status } from '../entity';
import { DX, DY, type Dir, opposite, rotCW } from '../geom';
import { FluidBox, type FluidHolder, type FluidPort } from '../fluids';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode } from './base';
import { isModule } from '../../data/modules';
import { type InvData, Inventory, type Stack } from '../inventory';
import { type Effects, consumptionFactor, moduleInventory, productivityBonus, speedFactor } from '../modules';
import { boxData, loadBox, rotateLocal } from './power';

// ------------------------------------------------------------------------- Rohr unterirdisch

/**
 * Rohr unterirdisch: offener Anschluss in Richtung dir, unter der Erde verbunden mit dem nächsten
 * Gegenstück in Gegenrichtung (höchstens maxDistance Felder, Wiki: 10 → 9 Felder Lücke).
 */
export class PipeGroundEntity extends EntityBase implements FluidHolder {
  readonly kind = 'pipe-ground' as const;
  declare readonly def: PipeGroundDef;
  readonly box: FluidBox;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.box = new FluidBox(this.def.capacity * FLUID_UNIT, null);
  }
  fluidBoxes(): FluidBox[] {
    return [this.box];
  }
  fluidPorts(): FluidPort[] {
    return [{ box: this.box, tx: this.x, ty: this.y, dir: this.dir }];
  }
  /** Gegenstück unter der Erde (nächstes Rohr unterirdisch in Gegenrichtung, das zu uns zeigt). */
  partner(w: World): PipeGroundEntity | null {
    const d = opposite(this.dir);
    for (let k = 1; k <= this.def.maxDistance; k++) {
      const e = w.entityAt(this.x + DX[d] * k, this.y + DY[d] * k);
      if (e?.kind !== 'pipe-ground') continue;
      if (e.dir === d) return e;
      if (e.dir === this.dir) return null; // gleichgerichtetes Rohr dazwischen trennt
    }
    return null;
  }
  fluidLinks(w: World): FluidBox[] {
    const p = this.partner(w);
    return p && p.partner(w) === this ? [p.box] : [];
  }
  override save() {
    return { fb: boxData(this.box) };
  }
  override load(d: Record<string, unknown>): void {
    loadBox(this.box, d.fb);
  }
}

// ------------------------------------------------------------------------- Pumpe

/** Pumpe 1×2: zieht hinten an und drückt vorn hinaus (20 Einheiten/Tick = 1200/s), elektrisch. */
export class FluidPumpEntity extends EntityBase implements FluidHolder {
  readonly kind = 'pump' as const;
  declare readonly def: FluidPumpDef;
  readonly input: FluidBox;
  readonly output: FluidBox;
  readonly energy: ElectricSource;
  workTicks = 0;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.input = new FluidBox((this.def.capacity / 2) * FLUID_UNIT, null);
    this.output = new FluidBox((this.def.capacity / 2) * FLUID_UNIT, null);
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = new ElectricSource(jpt, 0, jpt * 2);
  }
  fluidBoxes(): FluidBox[] {
    return [this.input, this.output];
  }
  fluidPorts(): FluidPort[] {
    const port = (box: FluidBox, lx: number, ly: number, d: Dir): FluidPort => {
      const [rx, ry] = rotateLocal(lx, ly, this.def.width, this.def.height, this.dir);
      return { box, tx: this.x + rx, ty: this.y + ry, dir: rotCW(d, this.dir) };
    };
    return [port(this.output, 0, 0, 0), port(this.input, 0, 1, 2)];
  }
  override update(w: World): void {
    if (!w.circuit.enabled(this.id)) {
      this.status = Status.Disabled;
      return;
    }
    const a = this.input.net;
    const b = this.output.net;
    if (!a || !b || !a.fluid || a.amount === 0) {
      this.status = Status.NoInput;
      return;
    }
    const n = Math.min(this.def.pumpingSpeed * FLUID_UNIT, a.amount, b.space(a.fluid));
    if (n <= 0) {
      this.status = Status.OutputBlocked;
      return;
    }
    if (!this.energy.consume(this.energy.usagePerTick)) {
      this.status = Status.NoPower;
      return;
    }
    const f = a.fluid;
    b.add(f, a.take(f, n));
    this.status = Status.Working;
    this.workTicks++;
  }
  override save() {
    return { ...this.energy.serialize(), i: boxData(this.input), o: boxData(this.output), work: this.workTicks };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    loadBox(this.input, d.i);
    loadBox(this.output, d.o);
    this.workTicks = (d.work as number) ?? 0;
  }
}

// ------------------------------------------------------------------------- Lagertank

/** Lagertank 3×3 (25.000 Einheiten), Anschlüsse an zwei gegenüberliegenden Ecken. */
export class TankEntity extends EntityBase implements FluidHolder {
  readonly kind = 'tank' as const;
  declare readonly def: TankDef;
  readonly box: FluidBox;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.box = new FluidBox(this.def.capacity * FLUID_UNIT, null);
  }
  fluidBoxes(): FluidBox[] {
    return [this.box];
  }
  fluidPorts(): FluidPort[] {
    const port = (lx: number, ly: number, d: Dir): FluidPort => {
      const [rx, ry] = rotateLocal(lx, ly, 3, 3, this.dir);
      return { box: this.box, tx: this.x + rx, ty: this.y + ry, dir: rotCW(d, this.dir) };
    };
    return [port(0, 0, 0), port(0, 0, 3), port(2, 2, 2), port(2, 2, 1)];
  }
  override save() {
    return { fb: boxData(this.box) };
  }
  override load(d: Record<string, unknown>): void {
    loadBox(this.box, d.fb);
  }
}

// ------------------------------------------------------------------------- Lampe

/** Lampe: leuchtet mit Strom (5 kW). */
export class LampEntity extends EntityBase {
  readonly kind = 'lamp' as const;
  declare readonly def: LampDef;
  readonly energy: ElectricSource;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = new ElectricSource(jpt, 0, jpt * 2);
  }
  /** Nachts eingeschaltet (verbraucht dann Strom). */
  override update(w: World): void {
    if (w.darkness < DAY.lampOn || !w.circuit.enabled(this.id)) {
      this.status = Status.Idle;
      return;
    }
    this.status = this.energy.consume(this.energy.usagePerTick) ? Status.Working : Status.NoPower;
  }
  override save() {
    return { ...this.energy.serialize() };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
  }
}

// ------------------------------------------------------------------------- Pumpjack

/**
 * Pumpjack 3×3 auf einer Ölquelle (Mitte): fördert je Zyklus (1 s bei Geschwindigkeit 1) 10 × Ergiebigkeit
 * Einheiten; je 300 Zyklen sinkt die Ergiebigkeit um 1 %, bis höchstens 20 % des Anfangswerts bzw. 20 %.
 * Quelle: Wiki „Pumpjack“.
 */
export class PumpjackEntity extends EntityBase implements FluidHolder {
  readonly kind = 'pumpjack' as const;
  declare readonly def: PumpjackDef;
  readonly box: FluidBox;
  readonly energy: ElectricSource;
  /** Ticks im aktuellen Zyklus, Zykluszähler, Rest der Ausgabe (Tausendstel). */
  progress = 0;
  cycles = 0;
  private acc = 0;
  workTicks = 0;
  readonly modules: Inventory | null;
  readonly effects: Effects = { speed: 0, productivity: 0, consumption: 0 };
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.box = new FluidBox(this.def.capacity * FLUID_UNIT, 'crude-oil');
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = new ElectricSource(jpt, 0, jpt * 2);
    this.modules = moduleInventory(this.def.moduleSlots ?? 0);
  }
  fluidBoxes(): FluidBox[] {
    return [this.box];
  }
  fluidPorts(): FluidPort[] {
    const [rx, ry] = rotateLocal(2, 0, 3, 3, this.dir);
    return [{ box: this.box, tx: this.x + rx, ty: this.y + ry, dir: rotCW(0, this.dir) }];
  }
  override update(w: World): void {
    if (this.modules) {
      w.beacons.effects(w, this, this.effects);
      this.energy.setFactor(consumptionFactor(this.effects));
    }
    const tx = this.x + 1;
    const ty = this.y + 1;
    const r = w.map.resourceAt(tx, ty);
    if (r.amount <= 0) {
      this.status = Status.Depleted;
      return;
    }
    const net = this.box.net;
    // Ausgabe je Tick: Ergiebigkeit (Tausendstel %) × 10 Einheiten / 100 % / 60 Ticks, in Tausendstel Einheiten
    const sp = speedFactor(this.effects);
    // Module: Geschwindigkeit verkürzt den Zyklus, Produktivität gibt zusätzliches Öl
    const perTickNum = Math.round(r.amount * this.def.miningSpeed * sp * (1 + productivityBonus(this.effects))); // Zähler, Nenner 600
    if (!net || net.space('crude-oil') < Math.ceil(perTickNum / 600) + 1) {
      this.status = Status.OutputBlocked;
      return;
    }
    if (!this.energy.consume(this.energy.usagePerTick)) {
      this.status = Status.NoPower;
      return;
    }
    this.acc += perTickNum;
    const n = Math.floor(this.acc / 600);
    this.acc -= n * 600;
    net.add('crude-oil', n);
    w.stats.made('crude-oil', n / FLUID_UNIT);
    this.status = Status.Working;
    this.workTicks++;
    this.progress += sp;
    if (this.progress >= 60) {
      this.progress -= 60;
      this.cycles++;
      w.research.onCrafted('crude-oil', 1);
      // Erschöpfung: 1 % je 300 Zyklen = 1000/300 Tausendstel-% je Zyklus (3,333…)
      const dec = this.cycles % 3 === 0 ? 4 : 3;
      const min = Math.max(20_000, Math.floor(w.map.originalAmount(tx, ty) * 0.2));
      const next = Math.max(min, r.amount - dec);
      if (next !== r.amount) w.map.setResource(tx, ty, r.res, next);
    }
  }
  override save() {
    return {
      ...this.energy.serialize(), fb: boxData(this.box), pr: this.progress, cy: this.cycles, acc: this.acc, work: this.workTicks,
      ...(this.modules ? { mod: this.modules.serialize() } : {}),
    };
  }
  override acceptAmount(item: string, mode: InsertMode): number {
    return this.modules && isModule(item) && mode === 'player' ? this.modules.space(item) : 0;
  }
  protected override doInsert(item: string, n: number): number {
    return this.modules && isModule(item) ? this.modules.add(item, n) : 0;
  }
  override contents(): Stack[] {
    return this.modules ? this.modules.contents() : [];
  }
  override guiSlots(): GuiSlots[] {
    return this.modules ? [{ label: 'Module', inv: this.modules }] : [];
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    loadBox(this.box, d.fb);
    this.progress = (d.pr as number) ?? 0;
    this.cycles = (d.cy as number) ?? 0;
    this.acc = (d.acc as number) ?? 0;
    this.workTicks = (d.work as number) ?? 0;
    if (this.modules && d.mod) this.modules.load(d.mod as InvData);
  }
}
