/** Deterministische Ganzzahl-Hashes und Zufall (unabhängig von der JS-Engine). */

export function hash32(a: number, b = 0, c = 0, d = 0): number {
  let h = 0x9e3779b9 ^ a;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ b ^ (h >>> 13), 0xc2b2ae35);
  h = Math.imul(h ^ c ^ (h >>> 16), 0x27d4eb2f);
  h = Math.imul(h ^ d ^ (h >>> 15), 0x165667b1);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash -> [0,1) */
export function hash01(a: number, b = 0, c = 0, d = 0): number {
  return hash32(a, b, c, d) / 4294967296;
}

/** Mulberry32 – kleiner, schneller Seed-Zufallsgenerator. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  nextU32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  next(): number {
    return this.nextU32() / 4294967296;
  }
  int(min: number, maxExcl: number): number {
    return min + Math.floor(this.next() * (maxExcl - min));
  }
}

/** Glattes 2D-Wertrauschen in [0,1). Nur +,-,*,/ und floor → deterministisch. */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash01(seed, x0, y0);
  const b = hash01(seed, x0 + 1, y0);
  const c = hash01(seed, x0, y0 + 1);
  const d = hash01(seed, x0 + 1, y0 + 1);
  const top = a + (b - a) * sx;
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

/** Fraktales Rauschen aus mehreren Oktaven valueNoise, Ergebnis etwa in [0,1). */
export function fbm(seed: number, x: number, y: number, octaves = 4, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(seed + o * 101, x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= 2.03;
  }
  return sum / norm;
}
