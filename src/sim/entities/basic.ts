import { type BeltDef, type ContainerDef, type DrillDef, type FurnaceDef, type InserterDef, insertionLimitCrafts } from '../../data/entities';
import { entityDef } from '../../data/entities';
import { isFuel } from '../../data/items';
import { type RecipeDef, RECIPES, smeltingRecipeFor } from '../../data/recipes';
import { RESOURCE_BY_INDEX } from '../../data/resources';
import { secondsToTicks, wattsToJoulesPerTick } from '../../data/time';
import { Burner } from '../burner';
import { ElectricSource } from '../energy';
import { Status } from '../entity';
import { type Dir, rotateVec } from '../geom';
import { Inventory, type Stack } from '../inventory';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode, invContents } from './base';
import { isModule, PRODUCTIVITY_RECIPES } from '../../data/modules';
import { type Effects, consumptionFactor, moduleInventory, productivityBonus, speedFactor } from '../modules';

type InvData = ReturnType<Inventory['serialize']>;
type BurnerData = ReturnType<Burner['serialize']>;

export function fuelAccept(b: Burner, item: string, mode: InsertMode): number {
  if (!isFuel(item)) return 0;
  const space = b.fuel.space(item);
  if (mode !== 'inserter') return space;
  const ins = entityDef('burner-inserter') as InserterDef;
  return Math.max(0, Math.min(space, ins.fuelInsertLimit - b.fuel.count(item)));
}

// ------------------------------------------------------------------------- Band

export class BeltEntity extends EntityBase {
  readonly kind = 'belt' as const;
  declare readonly def: BeltDef;
  override onCreated(w: World): void {
    w.belts.add(this.id, this.x, this.y, this.dir, { speed: this.def.speed });
  }
}

// ------------------------------------------------------------------------- Bohrer

