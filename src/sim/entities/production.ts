import { type AssemblerDef, type LabDef, insertionLimitCrafts } from '../../data/entities';
import { ITEMS } from '../../data/items';
import { RECIPES, type RecipeDef } from '../../data/recipes';
import { TECH_BY_ID } from '../../data/tech';
import { secondsToTicks, wattsToJoulesPerTick } from '../../data/time';
import { FLUID_UNIT, isFluid } from '../../data/fluids';
import { ElectricSource } from '../energy';
import { FluidBox, type FluidHolder, type FluidPort } from '../fluids';
import { rotCW } from '../geom';
import { rotateLocal } from './power';
import { Status } from '../entity';
import type { Dir } from '../geom';
import { type InvData, Inventory, type Stack } from '../inventory';
import { ResearchSystem } from '../research';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode, invContents } from './base';


function electric(usageW: number, drainW: number): ElectricSource {
  const jpt = wattsToJoulesPerTick(usageW);
  return new ElectricSource(jpt, wattsToJoulesPerTick(drainW), jpt * 2);
}

/**
 * Montagemaschine: stellt ein gewähltes Handwerksrezept her. Zutaten kommen per Greifarm oder vom Spieler,
 * das Ergebnis holt ein Greifarm ab. Elektrisch; bei Strommangel anteilig langsamer.
 */
