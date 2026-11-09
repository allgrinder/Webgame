import { itemId } from './machines';
import { type ArithmeticOp, type Comparator, WIRE_REACH, arithmetic, compare, int32 } from '../data/circuit';
import type { PoleDef } from '../data/entities';
import { Status } from './entity';
import { DX, DY } from './geom';
import type { Entity } from './machines';
import type { World } from './world';

export type WireColor = 'red' | 'green';
/** Anschlusspunkt: Gebäude und Seite (Kombinator: 0 Eingang, 1 Ausgang; sonst 0). */
export interface WirePoint {
  readonly id: number;
  readonly side: 0 | 1;
}
export interface Wire {
  readonly a: WirePoint;
  readonly b: WirePoint;
  readonly color: WireColor;
}

/** Bedingung: Signal (Vergleich mit Zahl oder zweitem Signal). */
export interface Condition {
  first: string | null;
  op: Comparator;
  constant: number;
  second: string | null;
}

export interface CombinatorSettings {
  /** Konstanter Kombinator: ausgegebene Signale. */
  signals?: { signal: string; count: number }[];
  /** Rechenkombinator. */
  arith?: { first: string | null; op: ArithmeticOp; constant: number; second: string | null; output: string | null };
  /** Entscheidungskombinator: Bedingung, Ausgabe 1 oder Eingangswert. */
  decide?: Condition & { output: string | null; copyCount: boolean };
}

type Signals = Map<string, number>;
const key = (p: WirePoint) => p.id * 2 + p.side;

function add(into: Signals, from: Signals | undefined, k = 1): void {
  if (!from) return;
  for (const [s, v] of from) {
    const n = int32((into.get(s) ?? 0) + v * k);
    if (n === 0) into.delete(s);
    else into.set(s, n);
  }
}

/**
 * Schaltungsnetz: rote und grüne Drähte verbinden Anschlusspunkte zu Netzen; jedes Netz summiert die Ausgaben
 * seiner Teilnehmer. Empfänger addieren rot und grün. Kisten melden ihren Inhalt, Akkumulatoren Ladung (A, %),
 * Kombinatoren rechnen mit einem Tick Verzögerung. Greifarme, Lampen und Pumpen schalten per Bedingung.
 */
export class CircuitSystem {
  readonly wires: Wire[] = [];
  readonly conditions = new Map<number, Condition>();
  readonly settings = new Map<number, CombinatorSettings>();
  /** Ausgaben der Kombinatoren (gelten ab dem nächsten Tick). */
  private readonly out = new Map<number, Signals>();
  /** Netzwerte je Farbe und Anschlusspunkt (aktueller Tick). */
  private readonly netOf = { red: new Map<number, number>(), green: new Map<number, number>() };
  private values: Signals[] = [];
  private version = -1;
  private wiresVersion = 0;
  private builtWires = -1;

  /** Mitte eines Anschlusspunkts (Felder). */
  static pointPos(e: Entity, side: 0 | 1): { x: number; y: number } {
    if (e.kind === 'combinator' && e.def.height === 2) {
      // dir = Ausgaberichtung: Ausgang auf dem vorderen Feld
      const s = side === 1 ? 0.5 : -0.5;
      return { x: e.cx + DX[e.dir] * s, y: e.cy + DY[e.dir] * s };
    }
    return { x: e.cx, y: e.cy };
  }

  /** Drahtreichweite eines Gebäudes. */
  static reach(e: Entity): number {
    return e.kind === 'pole' ? (e.def as PoleDef).wireReach : WIRE_REACH;
  }