export class DrillEntity extends EntityBase {
  readonly kind = 'drill' as const;
  declare readonly def: DrillDef;
  readonly energy: Burner | ElectricSource;
  /** Fortschritt in Ticks für das aktuelle Erz. */
  progress = 0;
  /** Fertig abgebautes, noch nicht ausgegebenes Item. */
  output: string | null = null;
  /** Reihum-Zeiger über die Felder des Abbaubereichs. */
  cursor = 0;
  /** Animationsphase (nur Darstellung, zählt Arbeitsticks). */
  workTicks = 0;
  readonly modules: Inventory | null;
  readonly effects: Effects = { speed: 0, productivity: 0, consumption: 0 };
  /** Produktivitätsbalken (Bergbau). */
  bonus = 0;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    const jpt = wattsToJoulesPerTick(this.def.energyUsage);
    this.energy = this.def.energy === 'electric' ? new ElectricSource(jpt, 0, jpt * 2) : new Burner(this.def.fuelSlots);
    this.modules = moduleInventory(this.def.moduleSlots ?? 0);
  }
  override get burner(): Burner | null {
    return this.energy instanceof Burner ? this.energy : null;
  }
  get joulesPerTick(): number {
    return wattsToJoulesPerTick(this.def.energyUsage);
  }
  ticksPerItem(resIndex: number): number {
    const r = RESOURCE_BY_INDEX[resIndex]!;
    return secondsToTicks(r.miningTime / this.def.miningSpeed);
  }
  areaTiles(): [number, number][] {
    const size = this.def.miningAreaSize;
    const ox = this.x + (this.w - size) / 2;
    const oy = this.y + (this.h - size) / 2;
    const out: [number, number][] = [];
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) out.push([Math.floor(ox + i), Math.floor(oy + j)]);
    return out;
  }
  outputPoint(): [number, number] {
    const [vx, vy] = rotateVec(this.def.outputVector[0], this.def.outputVector[1], this.dir);
    return [this.cx + vx, this.cy + vy];
  }

  override update(w: World): void {
    if (this.modules) {
      w.beacons.effects(w, this, this.effects);
      if (this.energy instanceof ElectricSource) this.energy.setFactor(consumptionFactor(this.effects));
    }
    if (this.output) {
      const [px, py] = this.outputPoint();
      if (!w.deliverAt(px, py, this.output, 'machine', false)) {
        this.status = Status.OutputBlocked;
        return;
      }
      this.output = null;
    }
    const area = this.areaTiles();
    let idx = -1;
    for (let k = 0; k < area.length; k++) {
      const c = (this.cursor + k) % area.length;
      const r = w.map.resourceAt(area[c][0], area[c][1]);
      if (r.amount > 0 && !RESOURCE_BY_INDEX[r.res]?.fluid) {
        idx = c;
        break;
      }
    }
    if (idx < 0) {
      this.status = Status.Depleted;
      return;
    }
    if (!this.energy.consume(this.energy instanceof ElectricSource ? this.energy.usagePerTick : this.joulesPerTick)) {
      this.status = this.energy.type === 'electric' ? Status.NoPower : Status.NoFuel;
      return;
    }
    this.status = Status.Working;
    this.progress += this.modules ? speedFactor(this.effects) : 1;
    this.workTicks++;
    const [tx, ty] = area[idx];
    const res = w.map.resourceAt(tx, ty).res;
    const need = this.ticksPerItem(res);
    if (this.progress >= need) {
      this.progress = this.modules ? this.progress - need : 0;
      const mined = w.map.mineOne(tx, ty);
      this.cursor = (idx + 1) % area.length;
      if (mined) {
        this.output = RESOURCE_BY_INDEX[mined]!.result;
        w.stats.made(this.output, 1);
        const [px, py] = this.outputPoint();
        if (w.deliverAt(px, py, this.output, 'machine', false)) this.output = null;
        // Produktivität: zusätzliches Erz ohne Abbau des Feldes (wird beim nächsten Tick ausgegeben)
        if (this.modules && !this.output) {
          this.bonus += productivityBonus(this.effects);
          if (this.bonus >= 1) {
            this.bonus -= 1;
            this.output = RESOURCE_BY_INDEX[mined]!.result;
            w.stats.made(this.output, 1);
          }
        }
      }
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    if (this.modules && isModule(item)) return mode === 'player' ? this.modules.space(item) : 0;
    const b = this.burner;
    return b ? fuelAccept(b, item, mode) : 0;
  }
  protected override doInsert(item: string, n: number): number {
    if (this.modules && isModule(item)) return this.modules.add(item, n);
    return this.burner?.fuel.add(item, n) ?? 0;
  }
  override contents(): Stack[] {
    const b = this.burner;
    const out = b ? invContents(b.fuel) : [];
    if (this.modules) out.push(...this.modules.contents());
    if (this.output) out.push({ item: this.output, count: 1 });
    return out;
  }
  override guiSlots(): GuiSlots[] {
    const b = this.burner;
    return [...(b ? [{ label: 'Brennstoff', inv: b.fuel }] : []), ...(this.modules ? [{ label: 'Module', inv: this.modules }] : [])];
  }
  override save() {
    const en = this.energy instanceof Burner ? { b: this.energy.serialize() } : this.energy.serialize();
    return {
      ...en, progress: this.progress, output: this.output, cursor: this.cursor, work: this.workTicks,
      ...(this.modules ? { mod: this.modules.serialize(), bo: this.bonus } : {}),
    };
  }
  override load(d: Record<string, unknown>): void {
    if (this.energy instanceof Burner) this.energy.load(d.b as BurnerData);
    else this.energy.load(d as { eb: number });
    if (this.modules && d.mod) this.modules.load(d.mod as InvData);
    this.bonus = (d.bo as number) ?? 0;
    this.progress = d.progress as number;
    this.output = (d.output as string | null) ?? null;
    this.cursor = d.cursor as number;
    this.workTicks = (d.work as number) ?? 0;
  }
}

// ------------------------------------------------------------------------- Ofen

