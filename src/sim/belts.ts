import { BELT } from '../data/belt';
import { DX, DY, type Dir, rotCW, rotateVec, tileKey } from './geom';

/**
 * Bandsystem nach dem Transportlinien-Prinzip:
 * Aufeinanderfolgende Bandfelder (gerade oder Kurve, ohne seitliches Einspeisen) bilden
 * eine Linie. Jede Linie hat zwei unabhängige Spuren. Eine Spur speichert ihre Items
 * vorne beginnend als Abstände: gaps[0] = Abstand des vordersten Items zum Linienende,
 * gaps[i] = Abstand von Item i zu Item i-1. Pro Tick ändern sich nur wenige Abstände.
 *
 * Positionen sind ganzzahlig (256 pro Feld). Spur 0 = links, Spur 1 = rechts (in Laufrichtung).
 */

export enum Shape {
  Straight = 0,
  CurveLeft = 1,
  CurveRight = 2,
}

const S: number = BELT.itemSpacing;
const SPEED: number = BELT.speed;
const P: number = BELT.positionsPerTile;

export function laneLength(shape: Shape, lane: number): number {
  if (shape === Shape.Straight) return P;
  const inner = shape === Shape.CurveLeft ? 0 : 1;
  return lane === inner ? BELT.curveInnerLength : BELT.curveOuterLength;
}

export interface BeltTile {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  dir: Dir;
  shape: Shape;
  line: TransportLine | null;
  /** Index im tiles-Array der Linie (0 = Anfang). */
  idx: number;
}

interface LaneOut {
  line: TransportLine;
  lane: number;
  /** Einfügeposition als Abstand zum Ende der Ziellinie. */
  d: number;
}

export class Lane {
  gaps: number[] = [];
  items: number[] = [];
  len = 0;
  /** Alle Items vor diesem Index sind zusammengeschoben und blockiert. */
  active = 0;
  /** Index des ersten Items, das sich im letzten Tick bewegt hat (Interpolation). */
  firstMoving = 0;
  /** Abstand vom Linienende zum Ende des Feldes j. */
  tileEnd: number[] = [];
  out: LaneOut | null = null;
}

export class TransportLine {
  readonly tiles: BeltTile[] = [];
  readonly lanes: [Lane, Lane] = [new Lane(), new Lane()];
  constructor(readonly startKey: number) {}
}

/** Item auf einem einzelnen Feld (für Extraktion/Speichern). offset = Abstand zum Feldende. */
export interface TileItem {
  lane: number;
  offset: number;
  item: number;
}

export class BeltSystem {
  private readonly byKey = new Map<number, BeltTile>();
  private readonly byId = new Map<number, BeltTile>();
  lines: TransportLine[] = [];
  private dirty = false;
  /** Zwischenspeicher für Items beim Umbau, pro Band-ID. */
  private pending = new Map<number, { lens: [number, number]; items: TileItem[] }>();

  get count(): number {
    return this.byId.size;
  }

  tileAt(x: number, y: number): BeltTile | undefined {
    return this.byKey.get(tileKey(x, y));
  }

  tileById(id: number): BeltTile | undefined {
    return this.byId.get(id);
  }

  allTiles(): IterableIterator<BeltTile> {
    return this.byId.values();
  }

  add(id: number, x: number, y: number, dir: Dir): BeltTile {
    this.extractAll();
    const t: BeltTile = { id, x, y, dir, shape: Shape.Straight, line: null, idx: 0 };
    this.byKey.set(tileKey(x, y), t);
    this.byId.set(id, t);
    this.dirty = true;
    return t;
  }

  /** Band drehen; Items bleiben auf dem Feld. */
  setDir(id: number, dir: Dir): void {
    const t = this.byId.get(id);
    if (!t || t.dir === dir) return;
    this.extractAll();
    t.dir = dir;
    this.dirty = true;
  }

  /** Band entfernen; gibt die Items darauf zurück. */
  remove(id: number): number[] {
    const t = this.byId.get(id);
    if (!t) return [];
    this.extractAll();
    const p = this.pending.get(id);
    this.pending.delete(id);
    this.byKey.delete(tileKey(t.x, t.y));
    this.byId.delete(id);
    this.dirty = true;
    return p ? p.items.map((i) => i.item) : [];
  }

