/** Richtungen: 0 = Nord, 1 = Ost, 2 = Süd, 3 = West (y wächst nach Süden). */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export function rotCW(d: Dir, n = 1): Dir {
  return (((d + n) % 4) + 4) % 4 as Dir;
}
export function opposite(d: Dir): Dir {
  return rotCW(d, 2);
}

/** Vektor, der für Richtung Nord definiert ist, in Richtung d drehen. */
export function rotateVec(x: number, y: number, d: Dir): [number, number] {
  switch (d) {
    case 0: return [x, y];
    case 1: return [-y, x];
    case 2: return [-x, -y];
    case 3: return [y, -x];
  }
}

const OFF = 32768;
/** Feldkoordinate -> eindeutiger Zahlenschlüssel (Bereich ±32767). */
export function tileKey(x: number, y: number): number {
  return (x + OFF) * 65536 + (y + OFF);
}
export function keyX(k: number): number {
  return Math.floor(k / 65536) - OFF;
}
export function keyY(k: number): number {
  return (k % 65536) - OFF;
}

export function dirFromDelta(dx: number, dy: number): Dir | undefined {
  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === 0) return 1;
  if (dx === 0 && dy === 1) return 2;
  if (dx === -1 && dy === 0) return 3;
  return undefined;
}
