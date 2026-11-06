import { ENEMY_MAPGEN, EVOLUTION, NEST, PLAYER_COMBAT, POLLUTION, POLLUTION_PER_MINUTE, UNITS, type UnitKind } from '../data/enemies';
import { entityDef } from '../data/entities';
import type { Entity } from './machines';
import { PollutionSystem } from './pollution';

const PollutionSystemUnkey = PollutionSystem.unkey;
import { hash01 } from './rng';
import type { World } from './world';

/** Nest (Vorbild Spawner): 5×5, nimmt Verschmutzung auf, schickt Angriffe los, hat Verteidiger. */
export interface Nest {
  readonly id: number;
  /** linke obere Ecke */
  readonly x: number;
  readonly y: number;
  hp: number;
  /** aufgenommene Verschmutzung, noch nicht in Einheiten umgesetzt */
  budget: number;
  /** wartende Angreifer (Einheiten-IDs) und seit wann */
  group: number[];
  groupSince: number;
  spawnCd: number;
  /** Tick des letzten Treffers (Verteidiger werden aggressiv) */
  hitAt: number;
  /** Wartezeit der aktuellen Angriffsgruppe (Ticks) */
  wait: number;
  /** Zwischenspeicher: Gebäude im Wachradius (alle 30 Ticks neu, nicht gespeichert) */
  threat?: number | null;
}

export type UnitMode = 'guard' | 'attack' | 'return';

export interface Unit {
  readonly id: number;
  readonly kind: UnitKind;
  x: number;
  y: number;
  hp: number;
  nest: number;
  mode: UnitMode;
  /** Angriffsziel: Gebäude-ID, -1 = Spieler, null = keins */
  target: number | null;
  /** Wegpunkt beim Marsch */
  tx: number;
  ty: number;
  cd: number;
  /** Blickrichtung (Bogenmaß) und Laufphase für die Darstellung */
  angle: number;
  phase: number;
  /** Ticks ohne Fortschritt (festgefahren) */
  stuck: number;
  /** nächste Zielsuche frühestens in diesem Tick (nicht gespeichert, nur Rechenaufwand) */
  retry?: number;
}

export type Target = { kind: 'unit'; id: number; x: number; y: number } | { kind: 'nest'; id: number; x: number; y: number };

/** Kurz sichtbare Ereignisse für die Darstellung (Kadaver, Explosionen). */
export interface Remnant {
  x: number;
  y: number;
  kind: 'unit' | 'nest' | 'building';
  size: number;
  tick: number;
}

const cellKey = (gx: number, gy: number) => gx * 100003 + gy;

export class EnemySystem {
  readonly nests = new Map<number, Nest>();
  readonly units = new Map<number, Unit>();
  /** Bereits erzeugte Rasterzellen (Nester sind dort angelegt oder bewusst leer). */
  private readonly cells = new Set<number>();
  /** Zerstörte Nester bleiben zerstört (IDs sind deterministisch je Zelle). */
  private readonly destroyed = new Set<number>();
  private readonly occ = new Map<number, number>();
  evolution = 0;
  private lastEmitted = 0;
  private nextUnit = 1;
  readonly remnants: Remnant[] = [];

  // ------------------------------------------------------------ Karte

  private gen(w: World) {
    return ENEMY_MAPGEN[w.settings.enemies];
  }

  /** Erzeugt die Nester der Rasterzellen, die das Rechteck berühren (deterministisch je Zelle). */
  ensureArea(w: World, x0: number, y0: number, x1: number, y1: number): void {
    const g = this.gen(w);
    if (g.chance <= 0) return;
    const c = g.cell;
    for (let gy = Math.floor(y0 / c) - 1; gy <= Math.floor(y1 / c) + 1; gy++) {
      for (let gx = Math.floor(x0 / c) - 1; gx <= Math.floor(x1 / c) + 1; gx++) {
        const k = cellKey(gx, gy);
        if (this.cells.has(k)) continue;
        this.cells.add(k);
        this.genCell(w, gx, gy);
      }
    }
  }

