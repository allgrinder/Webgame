import { entityDef, sizeOf } from '../data/entities';
import { ROBOPORT, ROBOTS, ROBOT_LOW_POWER_SPEED, type RobotDef } from '../data/robots';
import { wattsToJoulesPerTick } from '../data/time';
import { applySettings } from './blueprint';
import type { Dir } from './geom';
import type { Stack } from './inventory';
import type { ContainerEntity, Entity, RoboportEntity } from './machines';
import type { World } from './world';

export type RobotTask =
  /** Bauen: 0 = zur Kiste (Item holen), 1 = zum Geist. */
  | { t: 'build'; ghost: number; from: number; item: string; count: number; phase: 0 | 1 }
  /** Abreißen: 0 = zum Gebäude, 1 = zur Lagerkiste. */
  | { t: 'decon'; target: number; to: number; phase: 0 | 1 }
  /** Liefern: 0 = zum Anbieter, 1 = zum Empfänger. */
  | { t: 'deliver'; from: number; to: number; item: string; count: number; phase: 0 | 1 }
  /** Heimflug zum Hangar (dort laden und einparken). */
  | { t: 'home'; port: number };

export interface Robot {
  readonly id: number;
  readonly kind: RobotDef['id'];
  x: number;
  y: number;
  energy: number;
  task: RobotTask;
  cargo: Stack[];
  /** Wartet am Hangar auf einen Ladeplatz bzw. lädt. */
  charging: boolean;
}

/** Ein Logistiknetz: Hangars, deren 50×50-Bereiche sich berühren, und die Kisten darin. */
export interface LogisticNetwork {
  readonly ports: RoboportEntity[];
  readonly chests: ContainerEntity[];
}

const PRIORITY_PICKUP: Record<string, number> = { 'active-provider': 0, storage: 1, buffer: 1, 'passive-provider': 2 };

function inRect(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return x >= cx - r && x < cx + r && y >= cy - r && y < cy + r;
}

/**
 * Roboter: fliegen geradlinig zwischen Hangar, Kisten und Baustellen. Bauroboter bauen Geister (Blaupausen) und reißen
 * markierte Gebäude ab; Logistikroboter beliefern Anforderungskisten und leeren aktive Anbieterkisten in Lagerkisten.
 * Akku: Verbrauch im Flug laut Infobox; leer nur 20 % Tempo; Laden am Hangar (4 Plätze je 500 kW).
 */
export class RobotSystem {
  readonly robots: Robot[] = [];
  nets: LogisticNetwork[] = [];
  private nextId = 1;
  private version = -1;
  /** Zum Abriss markierte Gebäude. */
  readonly marked = new Set<number>();
  /** Vorgemerkte Entnahmen (Kiste → Item → Menge) und Lieferungen (Kiste → Item → Menge). */
  private readonly reserved = new Map<number, Map<string, number>>();
  private readonly incoming = new Map<number, Map<string, number>>();
  /** Geister und Gebäude, die schon einen Roboter haben. */
  private readonly busy = new Set<string>();

  // ------------------------------------------------------------------ Netze

  ensure(w: World): void {
    if (this.version === w.structureVersion) return;
    this.version = w.structureVersion;
    const ports = [...w.entities.values()].filter((e): e is RoboportEntity => e.kind === 'roboport').sort((a, b) => a.id - b.id);
    const parent = ports.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const R = ROBOPORT.logisticRadius;
    for (let i = 0; i < ports.length; i++) {
      for (let j = i + 1; j < ports.length; j++) {
        if (Math.abs(ports[i].px - ports[j].px) <= 2 * R && Math.abs(ports[i].py - ports[j].py) <= 2 * R) parent[find(j)] = find(i);
      }
    }
    const byRoot = new Map<number, LogisticNetwork>();
    ports.forEach((p, i) => {
      const r = find(i);
      let n = byRoot.get(r);
      if (!n) byRoot.set(r, (n = { ports: [], chests: [] }));
      n.ports.push(p);
    });
    this.nets = [...byRoot.values()];
    for (const e of w.entities.values()) {
      if (e.kind !== 'container' || !e.logistic) continue;
      const net = this.netAt(e.x + 0.5, e.y + 0.5, 'logistic');
      if (net) net.chests.push(e);
    }
    for (const n of this.nets) n.chests.sort((a, b) => a.id - b.id);
    for (const id of [...this.marked]) if (!w.entities.has(id)) this.marked.delete(id);
  }

