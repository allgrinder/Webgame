import { ITEMS } from '../data/items';
import { FUEL_BONUS, ROLLING_STOCK, type RollingStockDef, type ScheduleEntry, TRAIN } from '../data/trains';
import { wattsToJoulesPerTick } from '../data/time';
import { Burner } from './burner';
import { Inventory, type InvData } from './inventory';
import type { Entity } from './machines';
import { type Pose, RailNetwork } from './rails';
import type { World } from './world';

export interface Vehicle {
  readonly id: number;
  readonly kind: RollingStockDef['id'];
  /** Ladung (Güterwagen) bzw. Brennstoff (Lokomotive). */
  readonly inv: Inventory;
  readonly burner: Burner | null;
  /** Zuletzt berechnete Lage (Mitte, Richtung) für Darstellung und Greifarme. */
  pose: Pose;
}

/** Abschnitt der Spur: Gleisstück und Fahrtrichtung (+1: von Ende 0 nach Ende 1). */
interface Step {
  piece: number;
  fwd: 1 | -1;
}

export type TrainState = 'moving' | 'waiting' | 'no-path' | 'manual';

export interface Train {
  readonly id: number;
  vehicles: Vehicle[];
  /** Belegte Stücke, vorderstes zuerst. */
  trail: Step[];
  /** Strecke der Zugspitze im vordersten Stück (ab Eintritt). */
  pos: number;
  speed: number;
  schedule: ScheduleEntry[];
  current: number;
  state: TrainState;
  /** Geplanter Weg (nach dem vordersten Stück) und Zielstelle im letzten Stück. */
  path: Step[] | null;
  targetPos: number;
  /** Warten: Ticks am Bahnhof, Ticks seit der letzten Ladungsänderung, Ladungssumme. */
  waited: number;
  idle: number;
  lastCargo: number;
}

const key = (s: Step) => s.piece * 2 + (s.fwd > 0 ? 1 : 0);

/**
 * Züge auf dem Gleisnetz: Fahrzeuge folgen der Zugspitze im Abstand 7. Fahrphysik je Tick nach Wiki „Locomotive“.
 * Automatik: Fahrplan (Bahnhof, Wartebedingung), Wegsuche (Dijkstra), Bremsen vor Ziel und belegten Stücken.
 * Sicherung vereinfacht: jedes Gleisstück ist ein Block (keine Signale nötig).
 */
export class TrainSystem {
  readonly rails = new RailNetwork();
  readonly trains: Train[] = [];
  private nextId = 1;
  private readonly reserved = new Map<number, number>();

  // ------------------------------------------------------------------ Fahrzeuge

  private newVehicle(kind: RollingStockDef['id']): Vehicle {
    const def = ROLLING_STOCK[kind];
    const burner = kind === 'locomotive' ? new Burner(def.slots) : null;
    return { id: this.nextId++, kind, inv: burner ? burner.fuel : new Inventory(def.slots), burner, pose: { x: 0, y: 0, dx: 0, dy: -1 } };
  }

  /** Fahrzeug aufs Gleis stellen (nahe (x,y), Ausrichtung nach (dx,dy)); hängt an einen nahen Zug an. */
  place(w: World, kind: RollingStockDef['id'], x: number, y: number, dx: number, dy: number): Vehicle | null {
    this.rails.ensure(w);
    const at = this.rails.nearest(x, y);
    if (!at) return null;
    const piece = this.rails.pieces.get(at.piece)!;
    const p = piece.pose(at.s);
    const fwd: 1 | -1 = p.dx * dx + p.dy * dy >= 0 ? 1 : -1;
    // an einen Zug ankuppeln, dessen letztes Fahrzeug dicht dahinter/davor steht
    for (const t of this.trains) {
      const last = t.vehicles[t.vehicles.length - 1];
      if (Math.hypot(last.pose.x - p.x, last.pose.y - p.y) <= TRAIN.coupleDistance && Math.hypot(last.pose.x - p.x, last.pose.y - p.y) >= 5) {
        const v = this.newVehicle(kind);
        t.vehicles.push(v);
        this.extendTrail(t);
        this.updatePoses(t);
        return v;
      }
    }
    const v = this.newVehicle(kind);
    // Spitze 3 Felder vor der Mitte des Fahrzeugs
    const entryPos = fwd > 0 ? at.s : piece.length - at.s;
    const t: Train = {
      id: this.nextId++, vehicles: [v], trail: [{ piece: at.piece, fwd }], pos: entryPos, speed: 0, schedule: [], current: 0,
      state: 'manual', path: null, targetPos: 0, waited: 0, idle: 0, lastCargo: 0,
    };
    this.advance(w, t, 3, true);
    this.extendTrail(t);
    this.updatePoses(t);
    this.trains.push(t);
    return v;
  }