  private genCell(w: World, gx: number, gy: number): void {
    const g = this.gen(w);
    const s = w.seed;
    if (hash01(s, gx, gy, 501) >= g.chance) return;
    const bx = (gx + 0.2 + hash01(s, gx, gy, 502) * 0.6) * g.cell;
    const by = (gy + 0.2 + hash01(s, gx, gy, 503) * 0.6) * g.cell;
    if (Math.hypot(bx, by) < g.startFree) return;
    const n = g.nestsMin + Math.floor(hash01(s, gx, gy, 504) * (g.nestsMax - g.nestsMin + 1));
    for (let i = 0; i < n; i++) {
      const a = hash01(s, gx, gy, 510 + i) * Math.PI * 2;
      const r = i === 0 ? 0 : 6 + hash01(s, gx, gy, 520 + i) * 7;
      const x = Math.round(bx + Math.cos(a) * r) - 2;
      const y = Math.round(by + Math.sin(a) * r) - 2;
      const id = (Math.abs(cellKey(gx, gy)) % 10_000_000) * 16 + i + 1;
      if (this.destroyed.has(id) || !this.freeFor(w, x, y)) continue;
      this.addNest(w, { id, x, y, hp: NEST.health, budget: 0, group: [], groupSince: 0, wait: NEST.attackDelayMin, spawnCd: 0, hitAt: -1e9 });
      // Verteidiger beim Erzeugen (Lage aus der Zelle, unabhängig vom Simulationszufall)
      for (let k = 0; k < 2 + (i % 3); k++) this.spawnUnit(w, this.nests.get(id)!, 'guard', 'small', hash01(s, gx, gy, 600 + i * 8 + k) * Math.PI * 2);
    }
  }