  /** Items eines Feldes direkt setzen (Laden eines Spielstands). */
  loadTileItems(id: number, items: TileItem[]): void {
    this.extractAll();
    const t = this.byId.get(id);
    if (!t) return;
    // Alle Bänder müssen bereits hinzugefügt sein, damit die Form stimmt.
    const shape = this.shapeOf(t);
    this.pending.set(id, { lens: [laneLength(shape, 0), laneLength(shape, 1)], items });
    this.dirty = true;
  }

  ensure(): void {
    if (this.dirty) this.rebuild();
  }

  // ---------------------------------------------------------------- Topologie

  private beltFacingInto(x: number, y: number, fromDir: Dir): BeltTile | undefined {
    // Band auf (x,y), das in Richtung fromDir zeigt.
    const b = this.byKey.get(tileKey(x, y));
    return b && b.dir === fromDir ? b : undefined;
  }

  private inputs(t: BeltTile): { back?: BeltTile; left?: BeltTile; right?: BeltTile } {
    const d = t.dir;
    const back = this.beltFacingInto(t.x - DX[d], t.y - DY[d], d);
    const ld = rotCW(d, 3);
    const rd = rotCW(d, 1);
    const left = this.beltFacingInto(t.x + DX[ld], t.y + DY[ld], rd);
    const right = this.beltFacingInto(t.x + DX[rd], t.y + DY[rd], ld);
    return { back, left, right };
  }

  private shapeOf(t: BeltTile): Shape {
    const { back, left, right } = this.inputs(t);
    if (!back && left && !right) return Shape.CurveLeft;
    if (!back && right && !left) return Shape.CurveRight;
    return Shape.Straight;
  }

  /** Spurerhaltender Vorgänger eines Feldes. */
  private pred(t: BeltTile): BeltTile | undefined {
    const inp = this.inputs(t);
    if (t.shape === Shape.CurveLeft) return inp.left;
    if (t.shape === Shape.CurveRight) return inp.right;
    return inp.back;
  }

  private succ(t: BeltTile): BeltTile | undefined {
    const n = this.byKey.get(tileKey(t.x + DX[t.dir], t.y + DY[t.dir]));
    if (!n) return undefined;
    return this.pred(n) === t ? n : undefined;
  }

  // ---------------------------------------------------------------- Umbau

  /** Alle Items aus den Linien in den Zwischenspeicher pro Feld verschieben. */
  private extractAll(): void {
    if (this.dirty) return; // bereits extrahiert
    for (const line of this.lines) {
      for (let l = 0; l < 2; l++) {
        const lane = line.lanes[l];
        let pos = 0;
        let j = line.tiles.length - 1;
        for (let i = 0; i < lane.gaps.length; i++) {
          pos += lane.gaps[i];
          while (j > 0 && pos >= lane.tileEnd[j] + laneLength(line.tiles[j].shape, l)) j--;
          const t = line.tiles[j];
          let p = this.pending.get(t.id);
          if (!p) {
            p = { lens: [laneLength(t.shape, 0), laneLength(t.shape, 1)], items: [] };
            this.pending.set(t.id, p);
          }
          p.items.push({ lane: l, offset: pos - lane.tileEnd[j], item: lane.items[i] });
        }
      }
    }
    for (const line of this.lines) for (const t of line.tiles) t.line = null;
    this.lines = [];
    this.dirty = true;
  }

  private rebuild(): void {
    this.dirty = false;
    const tiles = [...this.byId.values()].sort((a, b) => tileKey(a.x, a.y) - tileKey(b.x, b.y));
    for (const t of tiles) t.shape = this.shapeOf(t);
    const preds = new Map<BeltTile, BeltTile | undefined>();
    for (const t of tiles) preds.set(t, this.pred(t));
    const visited = new Set<BeltTile>();
    const lines: TransportLine[] = [];
    const build = (start: BeltTile) => {
      const line = new TransportLine(tileKey(start.x, start.y));
      let cur: BeltTile | undefined = start;
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        cur.line = line;
        cur.idx = line.tiles.length;
        line.tiles.push(cur);
        cur = this.succ(cur);
      }
      lines.push(line);
    };
    for (const t of tiles) if (!preds.get(t)) build(t);
    for (const t of tiles) if (!visited.has(t)) build(t);
    lines.sort((a, b) => a.startKey - b.startKey);