export class FurnaceEntity extends EntityBase {
  readonly kind = 'furnace' as const;
  declare readonly def: FurnaceDef;
  private readonly fuelSource: Burner;
  /** Elektrischer Ofen: Strom statt Brennstoff. */
  readonly energy: Burner | ElectricSource;
  readonly source: Inventory;
  readonly result = new Inventory(1);
  recipe: RecipeDef | null = null;
  progress = 0;
  workTicks = 0;
  readonly modules: Inventory | null;
  readonly effects: Effects = { speed: 0, productivity: 0, consumption: 0 };
  bonus = 0;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.modules = moduleInventory(this.def.moduleSlots ?? 0);
    this.fuelSource = new Burner(this.def.fuelSlots);
    this.energy = this.def.energy === 'electric' ? new ElectricSource(this.joulesPerTick, wattsToJoulesPerTick(this.def.drain ?? 0), this.joulesPerTick * 2) : this.fuelSource;
    this.source = new Inventory(1, (i) => !!smeltingRecipeFor(i));
  }
  private unlocked: (recipe: string) => boolean = () => true;
  override onCreated(w: World): void {
    this.unlocked = (r) => w.research.recipeUnlocked(r);
  }
  /** Schmelzrezept für ein Item, sofern freigeschaltet (Stahl erst nach Stahlverarbeitung). */
  private smeltFor(item: string): RecipeDef | undefined {
    const r = smeltingRecipeFor(item);
    return r && this.unlocked(r.id) ? r : undefined;
  }
  override get burner(): Burner | null {
    return this.energy instanceof Burner ? this.fuelSource : null;
  }
  get joulesPerTick(): number {
    return wattsToJoulesPerTick(this.def.energyUsage);
  }
  recipeTicks(r: RecipeDef): number {
    return secondsToTicks(r.time / this.def.craftingSpeed);
  }
  /** Energie je Tick (elektrisch mit Modulfaktor). */
  private get usage(): number {
    return this.energy instanceof ElectricSource ? this.energy.usagePerTick : this.joulesPerTick;
  }

  override update(w: World): void {
    if (this.modules) {
      w.beacons.effects(w, this, this.effects);
      if (this.energy instanceof ElectricSource) this.energy.setFactor(consumptionFactor(this.effects));
    }
    if (!this.recipe) {
      const ing = this.source.firstItem();
      if (!ing) {
        this.status = Status.NoInput;
        return;
      }
      const r = this.smeltFor(ing);
      if (!r) {
        this.status = Status.NoInput;
        return;
      }
      const res = r.results[0];
      if (this.result.space(res.item) < res.amount) {
        this.status = Status.OutputBlocked;
        return;
      }
      if (!this.energy.canSupply(this.usage)) {
        this.status = this.energy instanceof Burner ? Status.NoFuel : Status.NoPower;
        return;
      }
      if (this.source.count(ing) < r.ingredients[0].amount) {
        this.status = Status.NoInput;
        return;
      }
      this.source.remove(ing, r.ingredients[0].amount);
      w.stats.used(ing, r.ingredients[0].amount);
      this.recipe = r;
    }
    if (!this.energy.consume(this.usage)) {
      this.status = this.energy instanceof Burner ? Status.NoFuel : Status.NoPower;
      return;
    }
    this.status = Status.Working;
    this.progress += this.modules ? speedFactor(this.effects) : 1;
    this.workTicks++;
    const need = this.recipeTicks(this.recipe);
    if (this.progress >= need) {
      let times = 1;
      if (this.modules && PRODUCTIVITY_RECIPES.has(this.recipe.id)) {
        this.bonus += productivityBonus(this.effects);
        if (this.bonus >= 1) {
          this.bonus -= 1;
          times = 2;
        }
      }
      for (let k = 0; k < times; k++) {
        for (const r of this.recipe.results) {
          this.result.add(r.item, r.amount);
          w.crafted(r.item, r.amount);
        }
      }
      this.recipe = null;
      this.progress = this.modules ? this.progress - need : 0;
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    if (this.modules && isModule(item)) return mode === 'player' ? this.modules.space(item) : 0;
    const r = this.smeltFor(item);
    if (r) {
      // nicht mischen: anderes Erz nur, wenn der Zutatenslot leer ist
      const cur = this.source.firstItem();
      if (cur && cur !== item) return 0;
      const space = this.source.space(item);
      if (mode !== 'inserter') return space;
      return Math.max(0, Math.min(space, insertionLimitCrafts(r.time / this.def.craftingSpeed) * r.ingredients[0].amount - this.source.count(item)));
    }
    return this.energy instanceof Burner ? fuelAccept(this.fuelSource, item, mode) : 0;
  }
  protected override doInsert(item: string, n: number): number {
    if (this.modules && isModule(item)) return this.modules.add(item, n);
    return smeltingRecipeFor(item) ? this.source.add(item, n) : this.fuelSource.fuel.add(item, n);
  }
  override take(_w: World, accept: (item: string) => boolean): string | null {
    const it = this.result.firstItem(accept);
    if (!it) return null;
    this.result.remove(it, 1);
    return it;
  }
  override contents(): Stack[] {
    const out = invContents(this.fuelSource.fuel, this.source, this.result, ...(this.modules ? [this.modules] : []));
    if (this.recipe) for (const ing of this.recipe.ingredients) out.push({ item: ing.item, count: ing.amount });
    return out;
  }
  override guiSlots(): GuiSlots[] {
    return [
      { label: 'Zutat', inv: this.source },
      ...(this.energy instanceof Burner ? [{ label: 'Brennstoff', inv: this.fuelSource.fuel }] : []),
      { label: 'Ergebnis', inv: this.result },
      ...(this.modules ? [{ label: 'Module', inv: this.modules }] : []),
    ];
  }
  override save() {
    return {
      b: this.fuelSource.serialize(), ...(this.energy instanceof ElectricSource ? this.energy.serialize() : {}), src: this.source.serialize(), res: this.result.serialize(),
      recipe: this.recipe?.id ?? null, progress: this.progress, work: this.workTicks,
      ...(this.modules ? { mod: this.modules.serialize(), bo: this.bonus } : {}),
    };
  }
  override load(d: Record<string, unknown>): void {
    this.fuelSource.load(d.b as BurnerData);
    if (this.energy instanceof ElectricSource) this.energy.load(d as { eb: number });
    this.source.load(d.src as InvData);
    this.result.load(d.res as InvData);
    this.recipe = d.recipe ? RECIPES[d.recipe as string] : null;
    this.progress = d.progress as number;
    this.workTicks = (d.work as number) ?? 0;
    if (this.modules && d.mod) this.modules.load(d.mod as InvData);
    this.bonus = (d.bo as number) ?? 0;
  }
}

