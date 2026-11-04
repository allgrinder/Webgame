import type { InserterDef } from '../../data/entities';
import { isFuel } from '../../data/items';
import { wattsToJoulesPerTick } from '../../data/time';
import { Burner } from '../burner';
import { ElectricSource } from '../energy';
import { Status } from '../entity';
import { type Dir, rotateVec } from '../geom';
import type { Stack } from '../inventory';
import type { World } from '../world';
import { type EnergySource, EntityBase, type GuiSlots, type InsertMode, invContents } from './base';

export enum InserterPhase {
  WaitPickup = 0,
  ToDrop = 1,
  WaitDrop = 2,
  ToPickup = 3,
}

/** Winkeleinheiten: 1000 = volle Umdrehung, halbe Drehung = 500. */
export const HALF_TURN = 500;

/**
 * Greifarm: nimmt vom Feld hinter sich (Gebäude, Band oder Boden) und legt vor sich ab.
 * Energie je Halbdrehung; Brennstoff-Greifarme versorgen sich selbst mit Brennstoff.
 */
export class InserterEntity extends EntityBase {
  readonly kind = 'inserter' as const;
  declare readonly def: InserterDef;
  readonly energy: EnergySource;
  phase = InserterPhase.WaitPickup;
  /** Drehfortschritt der aktuellen Halbdrehung in Tausendstel-Umdrehungen. */
  progress = 0;
  held: string | null = null;

  constructor(id: number, name: string, x: number, y: number, dir: Dir, energy?: EnergySource) {
    super(id, name, x, y, dir);
    if (energy) this.energy = energy;
    else if (this.def.energy === 'electric') {
      const half = Math.round(this.def.energyPerTransfer / 2);
      this.energy = new ElectricSource(half, wattsToJoulesPerTick(this.def.drain), Math.round(half * 1.5));
    } else this.energy = new Burner(this.def.fuelSlots, this.def.initialEnergy);
  }
  override get burner(): Burner | null {
    return this.energy instanceof Burner ? this.energy : null;
  }
  get turnPerTick(): number {
    return Math.round(this.def.rotationSpeed * 1000);
  }
  get halfSwingEnergy(): number {
    return Math.round(this.def.energyPerTransfer / 2);
  }
  armT(): number {
    switch (this.phase) {
      case InserterPhase.WaitPickup: return 0;
      case InserterPhase.ToDrop: return this.progress / HALF_TURN;
      case InserterPhase.WaitDrop: return 1;
      case InserterPhase.ToPickup: return 1 - this.progress / HALF_TURN;
    }
  }
  points(): { pickup: [number, number]; drop: [number, number] } {
    const [px, py] = rotateVec(this.def.pickupVector[0], this.def.pickupVector[1], this.dir);
    const [dx, dy] = rotateVec(this.def.dropVector[0], this.def.dropVector[1], this.dir);
    return { pickup: [this.cx + px, this.cy + py], drop: [this.cx + dx, this.cy + dy] };
  }

  override update(w: World): void {
    const { pickup, drop } = this.points();
    const dst = w.entityAt(drop[0], drop[1]);
    // Ziel: Gebäude (außer Greifarm) oder freier Boden
    const groundTarget = !dst && !w.map.isWater(Math.floor(drop[0]), Math.floor(drop[1]));
    const half = this.halfSwingEnergy;
    const burner = this.burner;
    let budget = this.turnPerTick;
    for (let guard = 0; guard < 6; guard++) {
      switch (this.phase) {
        case InserterPhase.WaitPickup: {
          if ((!dst && !groundTarget) || dst?.kind === 'inserter') {
            this.status = Status.NoTarget;
            return;
          }
          // Selbstversorgung: leerer Brennstoffslot -> eigenen Brennstoff greifen
          if (burner && burner.fuel.isEmpty()) {
            const fuel = w.takeAt(pickup[0], pickup[1], (it) => isFuel(it));
            if (fuel) {
              burner.fuel.add(fuel, 1);
              this.status = Status.Working;
              return;
            }
          }
          if (!this.energy.canSupply(half)) {
            this.status = this.energy.type === 'electric' ? Status.NoPower : Status.NoFuel;
            return;
          }
          const onBelt = !!w.belts.tileAt(Math.floor(drop[0]), Math.floor(drop[1]));
          const accept = dst && !onBelt ? (it: string) => dst.acceptAmount(it, 'inserter') > 0 : () => true;
          const item = w.takeAt(pickup[0], pickup[1], accept);
          if (!item) {
            this.status = Status.NoInput;
            return;
          }
          this.energy.consume(half);
          this.held = item;
          this.phase = InserterPhase.ToDrop;
          this.progress = 0;
          this.status = Status.Working;
          continue;
        }
        case InserterPhase.ToDrop:
        case InserterPhase.ToPickup: {
          const step = Math.min(budget, HALF_TURN - this.progress);
          this.progress += step;
          budget -= step;
          if (this.progress < HALF_TURN) return;
          this.progress = 0;
          this.phase = this.phase === InserterPhase.ToDrop ? InserterPhase.WaitDrop : InserterPhase.WaitPickup;
          continue;
        }
        case InserterPhase.WaitDrop: {
          if (this.held) {
            if ((!dst && !groundTarget) || !w.deliverAt(drop[0], drop[1], this.held, 'inserter', true)) {
              this.status = dst || groundTarget ? Status.OutputBlocked : Status.NoTarget;
              return;
            }
            this.held = null;
          }
          if (!this.energy.consume(half)) {
            this.status = this.energy.type === 'electric' ? Status.NoPower : Status.NoFuel;
            return;
          }
          this.status = Status.Working;
          this.phase = InserterPhase.ToPickup;
          this.progress = 0;
          continue;
        }
      }
    }
  }

  override acceptAmount(item: string, mode: InsertMode): number {
    const b = this.burner;
    return b && mode === 'player' && isFuel(item) ? b.fuel.space(item) : 0;
  }
  protected override doInsert(item: string, n: number): number {
    return this.burner?.fuel.add(item, n) ?? 0;
  }
  override contents(): Stack[] {
    const b = this.burner;
    const out = b ? invContents(b.fuel) : [];
    if (this.held) out.push({ item: this.held, count: 1 });
    return out;
  }
  override guiSlots(): GuiSlots[] {
    const b = this.burner;
    return b ? [{ label: 'Brennstoff', inv: b.fuel }] : [];
  }
  override save() {
    const en = this.energy instanceof ElectricSource ? this.energy.serialize() : { b: this.burner?.serialize() };
    return { ...en, phase: this.phase, progress: this.progress, held: this.held };
  }
  override load(d: Record<string, unknown>): void {
    if (d.b && this.burner) this.burner.load(d.b as ReturnType<Burner['serialize']>);
    if (this.energy instanceof ElectricSource) this.energy.load(d as { eb: number });
    this.phase = d.phase as InserterPhase;
    this.progress = d.progress as number;
    this.held = (d.held as string | null) ?? null;
  }
}