  private freeFor(w: World, x: number, y: number): boolean {
    const S = NEST.size;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        if (w.map.isWater(x + i, y + j) || w.entityAt(x + i, y + j) || this.occ.has(cellKey(x + i, y + j))) return false;
      }
    }
    return true;
  }

  private addNest(_w: World, n: Nest): void {
    this.nests.set(n.id, n);
    for (let j = 0; j < NEST.size; j++) for (let i = 0; i < NEST.size; i++) this.occ.set(cellKey(n.x + i, n.y + j), n.id);
  }

  /** Nest von Hand setzen (Tests, Sandkasten). */
  spawnNest(w: World, x: number, y: number, guards = 0): Nest {
    const id = 900_000_000 + this.nests.size + this.destroyed.size + 1;
    const n: Nest = { id, x, y, hp: NEST.health, budget: 0, group: [], groupSince: 0, wait: NEST.attackDelayMin, spawnCd: NEST.spawnCooldown, hitAt: -1e9 };
    this.addNest(w, n);
    for (let k = 0; k < guards; k++) this.spawnUnit(w, n, 'guard', 'small', k);
    return n;
  }

  /** Einheit von Hand setzen (Tests). */
  spawnAt(x: number, y: number, kind: UnitKind, nest = -1): Unit {
    const u: Unit = { id: this.nextUnit++, kind, x, y, hp: UNITS[kind].health, nest, mode: 'attack', target: null, tx: 0, ty: 0, cd: 0, angle: 0, phase: 0, stuck: 0 };
    this.units.set(u.id, u);
    return u;
  }

  nestAt(tx: number, ty: number): Nest | undefined {
    const id = this.occ.get(cellKey(Math.floor(tx), Math.floor(ty)));
    return id === undefined ? undefined : this.nests.get(id);
  }

  /** Nester im Rechteck (für Darstellung und Minimap). */
  nestsIn(x0: number, y0: number, x1: number, y1: number): Nest[] {
    const out: Nest[] = [];
    for (const n of this.nests.values()) if (n.x + NEST.size >= x0 && n.x <= x1 && n.y + NEST.size >= y0 && n.y <= y1) out.push(n);
    return out;
  }

  // ------------------------------------------------------------ Einheiten

  /** Teuerste Einheit, die bei der aktuellen Entwicklung erscheinen kann. */
  private maxKind(): UnitKind {
    return this.evolution >= EVOLUTION.bigFrom ? 'big' : this.evolution >= EVOLUTION.mediumFrom ? 'medium' : 'small';
  }

  /** Entwicklungszuwachs, gedämpft mit (1 − Entwicklung)² (Wiki). */
  private evolve(d: number): void {
    const e = this.evolution;
    this.evolution = Math.min(1, e + d * (1 - e) * (1 - e));
  }

  private pickKind(): UnitKind {
    const e = this.evolution;
    if (e >= EVOLUTION.bigFrom && this.rand() < (e - EVOLUTION.bigFrom) * 1.2) return 'big';
    if (e >= EVOLUTION.mediumFrom && this.rand() < 0.3 + (e - EVOLUTION.mediumFrom)) return 'medium';
    return 'small';
  }

  /** deterministischer Zufall der Simulation */
  private rs = 12345;
  private rand(): number {
    this.rs = (Math.imul(this.rs, 1103515245) + 12345) >>> 0;
    return this.rs / 4294967296;
  }

  private spawnUnit(_w: World, n: Nest, mode: UnitMode, kind: UnitKind = 'small', angle?: number): Unit {
    const c = NEST.size / 2;
    const a = angle ?? this.rand() * Math.PI * 2;
    const u: Unit = {
      id: this.nextUnit++, kind, x: n.x + c + Math.cos(a) * 3, y: n.y + c + Math.sin(a) * 3, hp: UNITS[kind].health,
      nest: n.id, mode, target: null, tx: 0, ty: 0, cd: 0, angle: a, phase: 0, stuck: 0,
    };
    this.units.set(u.id, u);
    return u;
  }

  // ------------------------------------------------------------ Verschmutzung → Angriffe

  absorbPollution(_w: World, p: PollutionSystem): void {
    if (this.nests.size === 0) return;
    const C = POLLUTION.chunk;
    for (const n of this.nests.values()) {
      const cx = Math.floor((n.x + 2) / C);
      const cy = Math.floor((n.y + 2) / C);
      const have = p.chunkAt(cx, cy);
      if (have <= 0) continue;
      // Wiki: bis zum Dreifachen der teuersten Einheit; über 20 im Abschnitt: 20 + 1 % je 64 Ticks
      const cap = NEST.absorbCapFactor * UNITS[this.maxKind()].pollution;
      if (n.budget >= cap) continue;
      const want = have > NEST.absorbFixed ? NEST.absorbFixed + have * NEST.absorbFraction : have;
      n.budget += p.take(cx, cy, want);
    }
  }

  // ------------------------------------------------------------ Takt

  update(w: World): void {
    const g = this.gen(w);
    if (g.chance <= 0 && this.units.size === 0) return;
    if (w.tick % 60 === 0) {
      this.evolve(EVOLUTION.timePerSecond * g.evolutionFactor);
      // Nester um die Spielfigur und in verschmutzten Abschnitten anlegen
      const p = w.player;
      if (p) this.ensureArea(w, p.x - 140, p.y - 140, p.x + 140, p.y + 140);
      const C = POLLUTION.chunk;
      for (const k of w.pollution.chunks.keys()) {
        const [cx, cy] = PollutionSystemUnkey(k);
        this.ensureArea(w, cx * C, cy * C, cx * C + C, cy * C + C);
      }
      const emitted = w.pollution.totalEmitted - this.lastEmitted;
      this.lastEmitted = w.pollution.totalEmitted;
      this.onPollution(emitted, g.evolutionFactor);
    }
    // Nester: Verteidiger nachziehen, Angriffsgruppen bilden und losschicken
    if (w.tick % 30 === 0) {
      const peaceful = w.settings.enemies === 'friedlich';
      const guardsOf = new Map<number, number>();
      for (const u of this.units.values()) if (u.mode === 'guard') guardsOf.set(u.nest, (guardsOf.get(u.nest) ?? 0) + 1);
      for (const n of this.nests.values()) {
        if (n.spawnCd > 0) n.spawnCd -= 30;
        if (n.hp < NEST.health) n.hp = Math.min(NEST.health, n.hp + NEST.regenPerTick * 30);
        const guards = guardsOf.get(n.id) ?? 0;
        n.threat = this.nearbyBuilding(w, n.x + 2.5, n.y + 2.5, NEST.guardRadius);
        if (guards < NEST.maxDefenders && n.spawnCd <= 0 && this.units.size < 600) {
          this.spawnUnit(w, n, 'guard', this.pickKind());
          n.spawnCd = Math.round(NEST.spawnCooldown + (NEST.spawnCooldownEvolved - NEST.spawnCooldown) * this.evolution);
        }
        if (peaceful) continue;
        let kind = this.pickKind();
        while (n.budget >= UNITS[kind].pollution && this.units.size < 600) {
          n.budget -= UNITS[kind].pollution;
          const u = this.spawnUnit(w, n, 'guard', kind);
          if (!n.group.length) {
            n.groupSince = w.tick;
            n.wait = Math.round(NEST.attackDelayMin + this.rand() * (NEST.attackDelayMax - NEST.attackDelayMin));
          }
          n.group.push(u.id);
          kind = this.pickKind();
        }
        n.group = n.group.filter((id) => this.units.has(id));
        // Angriff nach zufälliger Wartezeit (1–10 min ab dem ersten Angreifer)
        if (n.group.length > 0 && w.tick - n.groupSince > n.wait) {
          const t = this.attackTarget(w, n.x + 2, n.y + 2, NEST.attackRadius, true);
          if (t) for (const id of n.group) this.order(this.units.get(id)!, t);
          n.group = [];
        }
      }
    }
    for (const u of this.units.values()) this.stepUnit(w, u);
    // Kadaver nach einer Weile entfernen
    while (this.remnants.length && w.tick - this.remnants[0].tick > 60 * 60) this.remnants.shift();
  }

  /** Nächstes Gebäude im Umkreis: Felder abtasten (unabhängig von der Fabrikgröße) oder Gebäude durchgehen, was billiger ist. */
  private nearbyBuilding(w: World, x: number, y: number, r: number): number | null {
    const tiles = (2 * r + 1) * (2 * r + 1);
    if (w.entities.size < tiles / 4) {
      const e = this.attackTarget(w, x, y, r, false);
      return e ? e.id : null;
    }
    let best: number | null = null;
    let bd = r;
    const x0 = Math.floor(x - r);
    const y0 = Math.floor(y - r);
    for (let ty = y0; ty <= Math.floor(y + r); ty++) {
      for (let tx = x0; tx <= Math.floor(x + r); tx++) {
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d >= bd) continue;
        const e = w.entityAt(tx, ty);
        if (!e || e.kind === 'rail') continue;
        bd = d;
        best = e.id;
      }
    }
    return best;
  }

  /** Nächstes verschmutzendes Gebäude (sonst irgendeins) im Umkreis. */
  private attackTarget(w: World, x: number, y: number, r: number, polluters: boolean): Entity | null {
    let best: Entity | null = null;
    let bd = r;
    for (const e of w.entities.values()) {
      if (e.kind === 'rail') continue;
      if (polluters && !POLLUTION_PER_MINUTE[e.name]) continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private order(u: Unit, e: Entity): void {
    u.mode = 'attack';
    u.target = e.id;
    u.tx = e.cx;
    u.ty = e.cy;
  }

  private stepUnit(w: World, u: Unit): void {
    const def = UNITS[u.kind];
    if (u.cd > 0) u.cd--;
    const nest = this.nests.get(u.nest);
    const p = w.player;
    // Ziel bestimmen
    if (u.mode === 'guard') {
      const hx = nest ? nest.x + 2.5 : u.x;
      const hy = nest ? nest.y + 2.5 : u.y;
      const alert = nest && w.tick - nest.hitAt < 600;
      if (p && !p.dead && Math.hypot(p.x - hx, p.y - hy) < (alert ? NEST.guardRadius * 2 : NEST.guardRadius) && (alert || w.settings.enemies !== 'friedlich')) {
        u.target = -1;
      } else if (alert || w.settings.enemies !== 'friedlich') {
        // Gebäude im Wachradius: vom Nest zwischengespeichert (alle 30 Ticks)
        const id = nest?.threat ?? null;
        u.target = id !== null && w.entities.has(id) ? id : null;
      } else u.target = null;
      if (u.target === null) {
        // bei Nest herumstreifen
        if (Math.hypot(u.x - hx, u.y - hy) > 4.5) this.move(w, u, hx, hy, def.speed * 0.4);
        else u.phase = 0;
        return;
      }
    }
    if (u.mode === 'return') {
      if (!nest) {
        u.mode = 'attack';
        u.target = null;
      } else {
        if (Math.hypot(u.x - nest.x - 2.5, u.y - nest.y - 2.5) < 4) u.mode = 'guard';
        else this.move(w, u, nest.x + 2.5, nest.y + 2.5, def.speed);
        return;
      }
    }
    // Spieler angreifen
    if (u.target === -1) {
      if (!p || p.dead) {
        u.target = null;
        return;
      }
      const d = Math.hypot(p.x - u.x, p.y - u.y);
      if (d > NEST.guardRadius * 3) {
        u.target = null;
        u.mode = nest ? 'return' : 'attack';
        return;
      }
      if (d <= def.radius + def.reach + 0.1) {
        u.phase = 0;
        u.angle = Math.atan2(p.y - u.y, p.x - u.x);
        if (u.cd === 0) {
          p.damage(w, def.damage);
          u.cd = def.cooldown;
        }
      } else this.move(w, u, p.x, p.y, def.speed);
      return;
    }
    // Spielfigur in der Nähe: angreifen (wie im Original)
    if (p && !p.dead && !p.god && Math.hypot(p.x - u.x, p.y - u.y) < 5) {
      u.target = -1;
      return;
    }
    // Gebäude angreifen
    let e = u.target !== null ? w.entities.get(u.target) : undefined;
    if (!e && (u.retry ?? 0) > w.tick) {
      if (u.mode === 'attack' && nest) u.mode = 'return';
      return;
    }
    if (!e) {
      const near = this.nearbyBuilding(w, u.x, u.y, 30);
      u.retry = w.tick + 30 + (u.id % 15);
      const ne = near !== null ? w.entities.get(near) : undefined;
      if (ne) {
        u.target = ne.id;
        e = ne;
      } else {
        u.target = null;
        if (u.mode === 'attack') u.mode = nest ? 'return' : 'attack';
        if (!nest) u.phase = 0;
        return;
      }
    }
    // Abstand zur Grundfläche
    const dx = Math.max(e.x - u.x, 0, u.x - (e.x + e.w));
    const dy = Math.max(e.y - u.y, 0, u.y - (e.y + e.h));
    if (Math.hypot(dx, dy) <= def.reach) {
      u.phase = 0;
      u.angle = Math.atan2(e.cy - u.y, e.cx - u.x);
      if (u.cd === 0) {
        w.damageEntity(e, def.damage);
        u.cd = def.cooldown;
      }
      return;
    }
    this.move(w, u, e.cx, e.cy, def.speed);
  }

  /** Schritt in Richtung (tx, ty); Hindernisse: Wasser umgehen, Gebäude angreifen. */
  private move(w: World, u: Unit, tx: number, ty: number, speed: number): void {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const s = Math.min(speed, d);
    let a = Math.atan2(dy, dx);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
      const b = a + off * (u.id % 2 ? 1 : -1);
      const nx = u.x + Math.cos(b) * s;
      const ny = u.y + Math.sin(b) * s;
      if (w.map.isWater(Math.floor(nx), Math.floor(ny))) continue;
      const blocker = w.entityAt(nx, ny);
      if (blocker && entityDef(blocker.name).solid && blocker.kind !== 'rail') {
        if (off === 0 && (u.mode === 'attack' || u.target !== null)) {
          // Hindernis im Weg: angreifen (wie im Original)
          u.target = blocker.id;
          return;
        }
        continue;
      }
      a = b;
      u.x = nx;
      u.y = ny;
      u.angle = a;
      u.phase += s;
      u.stuck = 0;
      return;
    }
    u.stuck++;
  }

  // ------------------------------------------------------------ Kampf

  /** Nächstes Ziel für Türme und Spieler: Einheit oder Nest im Umkreis. */
  nearestTarget(x: number, y: number, r: number): Target | null {
    let best: Target | null = null;
    let bd = r;
    for (const u of this.units.values()) {
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < bd) {
        bd = d;
        best = { kind: 'unit', id: u.id, x: u.x, y: u.y };
      }
    }
    if (best) return best;
    for (const n of this.nests.values()) {
      const d = Math.hypot(n.x + 2.5 - x, n.y + 2.5 - y);
      if (d < bd) {
        bd = d;
        best = { kind: 'nest', id: n.id, x: n.x + 2.5, y: n.y + 2.5 };
      }
    }
    return best;
  }

  /** Physischer Schaden mit Panzerung (vereinfachte Formel des Originals). */
  static applyArmor(dmg: number, flat: number, pct: number): number {
    const after = dmg > flat ? dmg - flat : 1 / (2 + flat - dmg);
    return after * (1 - pct);
  }

  damageTarget(w: World, t: Target, dmg: number, by?: { x: number; y: number }): void {
    if (t.kind === 'unit') {
      const u = this.units.get(t.id);
      if (!u) return;
      const def = UNITS[u.kind];
      u.hp -= EnemySystem.applyArmor(dmg, def.armorFlat, def.armorPercent);
      // Getroffene Wächter werden aggressiv
      const n = this.nests.get(u.nest);
      if (n) n.hitAt = w.tick;
      if (u.mode === 'guard' && by && w.player && Math.hypot(by.x - w.player.x, by.y - w.player.y) < 1) u.target = -1;
      if (u.hp <= 0) {
        this.units.delete(u.id);
        this.remnants.push({ x: u.x, y: u.y, kind: 'unit', size: def.scale, tick: w.tick });
        w.stats.made(`kill.${u.kind}`, 1);
      }
    } else {
      const n = this.nests.get(t.id);
      if (!n) return;
      n.hp -= EnemySystem.applyArmor(dmg, NEST.armorFlat, NEST.armorPercent);
      n.hitAt = w.tick;
      if (n.hp <= 0) this.destroyNest(w, n);
    }
  }

  private destroyNest(w: World, n: Nest): void {
    this.nests.delete(n.id);
    this.destroyed.add(n.id);
    for (let j = 0; j < NEST.size; j++) for (let i = 0; i < NEST.size; i++) this.occ.delete(cellKey(n.x + i, n.y + j));
    this.evolve(EVOLUTION.perNestDestroyed * this.gen(w).evolutionFactor);
    this.remnants.push({ x: n.x + 2.5, y: n.y + 2.5, kind: 'nest', size: 1, tick: w.tick });
    for (const u of this.units.values()) if (u.nest === n.id && u.mode === 'guard') u.mode = 'attack';
  }

  /** Verschmutzung erhöht die Entwicklung (aus dem Gesamtausstoß, je Sekunde). */
  onPollution(amount: number, factor: number): void {
    this.evolve(amount * EVOLUTION.perPollution * factor);
  }

  // ------------------------------------------------------------ Speichern

  serialize() {
    return {
      evo: this.evolution, nu: this.nextUnit, rs: this.rs, le: this.lastEmitted,
      cells: [...this.cells].sort((a, b) => a - b),
      dead: [...this.destroyed].sort((a, b) => a - b),
      nests: [...this.nests.values()].map((n) => [n.id, n.x, n.y, n.hp, n.budget, n.group, n.groupSince, n.spawnCd, n.hitAt, n.threat ?? null, n.wait]),
      units: [...this.units.values()].map((u) => [u.id, u.kind, u.x, u.y, u.hp, u.nest, u.mode, u.target, u.tx, u.ty, u.cd, u.angle, u.phase, u.stuck, u.retry ?? 0]),
    };
  }

  load(w: World, d?: ReturnType<EnemySystem['serialize']>): void {
    this.nests.clear();
    this.units.clear();
    this.cells.clear();
    this.destroyed.clear();
    this.occ.clear();
    if (!d) return;
    this.evolution = d.evo;
    this.nextUnit = d.nu;
    this.rs = d.rs;
    this.lastEmitted = d.le ?? 0;
    for (const c of d.cells) this.cells.add(c);
    for (const id of d.dead) this.destroyed.add(id);
    for (const [id, x, y, hp, budget, group, gs, cd, hit, threat, wait] of d.nests as [number, number, number, number, number, number[], number, number, number, number | null, number][]) {
      this.addNest(w, { id, x, y, hp, budget, group, groupSince: gs, spawnCd: cd, hitAt: hit, threat, wait: wait ?? NEST.attackDelayMin });
    }
    for (const r of d.units as [number, UnitKind, number, number, number, number, UnitMode, number | null, number, number, number, number, number, number, number][]) {
      const [id, kind, x, y, hp, nest, mode, target, tx, ty, cd, angle, phase, stuck, retry] = r;
      this.units.set(id, { id, kind, x, y, hp, nest, mode, target, tx, ty, cd, angle, phase, stuck, retry });
    }
  }
}

export { PLAYER_COMBAT };