// ------------------------------------------------------------------------- Kiste

export class ContainerEntity extends EntityBase {
  readonly kind = 'container' as const;
  declare readonly def: ContainerDef;
  readonly inventory: Inventory;
  /** Anforderungen (Anforderungs- und Pufferkiste): Item → Sollmenge. */
  readonly requests: { item: string; count: number }[] = [];
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.inventory = new Inventory(this.def.slots);
  }
  get logistic(): ContainerDef['logistic'] {
    return this.def.logistic;
  }
  override acceptAmount(item: string): number {
    return this.inventory.space(item);
  }
  protected override doInsert(item: string, n: number): number {
    return this.inventory.add(item, n);
  }
  override take(_w: World, accept: (item: string) => boolean): string | null {
    // letzter belegter Slot zuerst (wie beim Vorbild: Greifarme nehmen von hinten)
    for (let i = this.inventory.slots.length - 1; i >= 0; i--) {
      const s = this.inventory.slots[i];
      if (s && accept(s.item)) {
        const it = s.item;
        this.inventory.remove(it, 1);
        return it;
      }
    }
    return null;
  }
  override contents(): Stack[] {
    return invContents(this.inventory);
  }
  override guiSlots(): GuiSlots[] {
    return [{ label: 'Inhalt', inv: this.inventory }];
  }
  override save() {
    return { inv: this.inventory.serialize(), ...(this.requests.length ? { rq: this.requests.map((r) => [r.item, r.count]) } : {}) };
  }
  override load(d: Record<string, unknown>): void {
    this.inventory.load(d.inv as InvData);
    this.requests.length = 0;
    for (const [item, count] of (d.rq as [string, number][] | undefined) ?? []) this.requests.push({ item, count });
  }
}
