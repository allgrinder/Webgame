import { STATS } from '../data/ui';

/** Ein Zeitfenster der Statistik: count Werte, je step Sekunden zusammengefasst. */
export interface StatsWindow {
  readonly label: string;
  /** Sekunden je Messpunkt. */
  readonly step: number;
  readonly count: number;
}

type Sample = Map<string, number>;

/** Ringpuffer einer Auflösung: Messpunkte (je Item Menge) für Herstellung und Verbrauch. */
class Ring {
  readonly made: Sample[] = [];
  readonly used: Sample[] = [];
  constructor(readonly win: StatsWindow) {}
  push(made: Sample, used: Sample): void {
    this.made.push(made);
    this.used.push(used);
    if (this.made.length > this.win.count) {
      this.made.shift();
      this.used.shift();
    }
  }
}

function addTo(m: Sample, item: string, n: number): void {
  m.set(item, (m.get(item) ?? 0) + n);
}

function sum(samples: Sample[]): Sample {
  const out: Sample = new Map();
  for (const s of samples) for (const [k, v] of s) addTo(out, k, v);
  return out;
}

/**
 * Produktionsstatistik wie im Original (Taste P): hergestellte und verbrauchte Items und Flüssigkeiten,
 * in mehreren Zeitfenstern (1 min, 10 min, 1 h, 10 h). Erfasst je Sekunde, gröbere Fenster fassen feinere zusammen.
 */
export class ProductionStats {
  private madeNow: Sample = new Map();
  private usedNow: Sample = new Map();
  readonly rings: Ring[] = STATS.windows.map((w) => new Ring(w));
  /** Gesamtsummen seit Spielbeginn. */
  readonly totalMade: Sample = new Map();
  readonly totalUsed: Sample = new Map();

  made(item: string, n: number): void {
    if (n > 0) addTo(this.madeNow, item, n);
  }
  used(item: string, n: number): void {
    if (n > 0) addTo(this.usedNow, item, n);
  }

  /** Jede Sekunde (60 Ticks) von der Welt aufgerufen; seconds = Spielzeit in Sekunden. */
  second(seconds: number): void {
    for (const [k, v] of this.madeNow) addTo(this.totalMade, k, v);
    for (const [k, v] of this.usedNow) addTo(this.totalUsed, k, v);
    this.rings[0].push(this.madeNow, this.usedNow);
    this.madeNow = new Map();
    this.usedNow = new Map();
    for (let i = 1; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const k = ring.win.step / this.rings[i - 1].win.step;
      const steps = ring.win.step;
      if (seconds % steps !== 0) break;
      const src = this.rings[i - 1];
      ring.push(sum(src.made.slice(-k)), sum(src.used.slice(-k)));
    }
  }

  /** Summen je Item im Fenster i. */
  totals(i: number): { made: Sample; used: Sample } {
    const r = this.rings[i];
    return { made: sum(r.made), used: sum(r.used) };
  }

  /** Verlauf eines Items im Fenster i (Menge je Messpunkt, älteste zuerst). */
  series(i: number, item: string, kind: 'made' | 'used'): number[] {
    return this.rings[i][kind].map((s) => s.get(item) ?? 0);
  }

  serialize(): { m: [string, number][]; u: [string, number][]; pm: [string, number][]; pu: [string, number][] } {
    return { m: [...this.totalMade], u: [...this.totalUsed], pm: [...this.madeNow], pu: [...this.usedNow] };
  }
  load(d: { m: [string, number][]; u: [string, number][]; pm?: [string, number][]; pu?: [string, number][] } | undefined): void {
    if (!d) return;
    for (const [k, v] of d.m) this.totalMade.set(k, v);
    for (const [k, v] of d.u) this.totalUsed.set(k, v);
    for (const [k, v] of d.pm ?? []) this.madeNow.set(k, v);
    for (const [k, v] of d.pu ?? []) this.usedNow.set(k, v);
  }
}
