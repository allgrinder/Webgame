import { ITEMS } from '../data/items';

export interface Stack {
  item: string;
  count: number;
}

/** Inventar aus festen Slots. Optional mit Filter (z. B. nur Brennstoff). */
export class Inventory {
  readonly slots: (Stack | null)[];
  constructor(size: number, readonly filter?: (item: string) => boolean) {
    this.slots = new Array(size).fill(null);
  }

  get size(): number {
    return this.slots.length;
  }

  accepts(item: string): boolean {
    return !this.filter || this.filter(item);
  }

  count(item: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.item === item) n += s.count;
    return n;
  }

  isEmpty(): boolean {
    return this.slots.every((s) => !s);
  }

  /** Wie viele Items dieses Typs noch hineinpassen. */
  space(item: string): number {
    if (!this.accepts(item)) return 0;
    const stack = ITEMS[item]?.stackSize ?? 1;
    let n = 0;
    for (const s of this.slots) {
      if (!s) n += stack;
      else if (s.item === item) n += stack - s.count;
    }
    return n;
  }

  /** Fügt bis zu amount hinzu, gibt die tatsächlich eingefügte Menge zurück. */
  add(item: string, amount: number): number {
    if (amount <= 0 || !this.accepts(item)) return 0;
    const stack = ITEMS[item]?.stackSize ?? 1;
    let left = amount;
    for (const s of this.slots) {
      if (left === 0) break;
      if (s && s.item === item && s.count < stack) {
        const t = Math.min(left, stack - s.count);
        s.count += t;
        left -= t;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const t = Math.min(left, stack);
        this.slots[i] = { item, count: t };
        left -= t;
      }
    }
    return amount - left;
  }

  /** Entfernt bis zu amount, gibt die entfernte Menge zurück. Hinten beginnend. */
  remove(item: string, amount: number): number {
    let left = amount;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.item === item) {
        const t = Math.min(left, s.count);
        s.count -= t;
        left -= t;
        if (s.count === 0) this.slots[i] = null;
      }
    }
    return amount - left;
  }

  /** Erstes vorhandenes Item, das pred erfüllt. */
  firstItem(pred: (item: string) => boolean = () => true): string | undefined {
    for (const s of this.slots) if (s && pred(s.item)) return s.item;
    return undefined;
  }

  /** Inhalt als Liste (zusammengefasst, sortiert nach Item-Reihenfolge). */
  contents(): Stack[] {
    const m = new Map<string, number>();
    for (const s of this.slots) if (s) m.set(s.item, (m.get(s.item) ?? 0) + s.count);
    return [...m.entries()]
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => (ITEMS[a.item]?.order ?? 0) - (ITEMS[b.item]?.order ?? 0));
  }

  /** Slots nach Item-Reihenfolge sortieren und zusammenfassen. */
  sort(): void {
    const c = this.contents();
    this.slots.fill(null);
    for (const s of c) this.add(s.item, s.count);
  }

  serialize(): ([string, number] | null)[] {
    return this.slots.map((s) => (s ? [s.item, s.count] : null));
  }

  load(data: ([string, number] | null)[]): void {
    for (let i = 0; i < this.slots.length; i++) {
      const d = data[i];
      this.slots[i] = d ? { item: d[0], count: d[1] } : null;
    }
  }
}