  /** Netz, dessen Logistik- bzw. Baubereich den Punkt enthält. */
  netAt(x: number, y: number, area: 'logistic' | 'construction'): LogisticNetwork | undefined {
    const r = area === 'logistic' ? ROBOPORT.logisticRadius : ROBOPORT.constructionRadius;
    return this.nets.find((n) => n.ports.some((p) => inRect(x, y, p.px, p.py, r)));
  }

  // ------------------------------------------------------------------ Vormerkungen

  private bump(m: Map<number, Map<string, number>>, id: number, item: string, n: number): void {
    let inner = m.get(id);
    if (!inner) m.set(id, (inner = new Map()));
    const v = (inner.get(item) ?? 0) + n;
    if (v <= 0) inner.delete(item);
    else inner.set(item, v);
  }
  private get(m: Map<number, Map<string, number>>, id: number, item: string): number {
    return m.get(id)?.get(item) ?? 0;
  }
  available(c: ContainerEntity, item: string): number {
    return c.inventory.count(item) - this.get(this.reserved, c.id, item);
  }

  // ------------------------------------------------------------------ Aufgaben

  /** Freien Roboter einer Art aus dem nächstgelegenen Hangar mit Strom starten. */
  private launch(net: LogisticNetwork, kind: RobotDef['id'], x: number, y: number, task: RobotTask): Robot | null {
    let best: RoboportEntity | null = null;
    let bd = Infinity;
    for (const p of net.ports) {
      if (p.robots.count(kind) < 1) continue;
      const d = (p.px - x) ** 2 + (p.py - y) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) return null;
    best.robots.remove(kind, 1);
    const r: Robot = { id: this.nextId++, kind, x: best.px, y: best.py, energy: ROBOTS[kind].capacity, task, cargo: [], charging: false };
    this.robots.push(r);
    this.claim(r, +1);
    return r;
  }

  /** Vormerkungen einer Aufgabe setzen (+1) oder lösen (−1). */
  private claim(r: Robot, s: 1 | -1): void {
    const t = r.task;
    if (t.t === 'build') {
      if (t.phase === 0) this.bump(this.reserved, t.from, t.item, s * (t.count ?? 1));
      if (s > 0) this.busy.add(`g${t.ghost}`);
      else this.busy.delete(`g${t.ghost}`);
    } else if (t.t === 'decon') {
      if (s > 0) this.busy.add(`e${t.target}`);
      else this.busy.delete(`e${t.target}`);
    } else if (t.t === 'deliver') {
      if (t.phase === 0) this.bump(this.reserved, t.from, t.item, s * t.count);
      this.bump(this.incoming, t.to, t.item, s * t.count);
    }
  }

  /** Aufgabe wechseln: alte Vormerkungen lösen, neue setzen. */
  private retask(r: Robot, task: RobotTask): void {
    this.claim(r, -1);
    r.task = task;
    this.claim(r, +1);
  }

