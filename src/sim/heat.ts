import { tileKey } from './geom';
import { type HeatNode, ReactorEntity, across, isHeatNode, temperatureOf } from './entities/nuclear';
import type { World } from './world';

/**
 * Wärmenetz (Wiki „Heat pipe“, „Nuclear reactor“): Knoten mit Wärmekapazität, Verbindungen zwischen
 * gegenüberliegenden Wärmeanschlüssen. Wärme fließt vom wärmeren zum kälteren Knoten; ein Rohr verliert dabei
 * 1 + P/15 °C bei P MW Durchsatz → Fluss je Tick = (ΔT − 1) × 15 MW / 60 = (ΔT − 1) × 250 kJ.
 * Reaktoren erhalten +100 % Wärme je benachbartem laufendem Reaktor.
 */
export class HeatSystem {
  private version = -1;
  private links: [HeatNode, HeatNode][] = [];
  /** Reaktor-Nachbarpaare (für den Bonus). */
  private reactorPairs: [ReactorEntity, ReactorEntity][] = [];
  /** Knoten-ID → verbundene Knoten-IDs (Darstellung der Wärmerohre). */
  readonly neighbours = new Map<number, Set<number>>();

  ensure(w: World): void {
    if (this.version === w.structureVersion) return;
    this.version = w.structureVersion;
    this.links = [];
    this.reactorPairs = [];
    this.neighbours.clear();
    const at = new Map<number, { n: HeatNode; dir: number }[]>();
    const nodes: HeatNode[] = [];
    for (const e of w.entities.values()) {
      if (!isHeatNode(e)) continue;
      nodes.push(e);
      for (const c of e.heatConnections()) {
        const k = tileKey(c[0], c[1]);
        let l = at.get(k);
        if (!l) at.set(k, (l = []));
        l.push({ n: e, dir: c[2] });
      }
    }
    nodes.sort((a, b) => a.id - b.id);
    const seen = new Set<string>();
    for (const n of nodes) {
      for (const c of n.heatConnections()) {
        const [ox, oy] = across(c);
        for (const o of at.get(tileKey(ox, oy)) ?? []) {
          if (o.n === n || o.dir !== (c[2] + 2) % 4) continue;
          const a = n.id < o.n.id ? n : o.n;
          const b = a === n ? o.n : n;
          const key = `${a.id}-${b.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          this.links.push([a, b]);
          if (!this.neighbours.has(a.id)) this.neighbours.set(a.id, new Set());
          if (!this.neighbours.has(b.id)) this.neighbours.set(b.id, new Set());
          this.neighbours.get(a.id)!.add(b.id);
          this.neighbours.get(b.id)!.add(a.id);
          if (a instanceof ReactorEntity && b instanceof ReactorEntity) this.reactorPairs.push([a, b]);
        }
      }
    }
  }

  /** Nachbarbonus vor den Gebäude-Updates setzen. */
  prepare(w: World): void {
    this.ensure(w);
    for (const e of w.entities.values()) if (e instanceof ReactorEntity) e.neighbours = 0;
    for (const [a, b] of this.reactorPairs) {
      if (a.active && b.active) {
        a.neighbours++;
        b.neighbours++;
      }
    }
  }

  /** Wärmeleitung nach den Gebäude-Updates. */
  update(): void {
    for (const [a, b] of this.links) {
      const ta = temperatureOf(a);
      const tb = temperatureOf(b);
      const d = ta - tb;
      if (Math.abs(d) <= 1) continue;
      const [hot, cold] = d > 0 ? [a, b] : [b, a];
      const dt = Math.abs(d);
      // nicht über den Ausgleich hinaus
      const equal = dt / (1 / hot.heatCapacity + 1 / cold.heatCapacity);
      const e = Math.min((dt - 1) * 250_000, equal / 2);
      const room = cold.heatCapacity * (cold.maxTemperature - 15) - cold.heat;
      const moved = Math.max(0, Math.min(e, room));
      hot.heat -= moved;
      cold.heat += moved;
    }
  }
}
