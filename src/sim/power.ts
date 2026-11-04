import type { PoleDef } from '../data/entities';
import type { ElectricSource } from './energy';
import type { World } from './world';

/** Stromerzeuger (Dampfmaschine). */
export interface Generator {
  /** Mögliche Leistung in diesem Tick (J). */
  potential(): number;
  /** Tatsächlich abgerufene Energie (J); verbraucht Dampf. */
  produce(joules: number): void;
}

export function isGenerator(e: unknown): e is Generator {
  return typeof (e as Generator | null)?.potential === 'function';
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
  /** Statistik des letzten Ticks (J/Tick). */
  demand = 0;
  supplied = 0;
  potential = 0;
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
    // Verbraucher und Erzeuger zuordnen
    for (const e of w.entities.values()) {
      if (e.kind === 'pole') continue;
      const el = electricOf(e);
      const gen = isGenerator(e) ? e : null;
      if (el) el.connected = false;
      if (!el && !gen) continue;
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
      }
      if (gen) found.generators.push(gen);
    }
    this.nets = nets;
  }

  /** Verteilt die verfügbare Leistung anteilig auf die Puffer der Verbraucher. */
  update(): void {
    for (const net of this.nets) {
      let demand = 0;
      for (const c of net.consumers) demand += c.request();
      let potential = 0;
      const pots = net.generators.map((g) => {
        const p = g.potential();
        potential += p;
        return p;
      });
      const supply = Math.min(demand, potential);
      net.demand = demand;
      net.potential = potential;
      net.supplied = supply;
      if (demand > 0) {
        for (const c of net.consumers) c.supply(Math.floor((c.request() * supply) / demand));
      }
      if (potential > 0 && supply > 0) {
        net.generators.forEach((g, i) => g.produce(Math.ceil((supply * pots[i]) / potential)));
      }
    }
  }
}