  /** Verbindet zwei Punkte; dieselbe Verbindung noch einmal entfernt sie. */
  toggle(w: World, a: WirePoint, b: WirePoint, color: WireColor): 'added' | 'removed' | 'far' | 'invalid' {
    if (a.id === b.id && a.side === b.side) return 'invalid';
    const ea = w.entities.get(a.id);
    const eb = w.entities.get(b.id);
    if (!ea || !eb) return 'invalid';
    const i = this.wires.findIndex((x) => x.color === color && ((key(x.a) === key(a) && key(x.b) === key(b)) || (key(x.a) === key(b) && key(x.b) === key(a))));
    if (i >= 0) {
      this.wires.splice(i, 1);
      this.wiresVersion++;
      return 'removed';
    }
    const pa = CircuitSystem.pointPos(ea, a.side);
    const pb = CircuitSystem.pointPos(eb, b.side);
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > Math.min(CircuitSystem.reach(ea), CircuitSystem.reach(eb))) return 'far';
    this.wires.push({ a, b, color });
    this.wiresVersion++;
    return 'added';
  }

  isWired(id: number): boolean {
    return this.netOf.red.has(id * 2) || this.netOf.green.has(id * 2) || this.netOf.red.has(id * 2 + 1) || this.netOf.green.has(id * 2 + 1);
  }

  /** Eingang eines Punkts: rot + grün (aktueller Tick). */
  input(id: number, side: 0 | 1 = 0): Signals {
    const s: Signals = new Map();
    const r = this.netOf.red.get(id * 2 + side);
    const g = this.netOf.green.get(id * 2 + side);
    if (r !== undefined) add(s, this.values[r]);
    if (g !== undefined) add(s, this.values[g]);
    return s;
  }

  /** Signale eines Netzes einer Farbe am Punkt (Anzeige). */
  network(id: number, side: 0 | 1, color: WireColor): Signals | null {
    const n = this.netOf[color].get(id * 2 + side);
    return n === undefined ? null : this.values[n];
  }

  /** Bedingung eines Gebäudes erfüllt? Ohne Draht oder ohne Bedingung: ja. */
  enabled(id: number): boolean {
    const c = this.conditions.get(id);
    if (!c || !c.first || !this.isWired(id)) return true;
    return this.check(this.input(id), c);
  }

  check(inp: Signals, c: Condition): boolean {
    if (!c.first) return false;
    const a = inp.get(c.first) ?? 0;
    const b = c.second ? inp.get(c.second) ?? 0 : c.constant;
    return compare(a, c.op, b);
  }

  private rebuild(w: World): void {
    for (let i = this.wires.length - 1; i >= 0; i--) {
      if (!w.entities.has(this.wires[i].a.id) || !w.entities.has(this.wires[i].b.id)) this.wires.splice(i, 1);
    }
    for (const id of [...this.conditions.keys()]) if (!w.entities.has(id)) this.conditions.delete(id);
    for (const id of [...this.settings.keys()]) if (!w.entities.has(id)) this.settings.delete(id);
    for (const id of [...this.out.keys()]) if (!w.entities.has(id >> 1)) this.out.delete(id);
    let n = 0;
    for (const color of ['red', 'green'] as const) {
      const map = this.netOf[color];
      map.clear();
      const parent = new Map<number, number>();
      const find = (k: number): number => {
        let r = k;
        while (parent.get(r) !== r) r = parent.get(r)!;
        parent.set(k, r);
        return r;
      };
      for (const wr of this.wires) {
        if (wr.color !== color) continue;
        for (const p of [wr.a, wr.b]) if (!parent.has(key(p))) parent.set(key(p), key(p));
        const ra = find(key(wr.a));
        const rb = find(key(wr.b));
        if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
      }
      // Radare verbinden ihre Netze drahtlos (Wiki „Radar“, Modus Oberfläche): alle verdrahteten Radare dieser Farbe
      let radarRoot = -1;
      for (const k of [...parent.keys()].sort((x, y) => x - y)) {
        if (k % 2 !== 0 || w.entities.get(k >> 1)?.kind !== 'radar') continue;
        const r = find(k);
        if (radarRoot < 0) radarRoot = r;
        else if (r !== find(radarRoot)) {
          const a2 = find(radarRoot);
          parent.set(Math.max(r, a2), Math.min(r, a2));
        }
      }
      const idx = new Map<number, number>();
      for (const k of [...parent.keys()].sort((a, b) => a - b)) {
        const r = find(k);
        if (!idx.has(r)) idx.set(r, n++);
        map.set(k, idx.get(r)!);
      }
    }
    this.values = Array.from({ length: n }, () => new Map());
  }

  /** Ausgabe eines Punkts in diesem Tick. */
  private outputOf(w: World, id: number, side: 0 | 1): Signals | undefined {
    const e = w.entities.get(id);
    if (!e) return undefined;
    if (e.kind === 'combinator') return e.def.mode === 'constant' || side === 1 ? this.out.get(id * 2 + (e.def.height === 2 ? 1 : 0)) : undefined;
    if (side !== 0) return undefined;
    if (e.kind === 'container') {
      const s: Signals = new Map();
      for (const st of e.inventory.slots) if (st) s.set(st.item, (s.get(st.item) ?? 0) + st.count);
      return s;
    }
    if (e.kind === 'accumulator') return new Map([['signal-A', Math.floor(e.fraction * 100)]]);
    if (e.kind === 'belt') {
      // Band liest seinen Inhalt (Modus „Halten“, Wiki „Transport belt“)
      const t = w.belts.tileById(id);
      if (!t) return undefined;
      const s: Signals = new Map();
      for (const it of w.belts.itemsOnTile(t)) {
        const name = itemId(it.item);
        s.set(name, (s.get(name) ?? 0) + 1);
      }
      return s;
    }
    if (e.kind === 'tank') {
      const net = e.box.net;
      return net && net.fluid ? new Map([[net.fluid, Math.floor(net.amount / 1000)]]) : undefined;
    }
    return undefined;
  }

  update(w: World): void {
    if (this.version !== w.structureVersion || this.builtWires !== this.wiresVersion) {
      this.version = w.structureVersion;
      this.builtWires = this.wiresVersion;
      this.rebuild(w);
    }
    if (!this.wires.length) return;
    for (const v of this.values) v.clear();
    for (const color of ['red', 'green'] as const) {
      for (const [k, n] of this.netOf[color]) add(this.values[n], this.outputOf(w, k >> 1, (k & 1) as 0 | 1));
    }
    // Kombinatoren: neue Ausgaben aus den Eingängen (wirken ab dem nächsten Tick)
    for (const [id, st] of this.settings) {
      const e = w.entities.get(id);
      if (!e || e.kind !== 'combinator') continue;
      const outKey = id * 2 + (e.def.height === 2 ? 1 : 0);
      if (e.def.mode === 'constant') {
        const s: Signals = new Map();
        for (const x of st.signals ?? []) if (x.signal && x.count) s.set(x.signal, int32((s.get(x.signal) ?? 0) + x.count));
        this.out.set(outKey, s);
        continue;
      }
      if (e.status === Status.NoPower) {
        this.out.delete(outKey);
        continue;
      }
      const inp = this.input(id, 0);
      const s: Signals = new Map();
      if (e.def.mode === 'arithmetic' && st.arith?.first && st.arith.output) {
        const a = inp.get(st.arith.first) ?? 0;
        const b = st.arith.second ? inp.get(st.arith.second) ?? 0 : st.arith.constant;
        const r = arithmetic(a, st.arith.op, b);
        if (r) s.set(st.arith.output, r);
      } else if (e.def.mode === 'decider' && st.decide?.first && st.decide.output) {
        if (this.check(inp, st.decide)) {
          const v = st.decide.copyCount ? inp.get(st.decide.output) ?? 0 : 1;
          if (v) s.set(st.decide.output, v);
        }
      }
      this.out.set(outKey, s);
    }
  }

  serialize(): { w: [number, number, number, number, number][]; c: [number, Condition][]; s: [number, CombinatorSettings][]; o: [number, [string, number][]][] } {
    return {
      w: this.wires.map((x) => [x.a.id, x.a.side, x.b.id, x.b.side, x.color === 'red' ? 0 : 1]),
      c: [...this.conditions].sort((a, b) => a[0] - b[0]),
      s: [...this.settings].sort((a, b) => a[0] - b[0]),
      o: [...this.out].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, [...v]]),
    };
  }
  load(d: ReturnType<CircuitSystem['serialize']> | undefined): void {
    if (!d) return;
    for (const [a, as, b, bs, c] of d.w) this.wires.push({ a: { id: a, side: as as 0 | 1 }, b: { id: b, side: bs as 0 | 1 }, color: c ? 'green' : 'red' });
    for (const [id, c] of d.c) this.conditions.set(id, c);
    for (const [id, s] of d.s) this.settings.set(id, s);
    for (const [k, v] of d.o) this.out.set(k, new Map(v));
    this.wiresVersion++;
  }
}