  /** Fahrzeug entfernen (abbauen): Item plus Inhalt; der Zug wird an dieser Stelle getrennt. */
  remove(id: number): { item: string; count: number }[] {
    for (let ti = 0; ti < this.trains.length; ti++) {
      const t = this.trains[ti];
      const i = t.vehicles.findIndex((v) => v.id === id);
      if (i < 0) continue;
      const v = t.vehicles[i];
      const out = [{ item: v.kind, count: 1 }, ...v.inv.contents()];
      const rest = t.vehicles.slice(i + 1);
      t.vehicles = t.vehicles.slice(0, i);
      if (!t.vehicles.length) this.trains.splice(ti, 1);
      if (rest.length) {
        // hinterer Teil wird ein eigener Zug (Spitze vor dem ersten verbleibenden Fahrzeug)
        const head = rest[0];
        const nt: Train = {
          id: this.nextId++, vehicles: [], trail: [], pos: 0, speed: 0, schedule: [], current: 0,
          state: 'manual', path: null, targetPos: 0, waited: 0, idle: 0, lastCargo: 0,
        };
        const at = this.rails.nearest(head.pose.x + head.pose.dx * 3, head.pose.y + head.pose.dy * 3, 3);
        if (at) {
          const piece = this.rails.pieces.get(at.piece)!;
          const p = piece.pose(at.s);
          const fwd: 1 | -1 = p.dx * head.pose.dx + p.dy * head.pose.dy >= 0 ? 1 : -1;
          nt.trail = [{ piece: at.piece, fwd }];
          nt.pos = fwd > 0 ? at.s : piece.length - at.s;
          nt.vehicles = rest;
          this.extendTrail(nt);
          this.updatePoses(nt);
          this.trains.push(nt);
        } else for (const r of rest) out.push({ item: r.kind, count: 1 }, ...r.inv.contents());
      }
      return out;
    }
    return [];
  }

