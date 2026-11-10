import { ARMORS, EQUIPMENT, type EquipmentDef } from '../data/armor';
import { wattsToJoulesPerTick } from '../data/time';

export interface PlacedEquipment {
  readonly item: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Ausrüstungsraster einer Rüstung (Wiki „Modular armor“): Ausrüstung belegt Rechtecke im Raster.
 * Ein gemeinsamer Energiespeicher (persönliche Akkus + Speicher der persönlichen Roboterhangars) wird von
 * tragbaren Solarmodulen geladen (nur bei Tageslicht) und vom Laden der Roboter geleert.
 */
export class EquipmentGrid {
  readonly items: PlacedEquipment[] = [];
  /** Gespeicherte Energie (J). */
  energy = 0;

  constructor(readonly w: number, readonly h: number) {}

  static forArmor(armor: string): EquipmentGrid | null {
    const a = ARMORS[armor];
    return a && a.gridW > 0 ? new EquipmentGrid(a.gridW, a.gridH) : null;
  }

  private occupied(x: number, y: number): boolean {
    return this.items.some((p) => {
      const d = EQUIPMENT[p.item];
      return x >= p.x && x < p.x + d.w && y >= p.y && y < p.y + d.h;
    });
  }

  fits(item: string, x: number, y: number): boolean {
    const d = EQUIPMENT[item];
    if (!d || x < 0 || y < 0 || x + d.w > this.w || y + d.h > this.h) return false;
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) if (this.occupied(x + i, y + j)) return false;
    return true;
  }

  /** Erster freier Platz (zeilenweise von links oben). */
  findSpot(item: string): [number, number] | null {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.fits(item, x, y)) return [x, y];
    return null;
  }

  /** Einsetzen (ohne Lage: erster freier Platz). */
  place(item: string, x?: number, y?: number): boolean {
    const spot = x !== undefined && y !== undefined ? (this.fits(item, x, y) ? [x, y] : null) : this.findSpot(item);
    if (!spot) return false;
    this.items.push({ item, x: spot[0], y: spot[1] });
    return true;
  }

  /** Ausrüstung am Rasterfeld entnehmen. */
  removeAt(x: number, y: number): string | null {
    const i = this.items.findIndex((p) => {
      const d = EQUIPMENT[p.item];
      return x >= p.x && x < p.x + d.w && y >= p.y && y < p.y + d.h;
    });
    if (i < 0) return null;
    const [p] = this.items.splice(i, 1);
    this.energy = Math.min(this.energy, this.capacity);
    return p.item;
  }

  private defs(): EquipmentDef[] {
    return this.items.map((p) => EQUIPMENT[p.item]);
  }
  get capacity(): number {
    return this.defs().reduce((s, d) => s + (d.capacity ?? 0), 0);
  }
  get roboports(): number {
    return this.defs().filter((d) => d.kind === 'roboport').length;
  }
  get robotLimit(): number {
    return this.defs().reduce((s, d) => s + (d.robots ?? 0), 0);
  }
  get chargers(): number {
    return this.defs().reduce((s, d) => s + (d.chargers ?? 0), 0);
  }
  /** Halbe Kantenlänge der Baufläche: Fläche wächst mit der Zahl der Hangars (Wiki: √(N·30·30)). */
  get constructionRadius(): number {
    const n = this.roboports;
    return n ? Math.round(Math.sqrt(n * 30 * 30)) / 2 : 0;
  }
  /** Ladeleistung je Ladeplatz (J/Tick). */
  get chargePerTick(): number {
    const r = this.defs().find((d) => d.kind === 'roboport');
    return r ? wattsToJoulesPerTick(r.chargePower ?? 0) : 0;
  }
  /** Leistung der Solarmodule bei Tageslicht (J/Tick). */
  get solarPerTick(): number {
    return wattsToJoulesPerTick(this.defs().reduce((s, d) => s + (d.power ?? 0), 0));
  }

  update(daylight: number): void {
    this.energy = Math.min(this.capacity, this.energy + this.solarPerTick * daylight);
  }

  serialize(): { e: number; i: [string, number, number][] } {
    return { e: this.energy, i: this.items.map((p) => [p.item, p.x, p.y]) };
  }
  load(d: { e: number; i: [string, number, number][] } | undefined): void {
    if (!d) return;
    for (const [item, x, y] of d.i) if (EQUIPMENT[item]) this.items.push({ item, x, y });
    this.energy = Math.min(d.e, this.capacity);
  }
}
