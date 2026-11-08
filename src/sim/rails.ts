import type { RailDef } from '../data/entities';
import type { Entity } from './machines';
import type { World } from './world';

/** Punkt mit Richtung (Einheitsvektor). */
export interface Pose {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** Ende eines Gleisstücks: Lage und Richtung nach außen. */
export interface RailEnd {
  readonly x: number;
  readonly y: number;
  readonly ox: number;
  readonly oy: number;
}

/** Gleisstück im Netz: zwei Enden, Länge, Lage entlang des Stücks (s von Ende 0 nach Ende 1). */
export interface RailPiece {
  readonly id: number;
  readonly ends: readonly [RailEnd, RailEnd];
  readonly length: number;
  pose(s: number): Pose;
}

export type RailShape = RailDef['shape'];

const R = 3;
const CURVE_LEN = (Math.PI / 2) * R;
const S2 = Math.SQRT1_2;
/** 45°-Übergang: Vorlauf geradeaus, dann Bogen mit Radius 2+√2 (endet genau auf dem Diagonal-Raster). */
const HALF_R = 2 + Math.SQRT2;
const HALF_LEAD = 2 - Math.SQRT2;
const HALF_ARC = (HALF_R * Math.PI) / 4;

interface LocalPose { x: number; y: number; dx: number; dy: number }
interface LocalShape {
  w: number;
  h: number;
  length: number;
  ends: [LocalPose, LocalPose];
  at(s: number): LocalPose;
}

/** Grundformen in Richtung 0 (Blockkoordinaten, y nach Süden); Enden mit Richtung nach außen. */
function localShape(shape: RailShape): LocalShape {
  switch (shape) {
    case 'straight':
      return {
        w: 2, h: 2, length: 2,
        ends: [{ x: 1, y: 0, dx: 0, dy: -1 }, { x: 1, y: 2, dx: 0, dy: 1 }],
        at: (s) => ({ x: 1, y: s, dx: 0, dy: 1 }),
      };
    case 'curve': {
      // Mittelpunkt (4,4), von (1,4) (nach Süden offen) bis (4,1) (nach Osten offen)
      return {
        w: 4, h: 4, length: CURVE_LEN,
        ends: [{ x: 1, y: 4, dx: 0, dy: 1 }, { x: 4, y: 1, dx: 1, dy: 0 }],
        at: (s) => {
          const ang = Math.PI + (s / CURVE_LEN) * (Math.PI / 2);
          return { x: 4 + R * Math.cos(ang), y: 4 + R * Math.sin(ang), dx: -Math.sin(ang), dy: Math.cos(ang) };
        },
      };
    }
    case 'diagonal':
      // schneidet die linke obere Ecke: linke Kantenmitte (0,1) → obere Kantenmitte (1,0)
      return {
        w: 2, h: 2, length: Math.SQRT2,
        ends: [{ x: 0, y: 1, dx: -S2, dy: S2 }, { x: 1, y: 0, dx: S2, dy: -S2 }],
        at: (s) => ({ x: s * S2, y: 1 - s * S2, dx: S2, dy: -S2 }),
      };
    case 'half':
    case 'half-mirror': {
      // 2×4: von (1,4) nach Norden, Vorlauf, dann 45°-Bogen bis (2,1) Richtung Nordost (gespiegelt: (0,1), Nordwest)
      const m = shape === 'half' ? 1 : -1;
      const cx = 1 + m * HALF_R;
      const cy = 4 - HALF_LEAD;
      return {
        w: 2, h: 4, length: HALF_LEAD + HALF_ARC,
        ends: [{ x: 1, y: 4, dx: 0, dy: 1 }, { x: 1 + m, y: 1, dx: m * S2, dy: -S2 }],
        at: (s) => {
          if (s <= HALF_LEAD) return { x: 1, y: 4 - s, dx: 0, dy: -1 };
          const a = ((s - HALF_LEAD) / HALF_R);
          // Winkel vom Mittelpunkt aus: Start genau westlich (bzw. östlich) des Mittelpunkts
          return { x: cx - m * HALF_R * Math.cos(a), y: cy - HALF_R * Math.sin(a), dx: m * Math.sin(a), dy: -Math.cos(a) };
        },
      };
    }
  }
}

/** Drehung eines Punkts im w×h-Block um dir Vierteldrehungen im Uhrzeigersinn (y nach unten). */
function rotP(x: number, y: number, w: number, h: number, dir: number): [number, number] {
  let px = x;
  let py = y;
  let bw = w;
  let bh = h;
  for (let k = 0; k < dir; k++) {
    [px, py] = [bh - py, px];
    [bw, bh] = [bh, bw];
  }
  return [px, py];
}
function rotV(vx: number, vy: number, dir: number): [number, number] {
  let x = vx;
  let y = vy;
  for (let k = 0; k < dir; k++) [x, y] = [-y, x];
  return [x, y];
}

/** Geometrie eines Gleis-Gebäudes. */
export function railPiece(e: { id: number; x: number; y: number; dir: number; shape: RailShape }): RailPiece {
  // gerade Gleise: nur zwei Lagen; waagerecht wie bisher mit Ende 0 im Westen (Spielstände)
  const d = e.shape === 'straight' ? (e.dir % 2 === 0 ? 0 : 3) : e.dir;
  const L = localShape(e.shape);
  const place = (p: LocalPose): Pose => {
    const [x, y] = rotP(p.x, p.y, L.w, L.h, d);
    const [dx, dy] = rotV(p.dx, p.dy, d);
    return { x: e.x + x, y: e.y + y, dx, dy };
  };
  const a = place(L.ends[0]);
  const b = place(L.ends[1]);
  return {
    id: e.id,
    ends: [{ x: a.x, y: a.y, ox: a.dx, oy: a.dy }, { x: b.x, y: b.y, ox: b.dx, oy: b.dy }],
    length: L.length,
    pose: (s) => place(L.at(Math.max(0, Math.min(L.length, s)))),
  };
}

const nodeKey = (x: number, y: number) => Math.round(x * 2) * 100003 + Math.round(y * 2);

/** Gleisnetz: Stücke und ihre Verbindungen an gemeinsamen Enden (nur in Fortsetzungsrichtung). */
export class RailNetwork {
  readonly pieces = new Map<number, RailPiece>();
  /** Knoten → (Stück, Ende). */
  private readonly nodes = new Map<number, { piece: number; end: 0 | 1 }[]>();
  private version = -1;