  vehicleAt(x: number, y: number): { train: Train; vehicle: Vehicle } | null {
    for (const t of this.trains) {
      for (const v of t.vehicles) {
        // Fahrzeug ~2 × 6 entlang der Richtung
        const rx = x - v.pose.x;
        const ry = y - v.pose.y;
        const along = rx * v.pose.dx + ry * v.pose.dy;
        const across = -rx * v.pose.dy + ry * v.pose.dx;
        if (Math.abs(along) <= 3 && Math.abs(across) <= 1) return { train: t, vehicle: v };
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ Spur

  private length(t: Train): number {
    return (t.vehicles.length - 1) * TRAIN.spacing + ROLLING_STOCK.locomotive.length;
  }

  /** Spur nach hinten verlängern, bis sie den ganzen Zug trägt (geradeaus am Ende). */
  private extendTrail(t: Train): void {
    let have = t.pos;
    for (let i = 1; i < t.trail.length; i++) have += this.rails.pieces.get(t.trail[i].piece)?.length ?? 0;
    let guard = 0;
    while (have < this.length(t) + 1 && guard++ < 50) {
      const last = t.trail[t.trail.length - 1];
      // rückwärts: über das Eintrittsende verlassen
      const exitBack: 0 | 1 = last.fwd > 0 ? 0 : 1;
      const nx = this.rails.next(last.piece, exitBack)[0];
      if (!nx) break;
      t.trail.push({ piece: nx.piece, fwd: nx.end === 0 ? -1 : 1 });
      have += this.rails.pieces.get(nx.piece)!.length;
    }
  }

  /** Lage im Abstand b hinter der Zugspitze. */
  poseBehind(t: Train, b: number): Pose | null {
    let rem = b;
    for (let i = 0; i < t.trail.length; i++) {
      const st = t.trail[i];
      const piece = this.rails.pieces.get(st.piece);
      if (!piece) return null;
      const into = i === 0 ? t.pos : piece.length;
      if (rem <= into || i === t.trail.length - 1) {
        const d = Math.max(0, into - rem);
        const s = st.fwd > 0 ? d : piece.length - d;
        const p = piece.pose(s);
        return st.fwd > 0 ? p : { x: p.x, y: p.y, dx: -p.dx, dy: -p.dy };
      }
      rem -= into;
    }
    return null;
  }

  private updatePoses(t: Train): void {
    t.vehicles.forEach((v, i) => {
      const p = this.poseBehind(t, 3 + i * TRAIN.spacing);
      if (p) v.pose = p;
    });
  }

  /** Zugspitze um d vorrücken (entlang des Wegs bzw. geradeaus). Liefert die tatsächlich gefahrene Strecke. */
  private advance(w: World, t: Train, d: number, dry = false): number {
    let left = d;
    let moved = 0;
    let guard = 0;
    while (left > 1e-9 && guard++ < 100) {
      const head = t.trail[0];
      const piece = this.rails.pieces.get(head.piece);
      if (!piece) break;
      const room = piece.length - t.pos;
      if (left <= room) {
        t.pos += left;
        moved += left;
        break;
      }
      // ins nächste Stück
      const exit: 0 | 1 = head.fwd > 0 ? 1 : 0;
      const opts = this.rails.next(head.piece, exit);
      let nx = opts[0];
      if (t.path?.length) {
        const want = t.path[0];
        nx = opts.find((o) => o.piece === want.piece) ?? nx;
        if (nx && nx.piece === want.piece) t.path.shift();
      }
      if (!nx) {
        moved += room;
        t.pos = piece.length;
        if (!dry) t.speed = 0;
        break;
      }
      left -= room;
      moved += room;
      t.trail.unshift({ piece: nx.piece, fwd: nx.end === 0 ? 1 : -1 });
      t.pos = 0;
    }
    // hintere Stücke abwerfen
    let have = t.pos;
    for (let i = 1; i < t.trail.length; i++) {
      if (have >= this.length(t) + 1) {
        t.trail.length = i;
        break;
      }
      have += this.rails.pieces.get(t.trail[i].piece)?.length ?? 0;
    }
    void w;
    return moved;
  }

  // ------------------------------------------------------------------ Fahrplan und Weg

  /** Zielstellen eines Bahnhofs: Gleisstück links vom Bahnhof (Bahnhof rechts in Fahrtrichtung). */
  stopTarget(stop: Entity): { piece: number; fwd: 1 | -1; pos: number } | null {
    const DXs = [0, 1, 0, -1];
    const DYs = [-1, 0, 1, 0];
    const tx = DXs[stop.dir];
    const ty = DYs[stop.dir];
    const lx = ty;
    const ly = -tx;
    const cx = stop.x + 1 + lx * 2 + tx * 1;
    const cy = stop.y + 1 + ly * 2 + ty * 1;
    const at = this.rails.nearest(cx, cy, 0.9);
    if (!at) return null;
    const piece = this.rails.pieces.get(at.piece)!;
    const p = piece.pose(at.s);
    const fwd: 1 | -1 = p.dx * tx + p.dy * ty >= 0 ? 1 : -1;
    return { piece: at.piece, fwd, pos: fwd > 0 ? at.s : piece.length - at.s };
  }

  private findPath(w: World, t: Train, station: string): boolean {
    const goals = new Map<number, number>();
    for (const e of w.entities.values()) {
      if (e.kind !== 'train-stop' || e.stationName !== station) continue;
      const g = this.stopTarget(e);
      if (g) goals.set(key(g), g.pos);
    }
    if (!goals.size) return false;
    const head = t.trail[0];
    // Ziel im aktuellen Stück voraus?
    const here = goals.get(key(head));
    if (here !== undefined && here >= t.pos - 1e-6) {
      t.path = [];
      t.targetPos = here;
      return true;
    }
    const dist = new Map<number, number>();
    const prev = new Map<number, Step>();
    const startLen = this.rails.pieces.get(head.piece)!.length - t.pos;
    const queue: [number, Step][] = [];
    const exit: 0 | 1 = head.fwd > 0 ? 1 : 0;
    for (const n of this.rails.next(head.piece, exit)) {
      const st: Step = { piece: n.piece, fwd: n.end === 0 ? 1 : -1 };
      dist.set(key(st), startLen);
      queue.push([startLen, st]);
    }
    let found: Step | null = null;
    while (queue.length) {
      queue.sort((a, b) => a[0] - b[0] || key(a[1]) - key(b[1]));
      const [d, st] = queue.shift()!;
      if (d > (dist.get(key(st)) ?? Infinity)) continue;
      if (goals.has(key(st))) {
        found = st;
        break;
      }
      const len = this.rails.pieces.get(st.piece)!.length;
      for (const n of this.rails.next(st.piece, st.fwd > 0 ? 1 : 0)) {
        const ns: Step = { piece: n.piece, fwd: n.end === 0 ? 1 : -1 };
        const nd = d + len;
        if (nd < (dist.get(key(ns)) ?? Infinity)) {
          dist.set(key(ns), nd);
          prev.set(key(ns), st);
          queue.push([nd, ns]);
        }
      }
    }
    if (!found) return false;
    const path: Step[] = [];
    for (let s: Step | undefined = found; s; s = prev.get(key(s))) path.unshift(s);
    t.path = path;
    t.targetPos = goals.get(key(found))!;
    return true;
  }

  /** Strecke bis zur Zielstelle entlang des Wegs. */
  private distToTarget(t: Train): number {
    if (!t.path) return Infinity;
    const head = t.trail[0];
    if (!t.path.length) return t.targetPos - t.pos;
    let d = this.rails.pieces.get(head.piece)!.length - t.pos;
    for (let i = 0; i < t.path.length - 1; i++) d += this.rails.pieces.get(t.path[i].piece)?.length ?? 0;
    return d + t.targetPos;
  }

  /** Strecke bis zum ersten Stück voraus, das ein anderer Zug belegt (innerhalb von look). */
  private distToObstacle(t: Train, look: number): number {
    const head = t.trail[0];
    let d = this.rails.pieces.get(head.piece)!.length - t.pos;
    let cur = head;
    const ahead = t.path ?? [];
    for (let i = 0; d < look && i < 30; i++) {
      let nx: Step | undefined = ahead[i];
      if (!nx) {
        const n = this.rails.next(cur.piece, cur.fwd > 0 ? 1 : 0)[0];
        if (!n) return d;
        nx = { piece: n.piece, fwd: n.end === 0 ? 1 : -1 };
      }
      const owner = this.reserved.get(nx.piece);
      if (owner !== undefined && owner !== t.id) return Math.max(0, d - 0.5);
      d += this.rails.pieces.get(nx.piece)!.length;
      cur = nx;
    }
    return Infinity;
  }

  private weight(t: Train): number {
    // Ladung wiegt im Original nichts (Wagengewicht fest)
    let wgt = 0;
    for (const v of t.vehicles) wgt += ROLLING_STOCK[v.kind].weight;
    return wgt;
  }

  private cargo(t: Train): number {
    let n = 0;
    for (const v of t.vehicles) if (v.kind === 'cargo-wagon') for (const s of v.inv.slots) if (s) n += s.count;
    return n;
  }

  private waitDone(t: Train, e: ScheduleEntry): boolean {
    const wagons = t.vehicles.filter((v) => v.kind === 'cargo-wagon');
    switch (e.wait) {
      case 'time': return t.waited >= e.seconds * 60;
      case 'inactivity': return t.idle >= e.seconds * 60;
      case 'full': return wagons.length > 0 && wagons.every((v) => v.inv.slots.every((s) => s && s.count >= (ITEMS[s.item]?.stackSize ?? 1)));
      case 'empty': return wagons.every((v) => v.inv.isEmpty());
    }
  }

  // ------------------------------------------------------------------ Tick

  update(w: World): void {
    this.rails.ensure(w);
    // Belegung: Spuren aller Züge
    this.reserved.clear();
    for (const t of this.trains) for (const st of t.trail) this.reserved.set(st.piece, t.id);
    for (const t of this.trains) this.step(w, t);
  }

  private step(w: World, t: Train): void {
    if (!t.trail.length || !this.rails.pieces.has(t.trail[0].piece)) {
      t.speed = 0;
      return;
    }
    if (t.state === 'manual' || !t.schedule.length) {
      t.speed = 0;
      return;
    }
    const entry = t.schedule[t.current % t.schedule.length];
    if (t.state === 'waiting') {
      t.waited++;
      const c = this.cargo(t);
      t.idle = c === t.lastCargo ? t.idle + 1 : 0;
      t.lastCargo = c;
      if (this.waitDone(t, entry)) {
        t.current = (t.current + 1) % t.schedule.length;
        t.state = 'moving';
        t.path = null;
      }
      return;
    }
    if (!t.path) {
      if (!this.findPath(w, t, t.schedule[t.current % t.schedule.length].station)) {
        t.state = 'no-path';
        t.speed = 0;
        if (w.tick % 60 === 0) t.state = 'moving';
        return;
      }
      t.state = 'moving';
    }
    const W = this.weight(t);
    let B = 0;
    let F = 0;
    for (const v of t.vehicles) {
      B += ROLLING_STOCK[v.kind].braking;
      F += ROLLING_STOCK[v.kind].friction;
    }
    const decel = (B + F) / W;
    const brakeDist = (t.speed * t.speed) / (2 * decel) + t.speed * 2;
    const target = this.distToTarget(t);
    const obstacle = this.distToObstacle(t, brakeDist + 4);
    const stopAt = Math.min(target, obstacle);
    let v = Math.max(0, t.speed - F / W);
    if (stopAt <= brakeDist + 0.05) {
      v = Math.max(0, v - B / W);
      // die letzten Zentimeter langsam heranrollen
      if (v < 0.02) v = Math.min(stopAt, 0.02);
    } else {
      let accel = 0;
      let top = 1;
      for (const loco of t.vehicles) {
        if (loco.kind !== 'locomotive' || !loco.burner) continue;
        const fuel = loco.burner.fuel.firstItem();
        const bonus = (fuel && FUEL_BONUS[fuel]) || { accel: 1, top: 1 };
        if (loco.burner.consume(wattsToJoulesPerTick(TRAIN.power))) {
          accel += TRAIN.force * bonus.accel;
          top = Math.max(top, bonus.top);
        }
      }
      v += accel / W;
      v *= 1 - ROLLING_STOCK[t.vehicles[0].kind].airResistance / (W / 1000);
      v = Math.min(v, TRAIN.maxSpeed * top);
    }
    // nicht über Ziel oder Hindernis hinaus
    if (v >= stopAt) v = Math.max(0, stopAt);
    t.speed = v;
    if (v > 0) {
      this.advance(w, t, v);
      for (const st of t.trail) this.reserved.set(st.piece, t.id);
    }
    this.updatePoses(t);
    if (t.speed === 0 && target <= 1e-3 && t.path) {
      t.state = 'waiting';
      t.waited = 0;
      t.idle = 0;
      t.lastCargo = this.cargo(t);
    }
  }

  // ------------------------------------------------------------------ Speichern

  serialize() {
    return {
      n: this.nextId,
      t: this.trains.map((t) => ({
        id: t.id, pos: t.pos, sp: t.speed, sc: t.schedule, cur: t.current, st: t.state, path: t.path, tp: t.targetPos,
        wa: t.waited, idl: t.idle, lc: t.lastCargo, tr: t.trail,
        v: t.vehicles.map((v) => ({ id: v.id, k: v.kind, inv: v.inv.serialize(), e: v.burner?.energy ?? 0, p: v.pose })),
      })),
    };
  }

  load(d: ReturnType<TrainSystem['serialize']> | undefined): void {
    if (!d) return;
    this.nextId = d.n;
    for (const td of d.t) {
      const vehicles: Vehicle[] = td.v.map((vd) => {
        const def = ROLLING_STOCK[vd.k];
        const burner = vd.k === 'locomotive' ? new Burner(def.slots) : null;
        const inv = burner ? burner.fuel : new Inventory(def.slots);
        inv.load(vd.inv as InvData);
        if (burner) burner.energy = vd.e;
        return { id: vd.id, kind: vd.k, inv, burner, pose: vd.p };
      });
      this.trains.push({
        id: td.id, vehicles, trail: td.tr, pos: td.pos, speed: td.sp, schedule: td.sc, current: td.cur, state: td.st, path: td.path,
        targetPos: td.tp, waited: td.wa, idle: td.idl, lastCargo: td.lc,
      });
    }
  }
}

