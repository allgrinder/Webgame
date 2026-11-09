import { CHART } from '../../data/chart';
import type { CombinatorDef, RadarDef, RailDef, RocketSiloDef, TrainStopDef } from '../../data/entities';
import { ITEMS } from '../../data/items';
import { MODULES, isModule } from '../../data/modules';
import { RECIPES } from '../../data/recipes';
import { secondsToTicks, wattsToJoulesPerTick } from '../../data/time';
import { ElectricSource } from '../energy';
import { Status } from '../entity';
import type { Dir } from '../geom';
import { type InvData, Inventory, type Stack } from '../inventory';
import { type Effects, consumptionFactor, moduleInventory, productivityBonus, speedFactor } from '../modules';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode, invContents } from './base';

const PART = RECIPES['rocket-part'];
/** Weltraum-Wissenschaft je Satellit (Wiki „Satellite“). */
const PACKS_PER_SATELLITE = 1000;

/**
 * Raketensilo: stellt Raketenteile her (10 Leichtbauteile, 10 Prozessoren, 10 Raketentreibstoff, 3 s), 100 Teile
 * ergeben eine Rakete. Mit Satellit startet sie automatisch, sofern ein Fracht-Landeplatz existiert; ~29 s später
 * landen 1000 Weltraum-Wissenschaftspakete dort. Ein zweiter Satz Teile darf schon gebaut werden (Wiki „Rocket silo“).
 */
export class RocketSiloEntity extends EntityBase {
  readonly kind = 'rocket-silo' as const;
  declare readonly def: RocketSiloDef;
  readonly energy: ElectricSource;
  readonly input: Inventory;
  readonly satellite = new Inventory(1, (it) => it === 'satellite');
  readonly modules: Inventory | null;
  readonly effects: Effects = { speed: 0, productivity: 0, consumption: 0 };
  /** Teile für die nächste Rakete; fertige Rakete steht bereit. */
  parts = 0;
  rocketReady = false;
  /** Laufender Start: Tick des Starts (−1: keiner) und ob ein Satellit an Bord ist. */
  launchAt = -1;
  payload = false;
  crafting = false;
  progress = 0;
  bonus = 0;
  workTicks = 0;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = new ElectricSource(jpt, 0, jpt * 2);
    this.input = new Inventory(3, (it) => PART.ingredients.some((g) => g.item === it));
    this.modules = moduleInventory(this.def.moduleSlots ?? 0);
  }

  get recipeTicks(): number {
    return secondsToTicks(PART.time / this.def.craftingSpeed);
  }

  override update(w: World): void {
    if (this.modules) {
      w.beacons.effects(w, this, this.effects);
      this.energy.setFactor(consumptionFactor(this.effects));
    }
    // Start und Lieferung
    if (this.launchAt >= 0) {
      const t = w.tick - this.launchAt;
      if (t >= this.def.deliveryTicks) {
        if (this.payload) {
          const pad = [...w.entities.values()].find((e) => e.kind === 'container' && e.def.cargoPad);
          if (pad && pad.kind === 'container') {
            const n = pad.inventory.add('space-science-pack', PACKS_PER_SATELLITE);
            w.crafted('space-science-pack', n);
          }
        }
        this.launchAt = -1;
        this.payload = false;
      }
    }
    if (this.rocketReady && this.launchAt < 0 && this.satellite.count('satellite') > 0) {
      const hasPad = [...w.entities.values()].some((e) => e.kind === 'container' && e.def.cargoPad);
      if (hasPad) {
        this.satellite.remove('satellite', 1);
        w.stats.used('satellite', 1);
        w.stats.used('rocket-part', this.def.partsPerRocket);
        this.payload = true;
        this.rocketReady = false;
        this.launchAt = w.tick;
        w.rocketsLaunched++;
      }
    }
    // Teile bauen (bis eine Rakete bereitsteht und die nächste ebenfalls vollständig ist)
    if (this.rocketReady && this.parts >= this.def.partsPerRocket) {
      this.status = Status.OutputBlocked;
      return;
    }
    if (!this.crafting) {
      if (!PART.ingredients.every((g) => this.input.count(g.item) >= g.amount)) {
        this.status = this.launchAt >= 0 ? Status.Working : Status.NoInput;
        return;
      }
      for (const g of PART.ingredients) {
        this.input.remove(g.item, g.amount);
        w.stats.used(g.item, g.amount);
      }
      this.crafting = true;
    }
    if (!this.energy.consume(this.energy.usagePerTick)) {
      this.status = Status.NoPower;
      return;
    }
    this.status = Status.Working;
    this.workTicks++;
    this.progress += speedFactor(this.effects);
    if (this.progress >= this.recipeTicks) {
      this.progress -= this.recipeTicks;
      this.crafting = false;
      let n = 1;
      this.bonus += productivityBonus(this.effects);
      if (this.bonus >= 1) {
        this.bonus -= 1;
        n = 2;
      }
      this.parts += n;
      w.crafted('rocket-part', n);
      if (!this.rocketReady && this.parts >= this.def.partsPerRocket) {
        this.parts -= this.def.partsPerRocket;
        this.rocketReady = true;
      }
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    if (item === 'satellite') return this.satellite.space(item);
    if (this.modules && isModule(item)) return mode === 'player' && MODULES[item] ? this.modules.space(item) : 0;
    const g = PART.ingredients.find((x) => x.item === item);
    if (!g) return 0;
    const have = this.input.count(item);
    const cap = Math.max(0, (ITEMS[item]?.stackSize ?? 1) - have);
    if (mode !== 'inserter') return Math.min(cap, this.input.space(item));
    return Math.max(0, Math.min(cap, g.amount * 2 - have));
  }
  protected override doInsert(item: string, n: number): number {
    if (item === 'satellite') return this.satellite.add(item, n);
    if (this.modules && isModule(item)) return this.modules.add(item, n);
    return this.input.add(item, n);
  }
  override contents(): Stack[] {
    return invContents(this.input, this.satellite, ...(this.modules ? [this.modules] : []));
  }
  override guiSlots(): GuiSlots[] {
    return [
      { label: 'Zutaten', inv: this.input },
      { label: 'Nutzlast', inv: this.satellite },
      ...(this.modules ? [{ label: 'Module', inv: this.modules }] : []),
    ];
  }
  override save() {
    return {
      ...this.energy.serialize(), in: this.input.serialize(), sat: this.satellite.serialize(), mod: this.modules?.serialize(),
      parts: this.parts, ready: this.rocketReady, la: this.launchAt, pl: this.payload, cr: this.crafting, pr: this.progress, bo: this.bonus,
      work: this.workTicks,
    };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    this.input.load(d.in as InvData);
    this.satellite.load(d.sat as InvData);
    if (this.modules && d.mod) this.modules.load(d.mod as InvData);
    this.parts = (d.parts as number) ?? 0;
    this.rocketReady = !!d.ready;
    this.launchAt = (d.la as number) ?? -1;
    this.payload = !!d.pl;
    this.crafting = !!d.cr;
    this.progress = (d.pr as number) ?? 0;
    this.bonus = (d.bo as number) ?? 0;
    this.workTicks = (d.work as number) ?? 0;
  }
}

