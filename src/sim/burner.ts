import { ITEMS, isFuel } from '../data/items';
import { Inventory } from './inventory';

/** Brennstoff-Energiequelle: Brennstoffslot plus Restenergie des aktuell brennenden Items. */
export class Burner {
  readonly type = 'burner' as const;
  readonly fuel: Inventory;
  /** Restenergie in Joule. */
  energy: number;

  constructor(slots: number, initialEnergy = 0) {
    this.fuel = new Inventory(slots, isFuel);
    this.energy = initialEnergy;
  }

  /** Verbraucht joules. Zündet bei Bedarf ein neues Brennstoff-Item. */
  consume(joules: number): boolean {
    while (this.energy < joules) {
      const it = this.fuel.firstItem();
      if (!it) return false;
      this.fuel.remove(it, 1);
      this.energy += ITEMS[it]!.fuelValue!;
    }
    this.energy -= joules;
    return true;
  }

  /** Hat Energie für mindestens joules (ohne zu verbrauchen). */
  canSupply(joules: number): boolean {
    return this.energy >= joules || !this.fuel.isEmpty();
  }

  serialize(): { e: number; f: ReturnType<Inventory['serialize']> } {
    return { e: this.energy, f: this.fuel.serialize() };
  }

  load(d: { e: number; f: ReturnType<Inventory['serialize']> }): void {
    this.energy = d.e;
    this.fuel.load(d.f);
  }
}
