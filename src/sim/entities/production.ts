import { type AssemblerDef, type InserterDef, type LabDef, entityDef } from '../../data/entities';
import { ITEMS } from '../../data/items';
import { RECIPES, type RecipeDef } from '../../data/recipes';
import { TECH_BY_ID } from '../../data/tech';
import { secondsToTicks, wattsToJoulesPerTick } from '../../data/time';
import { ElectricSource } from '../energy';
import { Status } from '../entity';
import type { Dir } from '../geom';
import { type InvData, Inventory, type Stack } from '../inventory';
import { ResearchSystem } from '../research';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode, invContents } from './base';

/** Füllgrenze für Greifarme: so viele Herstellvorgänge im Voraus (wie beim Ofen). */
function inserterLimitCrafts(): number {
  return (entityDef('burner-inserter') as InserterDef).ingredientLimitCrafts;
}

function electric(usageW: number, drainW: number): ElectricSource {
  const jpt = wattsToJoulesPerTick(usageW);
  return new ElectricSource(jpt, wattsToJoulesPerTick(drainW), jpt * 2);
}

/**
 * Montagemaschine: stellt ein gewähltes Handwerksrezept her. Zutaten kommen per Greifarm oder vom Spieler,
 * das Ergebnis holt ein Greifarm ab. Elektrisch; bei Strommangel anteilig langsamer.
 */
export class AssemblerEntity extends EntityBase {
  readonly kind = 'assembler' as const;
  declare readonly def: AssemblerDef;
  readonly energy: ElectricSource;
  recipe: RecipeDef | null = null;
  input = new Inventory(0);
  readonly output = new Inventory(1);
  /** Läuft gerade ein Herstellvorgang (Zutaten bereits entnommen)? */
  crafting = false;
  progress = 0;
  /** Arbeitsticks (Animation). */
  workTicks = 0;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.energy = electric(this.def.energyUsage, this.def.drain);
  }

  recipeTicks(r: RecipeDef): number {
    return Math.max(1, secondsToTicks(r.time / this.def.craftingSpeed));
  }

  /** Rezept wählen. Gibt Zutaten, Ergebnis und laufende Zutaten zurück (für den Spieler). */
  setRecipe(id: string | null): Stack[] {
    const out = this.contents();
    this.recipe = id ? RECIPES[id] ?? null : null;
    if (this.recipe && this.recipe.category !== 'crafting') this.recipe = null;
    const r = this.recipe;
    this.input = r ? new Inventory(r.ingredients.length, (it) => r.ingredients.some((g) => g.item === it)) : new Inventory(0);
    this.output.slots.fill(null);
    this.crafting = false;
    this.progress = 0;
    return out;
  }

  override update(): void {
    const r = this.recipe;
    if (!r) {
      this.status = Status.Idle;
      return;
    }
    if (!this.crafting) {
      for (const res of r.results) {
        // nicht weiterarbeiten, solange mehr als ein Ergebnis wartet
        if (this.output.space(res.item) < res.amount || this.output.count(res.item) >= res.amount * 2) {
          this.status = Status.OutputBlocked;
          return;
        }
      }
      if (!r.ingredients.every((g) => this.input.count(g.item) >= g.amount)) {
        this.status = Status.NoInput;
        return;
      }
      for (const g of r.ingredients) this.input.remove(g.item, g.amount);
      this.crafting = true;
      this.progress = 0;
    }
    if (!this.energy.consume(this.energy.usagePerTick)) {
      this.status = Status.NoPower;
      return;
    }
    this.status = Status.Working;
    this.workTicks++;
    if (++this.progress >= this.recipeTicks(r)) {
      for (const res of r.results) this.output.add(res.item, res.amount);
      this.crafting = false;
      this.progress = 0;
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    const g = this.recipe?.ingredients.find((x) => x.item === item);
    if (!g) return 0;
    const have = this.input.count(item);
    const cap = Math.max(0, (ITEMS[item]?.stackSize ?? 1) - have);
    if (mode !== 'inserter') return Math.min(cap, this.input.space(item));
    const limit = Math.max(g.amount * inserterLimitCrafts(), g.amount + 1);
    return Math.max(0, Math.min(cap, limit - have));
  }
  protected override doInsert(item: string, n: number): number {
    return this.input.add(item, n);
  }
  override take(_w: World, accept: (item: string) => boolean): string | null {
    const it = this.output.firstItem(accept);
    if (!it) return null;
    this.output.remove(it, 1);
    return it;
  }
  override contents(): Stack[] {
    const out = invContents(this.input, this.output);
    if (this.crafting && this.recipe) for (const g of this.recipe.ingredients) out.push({ item: g.item, count: g.amount });
    return out;
  }
  override guiSlots(): GuiSlots[] {
    return [
      { label: 'Zutaten', inv: this.input },
      { label: 'Ergebnis', inv: this.output },
    ];
  }
  override save() {
    return {
      ...this.energy.serialize(), recipe: this.recipe?.id ?? null, in: this.input.serialize(), out: this.output.serialize(),
      cr: this.crafting, progress: this.progress, work: this.workTicks,
    };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    this.setRecipe((d.recipe as string | null) ?? null);
    this.input.load(d.in as InvData);
    this.output.load(d.out as InvData);
    this.crafting = !!d.cr;
    this.progress = (d.progress as number) ?? 0;
    this.workTicks = (d.work as number) ?? 0;
  }
}

