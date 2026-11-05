import type { RoboportDef } from '../../data/entities';
import { ROBOPORT, isRobot } from '../../data/robots';
import { wattsToJoulesPerTick } from '../../data/time';
import { ElectricSource } from '../energy';
import { Status } from '../entity';
import type { Dir } from '../geom';
import { type InvData, Inventory, type Stack } from '../inventory';
import type { World } from '../world';
import { EntityBase, type GuiSlots, type InsertMode, invContents } from './base';

/**
 * Roboterhangar 4×4: lagert Roboter (7 Plätze), lädt bis zu 4 Roboter gleichzeitig (je 500 kW) aus seinem Speicher,
 * der mit höchstens 2,1 MW aus dem Stromnetz nachgeladen wird. Bereiche: Logistik 50×50, Bau 110×110.
 */
export class RoboportEntity extends EntityBase {
  readonly kind = 'roboport' as const;
  declare readonly def: RoboportDef;
  readonly energy: ElectricSource;
  readonly robots = new Inventory(ROBOPORT.robotSlots, isRobot);
  constructor(id: number, name: string, x: number, y: number, dir: Dir) {
    super(id, name, x, y, dir);
    this.energy = new ElectricSource(0, wattsToJoulesPerTick(ROBOPORT.drain), ROBOPORT.buffer);
    this.energy.maxInput = wattsToJoulesPerTick(ROBOPORT.bufferInput);
  }
  /** Mitte (Felder). */
  get px(): number {
    return this.x + 2;
  }
  get py(): number {
    return this.y + 2;
  }
  override update(): void {
    this.status = !this.energy.connected ? Status.NoPower : this.energy.buffer > 0 ? Status.Working : Status.NoPower;
  }
  override acceptAmount(item: string, _mode: InsertMode): number {
    return isRobot(item) ? this.robots.space(item) : 0;
  }
  protected override doInsert(item: string, n: number): number {
    return this.robots.add(item, n);
  }
  override take(_w: World, accept: (item: string) => boolean): string | null {
    const it = this.robots.firstItem(accept);
    if (!it) return null;
    this.robots.remove(it, 1);
    return it;
  }
  override contents(): Stack[] {
    return invContents(this.robots);
  }
  override guiSlots(): GuiSlots[] {
    return [{ label: 'Roboter', inv: this.robots }];
  }
  override save() {
    return { ...this.energy.serialize(), rb: this.robots.serialize() };
  }
  override load(d: Record<string, unknown>): void {
    this.energy.load(d as { eb: number });
    this.robots.load(d.rb as InvData);
  }
}
