import type { PoleDef } from '../data/entities';
import type { ElectricSource } from './energy';
import { ProductionStats } from './stats';
import type { World } from './world';

/** Stromerzeuger. Vorrang wie im Original: 'primary' (Solar) vor 'secondary' (Dampf) vor Akkumulatoren. */
export interface Generator {
  readonly priority?: 'primary' | 'secondary';
  /** Tageslicht 0..1 (nur Solar), vom Netz gesetzt. */
  light?: number;
  /** Mögliche Leistung in diesem Tick (J). */
  potential(): number;
  /** Tatsächlich abgerufene Energie (J); verbraucht Dampf. */
  produce(joules: number): void;
}

export function isGenerator(e: unknown): e is Generator {
  return typeof (e as Generator | null)?.potential === 'function';
}

/** Speicher im Netz (Akkumulator). */
export interface Storage {
  chargeRoom(): number;
  dischargeMax(): number;
  charge(j: number): void;
  discharge(j: number): void;
}

export function isStorage(e: unknown): e is Storage {
  return typeof (e as Storage | null)?.chargeRoom === 'function';
}

/** Verteilt amount anteilig nach weights (ganzzahlig, Rest an die ersten). */
function share(amount: number, weights: number[], total: number, apply: (i: number, j: number) => void): void {
  if (amount <= 0 || total <= 0) return;
  let left = amount;
  weights.forEach((w, i) => {
    const j = Math.min(left, Math.ceil((amount * w) / total));
    if (j > 0) apply(i, j);
    left -= j;
  });
}

/** Gebäude mit elektrischem Verbrauch. */
export interface ElectricConsumer {
  readonly energy: unknown;
}

function electricOf(e: unknown): ElectricSource | null {
  const en = (e as { energy?: { type?: string } } | null)?.energy;
  return en && en.type === 'electric' ? (en as ElectricSource) : null;
}

export class PowerNet {
  readonly poles: number[] = [];
  readonly consumers: ElectricSource[] = [];
  readonly generators: Generator[] = [];
  readonly storages: Storage[] = [];
  /** Gebäudenamen parallel zu consumers/generators/storages (Statistik). */
  readonly consumerNames: string[] = [];
  readonly generatorNames: string[] = [];
  readonly storageNames: string[] = [];
  /** Schlüssel des Netzes (kleinste Mast-ID) und seine Statistik (J je Gebäudeart). */
  key = 0;
  stats = new ProductionStats();
  /** Statistik des letzten Ticks (J/Tick). */
  demand = 0;
  supplied = 0;
  potential = 0;
  /** Davon aus Solar, Dampf, Akkumulatoren; in die Akkumulatoren geladen. */
  fromPrimary = 0;
  fromSecondary = 0;
  fromStorage = 0;
  charged = 0;
}

/**
 * Stromnetze: Masten in Kabelreichweite bilden ein Netz; Verbraucher und Erzeuger gehören zu dem
 * Netz, dessen Versorgungsbereich ihre Grundfläche berührt (bei mehreren: Mast mit kleinster ID).
 */
export class PowerSystem {
  private version = -1;
  nets: PowerNet[] = [];
  /** Kabelverbindungen (Mast-ID-Paare) für die Darstellung. */
  wires: [number, number][] = [];
  /** Netz je Gebäude-ID (Masten, Verbraucher, Erzeuger). */
  readonly netOf = new Map<number, PowerNet>();
  /** Statistik je Netzschlüssel, bleibt über Umbauten erhalten. */
  private readonly statsByKey = new Map<number, ProductionStats>();

  ensure(w: World): void {
    if (this.version === w.structureVersion) return;
    this.version = w.structureVersion;
    this.rebuild(w);
  }