  private dispatch(w: World): void {
    for (const net of this.nets) {
      let budget = 8;
      // Bauen
      for (const g of w.ghosts.all.values()) {
        if (budget <= 0) break;
        if (this.busy.has(`g${g.id}`)) continue;
        const [gw, gh] = sizeOf(entityDef(g.name), g.dir);
        if (this.netAt(g.x + gw / 2, g.y + gh / 2, 'construction') !== net) continue;
        const item = entityDef(g.name).item;
        const count = entityDef(g.name).itemCount ?? 1;
        const src = this.pickSource(net, item, g.x, g.y, -1, false, count);
        if (!src) continue;
        if (this.launch(net, 'construction-robot', src.x, src.y, { t: 'build', ghost: g.id, from: src.id, item, count, phase: 0 })) budget--;
        else break;
      }
      // Abreißen
      for (const id of this.marked) {
        if (budget <= 0) break;
        if (this.busy.has(`e${id}`)) continue;
        const e = w.entities.get(id);
        if (!e || this.netAt(e.cx, e.cy, 'construction') !== net) continue;
        const to = this.pickStorage(net, entityDef(e.name).item, e.cx, e.cy);
        if (!to) continue;
        if (this.launch(net, 'construction-robot', e.cx, e.cy, { t: 'decon', target: id, to: to.id, phase: 0 })) budget--;
        else break;
      }
      // Liefern: Anforderungen, dann aktive Anbieter → Lager
      for (const c of net.chests) {
        if (budget <= 0) break;
        if (c.logistic !== 'requester' && c.logistic !== 'buffer') continue;
        for (const rq of c.requests) {
          const missing = rq.count - c.inventory.count(rq.item) - this.get(this.incoming, c.id, rq.item);
          if (missing <= 0 || c.inventory.space(rq.item) <= 0) continue;
          const src = this.pickSource(net, rq.item, c.x, c.y, c.id, c.logistic === 'buffer');
          if (!src) continue;
          const n = Math.min(missing, ROBOTS['logistic-robot'].cargo + w.research.bonus('robot-cargo'), this.available(src, rq.item));
          if (this.launch(net, 'logistic-robot', src.x, src.y, { t: 'deliver', from: src.id, to: c.id, item: rq.item, count: n, phase: 0 })) budget--;
          else break;
        }
      }
      for (const c of net.chests) {
        if (budget <= 0) break;
        if (c.logistic !== 'active-provider') continue;
        const it = c.inventory.firstItem((i) => this.available(c, i) > 0);
        if (!it) continue;
        const to = this.pickStorage(net, it, c.x, c.y);
        if (!to) continue;
        if (this.launch(net, 'logistic-robot', c.x, c.y, { t: 'deliver', from: c.id, to: to.id, item: it, count: 1, phase: 0 })) budget--;
      }
    }
  }

  /** Anbieter für ein Item: aktive Anbieter > Lager/Puffer > passive Anbieter, dann am nächsten. */
  private pickSource(net: LogisticNetwork, item: string, x: number, y: number, except: number, forBuffer = false, need = 1): ContainerEntity | null {
    let best: ContainerEntity | null = null;
    let bp = Infinity;
    let bd = Infinity;
    for (const c of net.chests) {
      if (c.id === except || !c.logistic || c.logistic === 'requester') continue;
      if (forBuffer && c.logistic === 'buffer') continue;
      if (this.available(c, item) < need) continue;
      const p = PRIORITY_PICKUP[c.logistic];
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (p < bp || (p === bp && d < bd)) {
        best = c;
        bp = p;
        bd = d;
      }
    }
    return best;
  }