  ensure(w: World): void {
    if (this.version === w.structureVersion) return;
    this.version = w.structureVersion;
    this.pieces.clear();
    this.nodes.clear();
    const rails = [...w.entities.values()].filter((e): e is Extract<Entity, { kind: 'rail' }> => e.kind === 'rail').sort((a, b) => a.id - b.id);
    for (const r of rails) {
      const p = railPiece({ id: r.id, x: r.x, y: r.y, dir: r.dir, shape: r.def.shape });
      this.pieces.set(r.id, p);
      p.ends.forEach((en, i) => {
        const k = nodeKey(en.x, en.y);
        let list = this.nodes.get(k);
        if (!list) this.nodes.set(k, (list = []));
        list.push({ piece: r.id, end: i as 0 | 1 });
      });
    }
  }

  /** Fortsetzungen, wenn man Stück p über Ende `end` verlässt: (Stück, Eintrittsende). */
  next(p: number, end: 0 | 1): { piece: number; end: 0 | 1 }[] {
    const piece = this.pieces.get(p);
    if (!piece) return [];
    const e = piece.ends[end];
    const out: { piece: number; end: 0 | 1 }[] = [];
    for (const c of this.nodes.get(nodeKey(e.x, e.y)) ?? []) {
      if (c.piece === p) continue;
      const q = this.pieces.get(c.piece)!.ends[c.end];
      if (Math.abs(q.ox + e.ox) < 1e-6 && Math.abs(q.oy + e.oy) < 1e-6) out.push(c);
    }
    return out;
  }

  /** Nächste Gleisstelle zu einem Punkt (nur gerade Stücke), höchstens maxDist entfernt. */
  nearest(x: number, y: number, maxDist = 1.5): { piece: number; s: number } | null {
    let best: { piece: number; s: number } | null = null;
    let bd = maxDist;
    for (const p of this.pieces.values()) {
      const steps = Math.ceil(p.length * 4);
      for (let i = 0; i <= steps; i++) {
        const s = (i / steps) * p.length;
        const q = p.pose(s);
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < bd) {
          bd = d;
          best = { piece: p.id, s };
        }
      }
    }
    return best;
  }
}
