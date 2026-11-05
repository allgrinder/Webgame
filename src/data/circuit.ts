/**
 * Schaltungsnetz. Quellen: Wiki „Circuit network“, „Arithmetic combinator“, „Decider combinator“, „Constant combinator“.
 * Kombinatoren geben ihr Ergebnis einen Tick später aus. Drahtreichweite für Nicht-Masten: 9 Felder (Quelle 2,
 * factorio-data circuit_wire_max_distance).
 */
export const WIRE_REACH = 9;

/** Virtuelle Signale A–Z und 0–9. */
export const VIRTUAL_SIGNALS: readonly string[] = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `signal-${c}`),
  ...'0123456789'.split('').map((c) => `signal-${c}`),
];

export function signalLabel(id: string): string {
  return id.startsWith('signal-') ? id.slice(7) : id;
}

export const COMPARATORS = ['<', '>', '=', '≥', '≤', '≠'] as const;
export type Comparator = (typeof COMPARATORS)[number];

export const ARITHMETIC_OPS = ['+', '−', '*', '/', '%', '^', '<<', '>>', 'AND', 'OR', 'XOR'] as const;
export type ArithmeticOp = (typeof ARITHMETIC_OPS)[number];

/** Signalwerte sind 32-Bit-Ganzzahlen mit Überlauf wie im Original. */
export function int32(n: number): number {
  return n | 0;
}

export function compare(a: number, op: Comparator, b: number): boolean {
  switch (op) {
    case '<': return a < b;
    case '>': return a > b;
    case '=': return a === b;
    case '≥': return a >= b;
    case '≤': return a <= b;
    case '≠': return a !== b;
  }
}

export function arithmetic(a: number, op: ArithmeticOp, b: number): number {
  switch (op) {
    case '+': return int32(a + b);
    case '−': return int32(a - b);
    case '*': return Math.imul(a, b);
    case '/': return b === 0 ? 0 : int32(Math.trunc(a / b));
    case '%': return b === 0 ? 0 : int32(a % b);
    case '^': return b < 0 ? 0 : int32(Math.pow(a, b));
    case '<<': return a << (b & 31);
    case '>>': return a >> (b & 31);
    case 'AND': return a & b;
    case 'OR': return a | b;
    case 'XOR': return a ^ b;
  }
}