  /** Lagerkiste mit Platz (bevorzugt mit gleichem Item), sonst null. */
  private pickStorage(net: LogisticNetwork, item: string, x: number, y: number): ContainerEntity | null {
    let best: ContainerEntity | null = null;
    let bs = -1;
    let bd = Infinity;
    for (const c of net.chests) {
      if (c.logistic !== 'storage' || c.inventory.space(item) <= 0) continue;
      const s = c.inventory.count(item) > 0 ? 1 : 0;
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (s > bs || (s === bs && d < bd)) {
        best = c;
        bs = s;
        bd = d;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ Flug

  private target(w: World, r: Robot): { x: number; y: number } | null {
    const t = r.task;
    const at = (id: number) => {
      const e = w.entities.get(id);
      return e ? { x: e.cx, y: e.cy } : null;
    };
    switch (t.t) {
      case 'build': {
        if (t.phase === 0) return at(t.from);
        const g = w.ghosts.all.get(t.ghost);
        if (!g) return null;
        const [gw, gh] = sizeOf(entityDef(g.name), g.dir);
        return { x: g.x + gw / 2, y: g.y + gh / 2 };
      }
      case 'decon': return at(t.phase === 0 ? t.target : t.to);
      case 'deliver': return at(t.phase === 0 ? t.from : t.to);
      case 'home': return at(t.port);
    }
  }

  /** Neue Aufgabe: Heimflug zum nächsten Hangar. */
  private goHome(w: World, r: Robot): void {
    let best: RoboportEntity | null = null;
    let bd = Infinity;
    for (const n of this.nets) {
      for (const p of n.ports) {
        const d = (p.px - r.x) ** 2 + (p.py - r.y) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    }
    if (!best) {
      // kein Hangar mehr: Roboter landet als Item auf dem Boden
      w.spill(r.x, r.y, r.kind);
      for (const s of r.cargo) for (let k = 0; k < s.count; k++) w.spill(r.x, r.y, s.item);
      r.cargo = [];
      this.retask(r, { t: 'home', port: -1 });
      return;
    }
    this.retask(r, { t: 'home', port: best.id });
  }

  /** Ladung in eine Kiste legen; Rest auf den Boden. */
  private unload(w: World, r: Robot, c: Entity | undefined): void {
    for (const s of r.cargo) {
      let left = s.count;
      if (c && c.kind === 'container') left -= c.inventory.add(s.item, left);
      for (let k = 0; k < left; k++) w.spill(r.x, r.y, s.item);
    }
    r.cargo = [];
  }

  private arrive(w: World, r: Robot): void {
    const t = r.task;
    switch (t.t) {
      case 'build': {
        if (t.phase === 0) {
          const c = w.entities.get(t.from);
          const n = t.count ?? 1;
          if (w.ghosts.all.has(t.ghost) && c?.kind === 'container' && c.inventory.count(t.item) >= n) {
            c.inventory.remove(t.item, n);
            r.cargo = [{ item: t.item, count: n }];
            this.retask(r, { ...t, phase: 1 });
          } else this.goHome(w, r);
          return;
        }
        const g = w.ghosts.all.get(t.ghost);
        if (g) {
          const def = entityDef(g.name);
          const [gw, gh] = sizeOf(def, g.dir);
          // Bäume im Weg fällen (Holz geht verloren – kein Lager zur Hand)
          for (let y = g.y; y < g.y + gh; y++) for (let x = g.x; x < g.x + gw; x++) {
            const tree = w.map.trees.treeAt(x, y);
            if (tree) w.map.trees.remove(tree.cx, tree.cy, tree.i);
          }
          const chk = w.canPlace(g.name, g.x, g.y, g.dir);
          if (!chk.ok && chk.reason === 'Spieler im Weg') return; // warten
          const settings = g.settings;
          const e = chk.ok ? w.place(g.name, g.x, g.y, g.dir as Dir) : null;
          if (e) {
            applySettings(e, settings);
            r.cargo = [];
          }
        }
        this.goHome(w, r);
        return;
      }
      case 'decon': {
        if (t.phase === 0) {
          const e = w.entities.get(t.target);
          if (e && this.marked.has(t.target)) {
            this.marked.delete(t.target);
            r.cargo = w.remove(t.target);
            this.retask(r, { ...t, phase: 1 });
          } else this.goHome(w, r);
          return;
        }
        this.unload(w, r, w.entities.get(t.to));
        this.goHome(w, r);
        return;
      }
      case 'deliver': {
        if (t.phase === 0) {
          const c = w.entities.get(t.from);
          const got = c?.kind === 'container' && w.entities.has(t.to) ? c.inventory.remove(t.item, t.count) : 0;
          if (got > 0) {
            r.cargo = [{ item: t.item, count: got }];
            this.retask(r, { ...t, count: got, phase: 1 });
          } else this.goHome(w, r);
          return;
        }
        this.unload(w, r, w.entities.get(t.to));
        this.goHome(w, r);
        return;
      }
      case 'home': {
        const p = w.entities.get(t.port);
        if (!p || p.kind !== 'roboport') {
          this.goHome(w, r);
          return;
        }
        if (r.cargo.length) {
          const net = this.netAt(p.px, p.py, 'logistic');
          const to = net ? this.pickStorage(net, r.cargo[0].item, p.px, p.py) : null;
          this.unload(w, r, to ?? undefined);
        }
        r.charging = true;
        return;
      }
    }
  }

  // ------------------------------------------------------------------ Tick

  update(w: World): void {
    this.ensure(w);
    if (w.tick % ROBOPORT.dispatchEvery === 0) this.dispatch(w);
    const chargePerTick = wattsToJoulesPerTick(ROBOPORT.chargePower);
    const chargers = new Map<number, number>();
    for (let i = 0; i < this.robots.length; i++) {
      const r = this.robots[i];
      const def = ROBOTS[r.kind];
      if (r.charging) {
        const t = r.task as Extract<RobotTask, { t: 'home' }>;
        const p = w.entities.get(t.port) as RoboportEntity | undefined;
        if (!p) {
          r.charging = false;
          this.goHome(w, r);
          continue;
        }
        const used = chargers.get(p.id) ?? 0;
        if (used < ROBOPORT.chargers && r.energy < def.capacity) {
          chargers.set(p.id, used + 1);
          const j = Math.min(chargePerTick, def.capacity - r.energy, p.energy.buffer);
          p.energy.buffer -= j;
          r.energy += j;
        }
        if (r.energy >= def.capacity && p.robots.space(r.kind) > 0) {
          p.robots.add(r.kind, 1);
          this.robots.splice(i--, 1);
        }
        continue;
      }
      const tgt = this.target(w, r);
      if (!tgt) {
        if (r.task.t === 'home') {
          this.goHome(w, r);
          if ((r.task as { port: number }).port < 0) this.robots.splice(i--, 1);
        } else this.goHome(w, r);
        continue;
      }
      const dx = tgt.x - r.x;
      const dy = tgt.y - r.y;
      const d = Math.hypot(dx, dy);
      const sp = def.speed * (1 + w.research.bonus('robot-speed')) * (r.energy > 0 ? 1 : ROBOT_LOW_POWER_SPEED);
      r.energy = Math.max(0, r.energy - def.flyPerTick);
      if (d <= sp) {
        r.x = tgt.x;
        r.y = tgt.y;
        this.arrive(w, r);
      } else {
        r.x += (dx / d) * sp;
        r.y += (dy / d) * sp;
      }
    }
  }

  // ------------------------------------------------------------------ Speichern

  serialize(): { n: number; m: number[]; r: [number, string, number, number, number, RobotTask, [string, number][], boolean][] } {
    return {
      n: this.nextId,
      m: [...this.marked].sort((a, b) => a - b),
      r: this.robots.map((r) => [r.id, r.kind, r.x, r.y, r.energy, r.task, r.cargo.map((s) => [s.item, s.count]), r.charging]),
    };
  }

  load(w: World, d: ReturnType<RobotSystem['serialize']> | undefined): void {
    if (!d) return;
    this.nextId = d.n;
    for (const id of d.m) if (w.entities.has(id)) this.marked.add(id);
    for (const [id, kind, x, y, energy, task, cargo, charging] of d.r) {
      const r: Robot = { id, kind: kind as RobotDef['id'], x, y, energy, task, cargo: cargo.map(([item, count]) => ({ item, count })), charging };
      this.robots.push(r);
      this.claim(r, +1);
    }
  }
}
