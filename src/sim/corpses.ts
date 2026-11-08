import { Inventory, type InvData } from './inventory';

/** Leiche der Spielfigur (Wiki „Character corpse“): enthält das Inventar zum Zeitpunkt des Todes. */
export interface Corpse {
  id: number;
  x: number;
  y: number;
  tick: number;
  inv: Inventory;
}

/** Leichen der Spielfigur: entstehen beim Tod, werden per Abbauen (Rechtsklick) geleert und verschwinden dann. */
export class CorpseSystem {
  readonly all: Corpse[] = [];
  private nextId = 1;

  /** Inventar in eine neue Leiche verschieben (leere Inventare erzeugen keine Leiche). */
  add(x: number, y: number, tick: number, from: Inventory): Corpse | null {
    if (from.isEmpty()) return null;
    const inv = new Inventory(from.size);
    for (let i = 0; i < from.size; i++) {
      inv.slots[i] = from.slots[i];
      from.slots[i] = null;
    }
    const c: Corpse = { id: this.nextId++, x, y, tick, inv };
    this.all.push(c);
    return c;
  }

  /** Leiche unter dem Punkt (Radius 0,8 Felder). */
  at(x: number, y: number): Corpse | undefined {
    return this.all.find((c) => Math.hypot(c.x - x, c.y - y) < 0.8);
  }

  get(id: number): Corpse | undefined {
    return this.all.find((c) => c.id === id);
  }

  /** Alles, was passt, ins Ziel; leere Leichen verschwinden. Liefert die Anzahl übertragener Items. */
  loot(id: number, to: Inventory): number {
    const c = this.get(id);
    if (!c) return 0;
    let n = 0;
    for (const s of c.inv.slots) {
      if (!s) continue;
      const k = to.add(s.item, s.count);
      s.count -= k;
      n += k;
    }
    for (let i = 0; i < c.inv.size; i++) if (c.inv.slots[i]?.count === 0) c.inv.slots[i] = null;
    if (c.inv.isEmpty()) this.all.splice(this.all.indexOf(c), 1);
    return n;
  }

  serialize(): { n: number; c: [number, number, number, number, InvData][] } {
    return { n: this.nextId, c: this.all.map((c) => [c.id, c.x, c.y, c.tick, c.inv.serialize()]) };
  }

  load(d: ReturnType<CorpseSystem['serialize']> | undefined): void {
    this.all.length = 0;
    if (!d) return;
    this.nextId = d.n;
    for (const [id, x, y, tick, data] of d.c) {
      const inv = new Inventory(data.length);
      inv.load(data);
      this.all.push({ id, x, y, tick, inv });
    }
  }
}