  private rebuild(w: World): void {
    const poles = [...w.entities.values()].filter((e) => e.kind === 'pole').sort((a, b) => a.id - b.id);
    const parent = new Map<number, number>();
    const find = (a: number): number => {
      let r = a;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(a, r);
      return r;
    };
    for (const p of poles) parent.set(p.id, p.id);
    this.wires = [];
    for (let i = 0; i < poles.length; i++) {
      for (let j = i + 1; j < poles.length; j++) {
        const a = poles[i];
        const b = poles[j];
        const reach = Math.min((a.def as PoleDef).wireReach, (b.def as PoleDef).wireReach);
        const dx = a.cx - b.cx;
        const dy = a.cy - b.cy;
        if (dx * dx + dy * dy <= reach * reach) {
          this.wires.push([a.id, b.id]);
          const ra = find(a.id);
          const rb = find(b.id);
          if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
        }
      }
    }
    const byRoot = new Map<number, PowerNet>();
    this.netOf.clear();
    const nets: PowerNet[] = [];
    for (const p of poles) {
      const r = find(p.id);
      let net = byRoot.get(r);
      if (!net) {
        net = new PowerNet();
        byRoot.set(r, net);
        nets.push(net);
      }
      net.poles.push(p.id);
      this.netOf.set(p.id, net);
    }
    for (const net of nets) {
      net.key = net.poles[0];
      net.stats = this.statsByKey.get(net.key) ?? new ProductionStats();
    }
    this.statsByKey.clear();
    for (const net of nets) this.statsByKey.set(net.key, net.stats);
    // Verbraucher und Erzeuger zuordnen
    for (const e of w.entities.values()) {
      if (e.kind === 'pole') continue;
      const el = electricOf(e);
      const gen = isGenerator(e) ? e : null;
      const sto = isStorage(e) ? e : null;
      if (el) el.connected = false;
      if (!el && !gen && !sto) continue;
      let found: PowerNet | null = null;
      for (const p of poles) {
        const r = (p.def as PoleDef).supplyRadius;
        if (e.x + e.w > p.cx - r && e.x < p.cx + r && e.y + e.h > p.cy - r && e.y < p.cy + r) {
          found = this.netOf.get(p.id)!;
          break;
        }
      }
      if (!found) continue;
      this.netOf.set(e.id, found);
      if (el) {
        el.connected = true;
        found.consumers.push(el);
        found.consumerNames.push(e.name);
      }
      if (gen) {
        found.generators.push(gen);
        found.generatorNames.push(e.name);
      }
      if (sto) {
        found.storages.push(sto);
        found.storageNames.push(e.name);
      }
    }
    this.nets = nets;
  }

  /**
   * Verteilt die Leistung: Bedarf zuerst aus Solar, dann aus Dampf, Rest aus Akkumulatoren.
   * Überschuss (Solar zuerst, dann Dampf) lädt die Akkumulatoren. Quelle: Wiki „Electric system“.
   */
  update(light = 1): void {
    for (const net of this.nets) {
      let demand = 0;
      for (const c of net.consumers) demand += c.request();
      const prim: Generator[] = [];
      const sec: Generator[] = [];
      const primN: string[] = [];
      const secN: string[] = [];
      net.generators.forEach((g, i) => {
        if (g.priority === 'primary') {
          g.light = light;
          prim.push(g);
          primN.push(net.generatorNames[i]);
        } else {
          sec.push(g);
          secN.push(net.generatorNames[i]);
        }
      });
      const st = net.stats;
      const p1 = prim.map((g) => g.potential());
      const p2 = sec.map((g) => g.potential());
      const P1 = p1.reduce((a, b) => a + b, 0);
      const P2 = p2.reduce((a, b) => a + b, 0);
      const s1 = Math.min(demand, P1);
      const s2 = Math.min(demand - s1, P2);
      const outMax = net.storages.map((a) => a.dischargeMax());
      const OUT = outMax.reduce((a, b) => a + b, 0);
      const s3 = Math.min(demand - s1 - s2, OUT);
      let c1 = 0;
      let c2 = 0;
      const room = net.storages.map((a) => a.chargeRoom());
      const ROOM = room.reduce((a, b) => a + b, 0);
      if (s3 === 0 && ROOM > 0) {
        c1 = Math.min(ROOM, P1 - s1);
        c2 = Math.min(ROOM - c1, P2 - s2);
      }
      const supply = s1 + s2 + s3;
      net.demand = demand;
      net.potential = P1 + P2 + OUT;
      net.supplied = supply;
      net.fromPrimary = s1;
      net.fromSecondary = s2;
      net.fromStorage = s3;
      net.charged = c1 + c2;
      if (demand > 0) {
        net.consumers.forEach((c, i) => {
          const j = Math.floor((c.request() * supply) / demand);
          c.supply(j);
          st.used(net.consumerNames[i], j);
        });
      }
      share(s1 + c1, p1, P1, (i, j) => {
        prim[i].produce(j);
        st.made(primN[i], j);
      });
      share(s2 + c2, p2, P2, (i, j) => {
        sec[i].produce(j);
        st.made(secN[i], j);
      });
      share(s3, outMax, OUT, (i, j) => {
        net.storages[i].discharge(j);
        st.made(net.storageNames[i], j);
      });
      share(c1 + c2, room, ROOM, (i, j) => {
        net.storages[i].charge(j);
        st.used(net.storageNames[i], j);
      });
    }
  }

  /** Jede Sekunde: Statistik aller Netze fortschreiben. */
  second(seconds: number): void {
    for (const st of this.statsByKey.values()) st.second(seconds);
  }
}