/**
 * Radar (Wiki „Radar“): deckt mit Strom 7×7 Abschnitte ständig auf und erkundet ferne Abschnitte
 * (je 10 MJ einer, bei 300 kW alle 33,3 s). Verbindet außerdem Schaltungsnetze drahtlos mit allen anderen Radaren.
 */
export class RadarEntity extends EntityBase {
  readonly kind = 'radar' as const;
  declare readonly def: RadarDef;
  readonly energy: ElectricSource;
  workTicks = 0;
  /** Gesammelte Energie für die nächste Fernerkundung (J). */
  scan = 0;
  /** Zuletzt erkundeter Abschnitt (Anzeige). */
  lastScan: [number, number] | null = null;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = new ElectricSource(jpt, 0, jpt * 2);
  }
  override update(w: World): void {
    if (this.energy.consume(this.energy.usagePerTick)) {
      this.status = Status.Working;
      this.workTicks++;
      this.scan += this.energy.usagePerTick;
      if (this.scan >= CHART.scanEnergy) {
        this.scan -= CHART.scanEnergy;
        this.lastScan = w.chart.scanFrom(this.cx, this.cy, w.tick);
      }
    } else this.status = Status.NoPower;
  }
  override save() {
    return { ...this.energy.serialize(), work: this.workTicks, sc: this.scan };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    this.workTicks = (d.work as number) ?? 0;
    this.scan = (d.sc as number) ?? 0;
  }
}

/** Kombinator: Logik im Schaltungsnetz (src/sim/circuit.ts); hier nur Strom und Status. */
export class CombinatorEntity extends EntityBase {
  readonly kind = 'combinator' as const;
  declare readonly def: CombinatorDef;
  readonly energy: ElectricSource | null;
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = jpt > 0 ? new ElectricSource(jpt, 0, jpt * 2) : null;
  }
  override onCreated(w: World): void {
    if (!w.circuit.settings.has(this.id)) {
      w.circuit.settings.set(this.id, this.def.mode === 'constant' ? { signals: [] }
        : this.def.mode === 'arithmetic' ? { arith: { first: null, op: '*', constant: 1, second: null, output: null } }
          : { decide: { first: null, op: '>', constant: 0, second: null, output: null, copyCount: false } });
    }
  }
  override update(): void {
    if (!this.energy) {
      this.status = Status.Working;
      return;
    }
    this.status = this.energy.consume(this.energy.usagePerTick) ? Status.Working : Status.NoPower;
  }
  override save() {
    return this.energy ? this.energy.serialize() : {};
  }
  override load(d: Record<string, unknown>): void {
    this.energy?.load(d as { eb: number });
  }
}

/** Gleis (Geometrie in src/sim/rails.ts). */
export class RailEntity extends EntityBase {
  readonly kind = 'rail' as const;
  declare readonly def: RailDef;
}

/** Bahnhof mit Namen (Fahrpläne fahren Namen an). */
export class TrainStopEntity extends EntityBase {
  readonly kind = 'train-stop' as const;
  declare readonly def: TrainStopDef;
  stationName = '';
  override onCreated(w: World): void {
    if (!this.stationName) this.stationName = `Bahnhof ${[...w.entities.values()].filter((e) => e.kind === 'train-stop').length}`;
  }
  override save() {
    return { nm: this.stationName };
  }
  override load(d: Record<string, unknown>): void {
    this.stationName = (d.nm as string) ?? this.stationName;
  }
}