/**
 * Labor: verbraucht Wissenschaftspakete für die aktuelle Forschung. Pro Einheit je ein Paket jeder
 * benötigten Sorte, danach time Sekunden Laborarbeit (Forschungsgeschwindigkeit 1, Module gibt es nicht).
 */
export class LabEntity extends EntityBase {
  readonly kind = 'lab' as const;
  declare readonly def: LabDef;
  readonly energy: ElectricSource;
  readonly packs: Inventory;
  /** Noch zu leistende Ticks der bezahlten Einheit und deren Technologie. */
  remaining = 0;
  paidFor: string | null = null;
  workTicks = 0;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.energy = electric(this.def.energyUsage, this.def.drain);
    const inputs = this.def.inputs;
    this.packs = new Inventory(inputs.length, (it) => inputs.includes(it));
  }

  override update(w: World): void {
    const t = w.research.currentTech;
    if (!t) {
      this.status = Status.NoTarget;
      return;
    }
    if (!t.packs.every((p) => this.def.inputs.includes(p))) {
      this.status = Status.NoTarget;
      return;
    }
    if (this.paidFor !== t.id) {
      this.remaining = 0;
      this.paidFor = null;
    }
    if (this.remaining <= 0) {
      if (!t.packs.every((p) => this.packs.count(p) > 0)) {
        this.status = Status.NoInput;
        return;
      }
      for (const p of t.packs) this.packs.remove(p, 1);
      this.remaining = ResearchSystem.unitTicks(t);
      this.paidFor = t.id;
    }
    if (!this.energy.consume(this.energy.usagePerTick)) {
      this.status = Status.NoPower;
      return;
    }
    this.status = Status.Working;
    this.remaining--;
    this.workTicks++;
    w.research.addWork(1);
    if (!w.research.current || w.research.current !== t.id) {
      this.remaining = 0;
      this.paidFor = null;
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    if (!this.def.inputs.includes(item)) return 0;
    const have = this.packs.count(item);
    const cap = Math.max(0, (ITEMS[item]?.stackSize ?? 1) - have);
    if (mode !== 'inserter') return Math.min(cap, this.packs.space(item));
    return Math.max(0, Math.min(cap, inserterLimitCrafts() - have));
  }
  protected override doInsert(item: string, n: number): number {
    return this.packs.add(item, n);
  }
  override contents(): Stack[] {
    return invContents(this.packs);
  }
  override guiSlots(): GuiSlots[] {
    return [{ label: 'Wissenschaftspakete', inv: this.packs }];
  }
  override save() {
    return { ...this.energy.serialize(), packs: this.packs.serialize(), rem: this.remaining, paid: this.paidFor, work: this.workTicks };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    this.packs.load(d.packs as InvData);
    this.remaining = (d.rem as number) ?? 0;
    this.paidFor = (d.paid as string | null) ?? null;
    this.workTicks = (d.work as number) ?? 0;
    if (this.paidFor && !TECH_BY_ID[this.paidFor]) this.paidFor = null;
  }
}