export class AssemblerEntity extends EntityBase implements FluidHolder {
  readonly kind = 'assembler' as const;
  declare readonly def: AssemblerDef;
  readonly energy: ElectricSource;
  recipe: RecipeDef | null = null;
  input = new Inventory(0);
  output = new Inventory(1);
  /** Flüssigkeitsbehälter laut Gebäudedaten (Filter je Rezept). */
  readonly boxes: FluidBox[];
  /** Läuft gerade ein Herstellvorgang (Zutaten bereits entnommen)? */
  crafting = false;
  progress = 0;
  /** Arbeitsticks (Animation). */
  workTicks = 0;
  private world: World | null = null;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.energy = electric(this.def.energyUsage, this.def.drain);
    this.boxes = (this.def.fluidBoxes ?? []).map((b) => new FluidBox(b.volume * FLUID_UNIT, '__none'));
  }

  override onCreated(w: World): void {
    this.world = w;
  }

  /** Kann diese Maschine das Rezept herstellen (Kategorie)? */
  canCraft(r: RecipeDef): boolean {
    return this.def.categories.includes(r.category);
  }

  recipeTicks(r: RecipeDef): number {
    return Math.max(1, secondsToTicks(r.time / this.def.craftingSpeed));
  }

  private itemIngredients(r: RecipeDef) {
    return r.ingredients.filter((g) => !isFluid(g.item));
  }
  private itemResults(r: RecipeDef) {
    return r.results.filter((g) => !isFluid(g.item));
  }
  /** Behälter für die Flüssigkeit eines Rezepts (nach Reihenfolge der Eingänge bzw. Ausgänge). */
  private boxFor(r: RecipeDef, fluid: string): FluidBox | undefined {
    const ins = r.ingredients.filter((g) => isFluid(g.item)).map((g) => g.item);
    const outs = r.results.filter((g) => isFluid(g.item)).map((g) => g.item);
    const defs = this.def.fluidBoxes ?? [];
    const pick = (list: string[], type: 'input' | 'output') => {
      const k = list.indexOf(fluid);
      if (k < 0) return undefined;
      const idx = defs.map((d, i) => (d.type === type ? i : -1)).filter((i) => i >= 0)[k];
      return idx === undefined ? undefined : this.boxes[idx];
    };
    return pick(ins, 'input') ?? pick(outs, 'output');
  }

  /** Rezept wählen. Gibt Zutaten, Ergebnis und laufende Zutaten zurück (für den Spieler). */
  setRecipe(id: string | null): Stack[] {
    const out = this.contents();
    let r = id ? RECIPES[id] ?? null : null;
    if (r && !this.canCraft(r)) r = null;
    if (r) {
      // genug passende Behälter für alle Flüssigkeiten?
      const fin = r.ingredients.filter((g) => isFluid(g.item)).length;
      const fout = r.results.filter((g) => isFluid(g.item)).length;
      const defs = this.def.fluidBoxes ?? [];
      if (fin > defs.filter((d) => d.type === 'input').length || fout > defs.filter((d) => d.type === 'output').length) r = null;
    }
    this.recipe = r;
    const ing = r ? this.itemIngredients(r) : [];
    this.input = new Inventory(ing.length, (it) => ing.some((g) => g.item === it));
    this.output = new Inventory(Math.max(1, r ? this.itemResults(r).length : 1));
    for (const b of this.boxes) {
      b.filter = '__none';
      b.amount = 0;
      b.fluid = null;
    }
    if (r) for (const g of [...r.ingredients, ...r.results]) if (isFluid(g.item)) this.boxFor(r, g.item)!.filter = g.item;
    this.crafting = false;
    this.progress = 0;
    if (this.world) this.world.structureVersion++;
    return out;
  }

  fluidBoxes(): FluidBox[] {
    return this.boxes;
  }
  fluidPorts(): FluidPort[] {
    const defs = this.def.fluidBoxes ?? [];
    const out: FluidPort[] = [];
    defs.forEach((d, i) => {
      if (this.boxes[i].filter === '__none') return; // unbenutzte Behälter sind nicht angeschlossen
      for (const [lx, ly, pd] of d.ports) {
        const [rx, ry] = rotateLocal(lx, ly, this.def.width, this.def.height, this.dir);
        out.push({ box: this.boxes[i], tx: this.x + rx, ty: this.y + ry, dir: rotCW(pd, this.dir) });
      }
    });
    return out;
  }

  override update(w: World): void {
    const r = this.recipe;
    if (!r) {
      this.status = Status.Idle;
      return;
    }
    if (!this.crafting) {
      for (const res of r.results) {
        if (isFluid(res.item)) {
          const net = this.boxFor(r, res.item)?.net;
          if (!net || net.space(res.item) < res.amount * FLUID_UNIT) {
            this.status = Status.OutputBlocked;
            return;
          }
        } else if (this.output.space(res.item) < res.amount || this.output.count(res.item) >= res.amount * 2) {
          // nicht weiterarbeiten, solange mehr als ein Ergebnis wartet
          this.status = Status.OutputBlocked;
          return;
        }
      }
      for (const g of r.ingredients) {
        const ok = isFluid(g.item)
          ? (this.boxFor(r, g.item)?.net?.fluid === g.item && this.boxFor(r, g.item)!.net!.amount >= g.amount * FLUID_UNIT)
          : this.input.count(g.item) >= g.amount;
        if (!ok) {
          this.status = Status.NoInput;
          return;
        }
      }
      for (const g of r.ingredients) {
        if (isFluid(g.item)) this.boxFor(r, g.item)!.net!.take(g.item, g.amount * FLUID_UNIT);
        else this.input.remove(g.item, g.amount);
      }
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
      for (const res of r.results) {
        if (isFluid(res.item)) this.boxFor(r, res.item)?.net?.add(res.item, res.amount * FLUID_UNIT);
        else this.output.add(res.item, res.amount);
        w.research.onCrafted(res.item, res.amount);
      }
      this.crafting = false;
      this.progress = 0;
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    const g = this.recipe?.ingredients.find((x) => x.item === item && !isFluid(x.item));
    if (!g) return 0;
    const have = this.input.count(item);
    const cap = Math.max(0, (ITEMS[item]?.stackSize ?? 1) - have);
    if (mode !== 'inserter') return Math.min(cap, this.input.space(item));
    const limit = g.amount * insertionLimitCrafts(this.recipe!.time / this.def.craftingSpeed);
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
    if (this.crafting && this.recipe) for (const g of this.itemIngredients(this.recipe)) out.push({ item: g.item, count: g.amount });
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
      cr: this.crafting, progress: this.progress, work: this.workTicks, fb: this.boxes.map((b) => [b.amount, b.fluid]),
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
    const fb = (d.fb as [number, string | null][] | undefined) ?? [];
    fb.forEach(([a, f], i) => {
      if (this.boxes[i]) {
        this.boxes[i].amount = a;
        this.boxes[i].fluid = f;
      }
    });
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
  private research: ResearchSystem | null = null;

  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.energy = electric(this.def.energyUsage, this.def.drain);
    const inputs = this.def.inputs;
    this.packs = new Inventory(inputs.length, (it) => inputs.includes(it));
  }

  override onCreated(w: World): void {
    this.research = w.research;
  }

  /** Dauer einer Forschungseinheit der aktuellen Technologie (s), 30 s ohne Forschung. */
  private unitSeconds(): number {
    const t = this.research?.currentTech;
    return t ? t.time / this.def.researchSpeed : 30;
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
      if (!this.energy.canSupply(this.energy.usagePerTick)) {
        this.status = Status.NoPower;
        return;
      }
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
    return Math.max(0, Math.min(cap, insertionLimitCrafts(this.unitSeconds()) - have));
  }
  /** Greifarme reichen Pakete an ein weiteres Labor weiter (nur Labor → Labor). */
  override take(_w: World, accept: (item: string) => boolean, by?: { targetKind?: string }): string | null {
    if (by?.targetKind !== 'lab') return null;
    const it = this.packs.firstItem(accept);
    if (!it) return null;
    this.packs.remove(it, 1);
    return it;
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