    for (const line of lines) {
      for (let l = 0; l < 2; l++) {
        const lane = line.lanes[l];
        const n = line.tiles.length;
        lane.tileEnd = new Array(n);
        let acc = 0;
        for (let j = n - 1; j >= 0; j--) {
          lane.tileEnd[j] = acc;
          acc += laneLength(line.tiles[j].shape, l);
        }
        lane.len = acc;
      }
    }
    // Ausgänge
    for (const line of lines) {
      const end = line.tiles[line.tiles.length - 1];
      const nx = end.x + DX[end.dir];
      const ny = end.y + DY[end.dir];
      const b = this.byKey.get(tileKey(nx, ny));
      if (!b || !b.line) continue;
      if (b.line === line && b.idx === 0 && this.succ(end) === b) {
        // geschlossene Schleife: Ende speist in den eigenen Anfang
        for (let l = 0; l < 2; l++) line.lanes[l].out = { line, lane: l, d: line.lanes[l].len };
        continue;
      }
      if (b.dir === end.dir || b.dir === rotCW(end.dir, 2)) continue; // frontal oder (unmöglich) gerade
      const fromLeft = end.dir === rotCW(b.dir, 1);
      const near = fromLeft ? 0 : 1;
      const tl = b.line.lanes[near];
      const base = tl.tileEnd[b.idx];
      const len = laneLength(b.shape, near);
      const late = Math.round((BELT.sideloadLate * len) / P);
      const early = Math.round((BELT.sideloadEarly * len) / P);
      line.lanes[0].out = { line: b.line, lane: near, d: base + (fromLeft ? late : early) };
      line.lanes[1].out = { line: b.line, lane: near, d: base + (fromLeft ? early : late) };
    }
    // Items wieder einsetzen
    for (const line of lines) {
      for (let l = 0; l < 2; l++) {
        const lane = line.lanes[l];
        let prev = 0;
        for (let j = line.tiles.length - 1; j >= 0; j--) {
          const t = line.tiles[j];
          const p = this.pending.get(t.id);
          if (!p) continue;
          const newLen = laneLength(t.shape, l);
          const oldLen = p.lens[l];
          const own = p.items.filter((i) => i.lane === l).sort((a, b) => a.offset - b.offset);
          for (const it of own) {
            let off = oldLen === newLen ? it.offset : Math.floor((it.offset * newLen) / oldLen);
            if (off >= newLen) off = newLen - 1;
            const pos = lane.tileEnd[j] + off;
            lane.gaps.push(pos - prev);
            lane.items.push(it.item);
            prev = pos;
          }
        }
        lane.active = 0;
      }
    }
    this.pending.clear();
    this.lines = lines;
  }

  // ---------------------------------------------------------------- Simulation

  update(): void {
    this.ensure();
    for (const line of this.lines) {
      this.stepLane(line.lanes[0]);
      this.stepLane(line.lanes[1]);
    }
  }

  private stepLane(lane: Lane): void {
    const gaps = lane.gaps;
    let n = gaps.length;
    if (n === 0) return;
    let rem = SPEED;
    let i = lane.active;
    let firstMoving = -1;
    let deferred = -1; // Item, das in die eigene Spur (Schleife) zurückkehrt
    let deferredD = 0;

    if (i === 0) {
      // vorderstes Item
      for (;;) {
        const g0 = gaps[0];
        if (g0 > rem) {
          gaps[0] = g0 - rem;
          if (firstMoving < 0) firstMoving = 0;
          rem = 0;
          break;
        }
        const out = lane.out;
        if (out) {
          const over = rem - g0;
          let d = out.d - over;
          const target = out.line.lanes[out.lane];
          if (target === lane) {
            if (d >= lane.len) d = lane.len - 1;
            if (deferred < 0 && this.canInsertSelfLoop(lane, d)) {
              deferred = lane.items[0];
              deferredD = d;
              this.removeFront(lane);
              n--;
              if (firstMoving < 0) firstMoving = 0;
              if (n === 0) { rem = 0; break; }
              rem = SPEED;
              continue;
            }
          } else if (this.insertAt(target, Math.max(0, d), lane.items[0])) {
            this.removeFront(lane);
            n--;
            if (firstMoving < 0) firstMoving = 0;
            if (n === 0) { rem = 0; break; }
            rem = SPEED;
            continue;
          }
        }
        // blockiert am Ende
        if (g0 > 0 && firstMoving < 0) firstMoving = 0;
        gaps[0] = 0;
        rem -= g0;
        break;
      }
      i = 1;
    }
    for (; i < n && rem > 0; i++) {
      const slack = gaps[i] - S;
      if (slack <= 0) continue;
      const take = slack < rem ? slack : rem;
      gaps[i] -= take;
      rem -= take;
      if (firstMoving < 0) firstMoving = i;
    }
    lane.firstMoving = firstMoving < 0 ? n : firstMoving;

    // Cache: erstes Item, das sich noch bewegen kann
    let a = lane.active;
    if (a === 0 && !(lane.out || gaps[0] > 0)) a = 1;
    if (a === 0 && n > 0) {
      // Front kann sich bewegen, bleibt aktiv
    } else {
      if (a < 1) a = 1;
      while (a < n && gaps[a] <= S) a++;
    }
    lane.active = n === 0 ? 0 : a;

    if (deferred >= 0) this.insertAt(lane, deferredD, deferred);
  }

  private removeFront(lane: Lane): void {
    const g0 = lane.gaps[0];
    lane.gaps.shift();
    lane.items.shift();
    if (lane.gaps.length > 0) lane.gaps[0] += g0;
    lane.active = 0;
  }

  /** Platz am Anfang der eigenen Spur (Schleife); das vorderste Item verlässt die Spur gerade. */
  private canInsertSelfLoop(lane: Lane, d: number): boolean {
    if (lane.gaps.length <= 1) return true;
    let last = 0;
    for (let i = 0; i < lane.gaps.length; i++) last += lane.gaps[i];
    return d - last >= S;
  }

  /** Prüft Platz und fügt ein Item an Position d (Abstand zum Linienende) ein. */
  insertAt(lane: Lane, d: number, item: number): boolean {
    if (d < 0 || d >= lane.len) return false;
    const gaps = lane.gaps;
    let pos = 0;
    let k = 0;
    for (; k < gaps.length; k++) {
      const np = pos + gaps[k];
      if (np > d) break;
      pos = np;
    }
    // pos = Position des Items davor (k-1) oder 0
    if (k > 0 && d - pos < S) return false;
    if (k < gaps.length) {
      const behind = pos + gaps[k];
      if (behind - d < S) return false;
      gaps[k] = behind - d;
    }
    gaps.splice(k, 0, d - pos);
    lane.items.splice(k, 0, item);
    if (k < lane.active) lane.active = k;
    return true;
  }

  // ---------------------------------------------------------------- Abfragen

  /** Spur und Abstand zum Feldende für einen Punkt (fx,fy in 0..1 innerhalb des Feldes). */
  static locate(t: { dir: Dir; shape: Shape }, fx: number, fy: number): { lane: number; offset: number } {
    const [ux, uy] = rotateVec(fx - 0.5, fy - 0.5, ((4 - t.dir) % 4) as Dir);
    const u = ux + 0.5;
    const v = uy + 0.5;
    let lane: number;
    let tt: number;
    if (t.shape === Shape.Straight) {
      lane = u < 0.5 ? 0 : 1;
      tt = 1 - v;
    } else if (t.shape === Shape.CurveLeft) {
      const r = Math.hypot(u, v);
      lane = r < 0.5 ? 0 : 1;
      tt = Math.atan2(u, v) / (Math.PI / 2);
    } else {
      const r = Math.hypot(1 - u, v);
      lane = r < 0.5 ? 1 : 0;
      tt = Math.atan2(1 - u, v) / (Math.PI / 2);
    }
    tt = Math.min(1, Math.max(0, tt));
    const len = laneLength(t.shape, lane);
    let offset = Math.round((1 - tt) * len);
    if (offset >= len) offset = len - 1;
    return { lane, offset };
  }

  /** Punkt (Feldkoordinaten innerhalb des Feldes) für Spur und Abstand zum Feldende. */
  static pointOn(shape: Shape, dir: Dir, lane: number, offset: number, out: { x: number; y: number }): void {
    const len = laneLength(shape, lane);
    const tt = 1 - offset / len;
    let u: number;
    let v: number;
    if (shape === Shape.Straight) {
      u = lane === 0 ? 0.5 - BELT.laneOffset : 0.5 + BELT.laneOffset;
      v = 1 - tt;
    } else {
      const a = (tt * Math.PI) / 2;
      if (shape === Shape.CurveLeft) {
        const r = lane === 0 ? 0.5 - BELT.laneOffset : 0.5 + BELT.laneOffset;
        u = r * Math.sin(a);
        v = r * Math.cos(a);
      } else {
        const r = lane === 1 ? 0.5 - BELT.laneOffset : 0.5 + BELT.laneOffset;
        u = 1 - r * Math.sin(a);
        v = r * Math.cos(a);
      }
    }
    const [rx, ry] = rotateVec(u - 0.5, v - 0.5, dir);
    out.x = rx + 0.5;
    out.y = ry + 0.5;
  }

  /** Item an einem Punkt auf ein Band legen (Bohrer, Greifarm, Debug). */
  insertAtPoint(t: BeltTile, fx: number, fy: number, item: number, forceLane?: number): boolean {
    this.ensure();
    if (!t.line) return false;
    const loc = BeltSystem.locate(t, fx, fy);
    const laneIdx = forceLane ?? loc.lane;
    const lane = t.line.lanes[laneIdx];
    const len = laneLength(t.shape, laneIdx);
    const off = forceLane === undefined ? loc.offset : Math.min(len - 1, Math.round((loc.offset * len) / laneLength(t.shape, loc.lane)));
    return this.insertAt(lane, lane.tileEnd[t.idx] + off, item);
  }

  /** Items, die logisch auf diesem Feld liegen. */
  itemsOnTile(t: BeltTile): TileItem[] {
    this.ensure();
    const out: TileItem[] = [];
    if (!t.line) return out;
    for (let l = 0; l < 2; l++) {
      const lane = t.line.lanes[l];
      const lo = lane.tileEnd[t.idx];
      const hi = lo + laneLength(t.shape, l);
      let pos = 0;
      for (let i = 0; i < lane.gaps.length; i++) {
        pos += lane.gaps[i];
        if (pos >= hi) break;
        if (pos >= lo) out.push({ lane: l, offset: pos - lo, item: lane.items[i] });
      }
    }
    return out;
  }

  /**
   * Nimmt ein Item vom Feld, das accept() erfüllt. Bevorzugt das vorderste Item
   * (kleinster Abstand zum Feldende) über beide Spuren.
   */
  takeFromTile(t: BeltTile, accept: (item: number) => boolean): number {
    this.ensure();
    if (!t.line) return -1;
    let bestLane = -1;
    let bestIdx = -1;
    let bestOff = Infinity;
    for (let l = 0; l < 2; l++) {
      const lane = t.line.lanes[l];
      const lo = lane.tileEnd[t.idx];
      const hi = lo + laneLength(t.shape, l);
      let pos = 0;
      for (let i = 0; i < lane.gaps.length; i++) {
        pos += lane.gaps[i];
        if (pos >= hi) break;
        if (pos >= lo && accept(lane.items[i])) {
          if (pos - lo < bestOff) {
            bestOff = pos - lo;
            bestLane = l;
            bestIdx = i;
          }
          break;
        }
      }
    }
    if (bestLane < 0) return -1;
    const lane = t.line.lanes[bestLane];
    const item = lane.items[bestIdx];
    const g = lane.gaps[bestIdx];
    lane.gaps.splice(bestIdx, 1);
    lane.items.splice(bestIdx, 1);
    if (bestIdx < lane.gaps.length) lane.gaps[bestIdx] += g;
    if (bestIdx < lane.active) lane.active = bestIdx;
    if (lane.active > 0 && bestIdx === 0) lane.active = 0;
    return item;
  }

  /** Alle Items je Feld (Speichern). */
  serializeItems(): Map<number, TileItem[]> {
    this.ensure();
    const out = new Map<number, TileItem[]>();
    for (const line of this.lines) {
      for (let l = 0; l < 2; l++) {
        const lane = line.lanes[l];
        let pos = 0;
        let j = line.tiles.length - 1;
        for (let i = 0; i < lane.gaps.length; i++) {
          pos += lane.gaps[i];
          while (j > 0 && pos >= lane.tileEnd[j] + laneLength(line.tiles[j].shape, l)) j--;
          const t = line.tiles[j];
          let arr = out.get(t.id);
          if (!arr) out.set(t.id, (arr = []));
          arr.push({ lane: l, offset: pos - lane.tileEnd[j], item: lane.items[i] });
        }
      }
    }
    return out;
  }

  get itemCount(): number {
    this.ensure();
    let n = 0;
    for (const line of this.lines) n += line.lanes[0].gaps.length + line.lanes[1].gaps.length;
    return n;
  }
}
