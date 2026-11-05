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

const R = 3;
const CURVE_LEN = (Math.PI / 2) * R;

/** Drehung im 4×4-Block um die Mitte (dir Schritte im Uhrzeigersinn, y nach unten). */
function rot(lx: number, ly: number, dir: number): [number, number] {
  let x = lx;
  let y = ly;
  for (let k = 0; k < dir; k++) [x, y] = [4 - y, x];
  return [x, y];
}
function rotV(vx: number, vy: number, dir: number): [number, number] {
  let x = vx;
  let y = vy;
  for (let k = 0; k < dir; k++) [x, y] = [-y, x];
  return [x, y];
}

/** Geometrie eines Gleis-Gebäudes. */
export function railPiece(e: { id: number; x: number; y: number; dir: number; shape: 'straight' | 'curve' }): RailPiece {
  if (e.shape === 'straight') {
    const vertical = e.dir % 2 === 0;
    const a: RailEnd = vertical ? { x: e.x + 1, y: e.y, ox: 0, oy: -1 } : { x: e.x, y: e.y + 1, ox: -1, oy: 0 };
    const b: RailEnd = vertical ? { x: e.x + 1, y: e.y + 2, ox: 0, oy: 1 } : { x: e.x + 2, y: e.y + 1, ox: 1, oy: 0 };
    return {
      id: e.id,
      ends: [a, b],
      length: 2,
      pose: (s) => ({ x: a.x - a.ox * s, y: a.y - a.oy * s, dx: -a.ox, dy: -a.oy }),
    };
  }
  // Bogen dir 0: Mittelpunkt (4,4), von (1,4) (nach Süden offen) bis (4,1) (nach Osten offen)
  const d = e.dir;
  const local = (t: number) => {
    const ang = Math.PI + (t * Math.PI) / 2;
    return { x: 4 + R * Math.cos(ang), y: 4 + R * Math.sin(ang), tx: -Math.sin(ang), ty: Math.cos(ang) };
  };
  const [ax, ay] = rot(1, 4, d);
  const [aox, aoy] = rotV(0, 1, d);
  const [bx, by] = rot(4, 1, d);
  const [box, boy] = rotV(1, 0, d);
  return {
    id: e.id,
    ends: [
      { x: e.x + ax, y: e.y + ay, ox: aox, oy: aoy },
      { x: e.x + bx, y: e.y + by, ox: box, oy: boy },
    ],
    length: CURVE_LEN,
    pose: (s) => {
      const p = local(s / CURVE_LEN);
      const [px, py] = rot(p.x, p.y, d);
      const [tx, ty] = rotV(p.tx, p.ty, d);
      return { x: e.x + px, y: e.y + py, dx: tx, dy: ty };
    },
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
