import type { Texture } from 'pixi.js';
import { EMITTERS, FX, type FxKind } from '../data/fx';
import { Status } from '../sim/entity';
import type { World } from '../sim/world';
import type { SpriteLib } from './assets';
import type { SpritePool } from './pools';

const TILT_LIFT = Math.tan(Math.PI / 6); // Bildhöhe je Feld Modellhöhe (Kamera 30° geneigt)

interface Particle {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  tex: Texture;
  rot: number;
  vr: number;
}

/**
 * Rauch, Staub und Funken als reine Darstellung (eigener Zufall, beeinflusst die Simulation nicht).
 * Zeitbasis sind Simulationsticks, damit Effekte bei Pause stehen bleiben.
 */
export class Effects {
  private readonly parts: Particle[] = [];
  private readonly acc = new Map<string, number>();
  private lastT = -1;
  private readonly tex: Record<FxKind, Texture[]>;
  readonly enabled: boolean;

  constructor(sprites: SpriteLib, private readonly pool: SpritePool, private readonly addPool: SpritePool, private readonly tile: number) {
    const list = (prefix: string) => {
      const out: Texture[] = [];
      for (let i = 0; sprites.has(`${prefix}.${i}`); i++) out.push(sprites.frame(`${prefix}.${i}`));
      return out;
    };
    this.tex = { smoke: list('fx.smoke'), dust: list('fx.dust'), spark: sprites.has('fx.spark') ? [sprites.frame('fx.spark')] : [] };
    this.enabled = this.tex.smoke.length > 0;
  }

  update(world: World, alpha: number, view: { x0: number; y0: number; x1: number; y1: number }): void {
    this.pool.begin();
    this.addPool.begin();
    if (!this.enabled) {
      this.pool.end();
      this.addPool.end();
      return;
    }
    const t = world.tick + alpha;
    const dt = this.lastT < 0 ? 0 : Math.max(0, Math.min(10, t - this.lastT)) / 60;
    this.lastT = t;
    const T = this.tile;
    if (dt > 0) {
      for (const e of world.entities.values()) {
        const ems = EMITTERS[e.name];
        if (!ems || e.status !== Status.Working) continue;
        if (e.x + e.w < view.x0 - 2 || e.x > view.x1 + 2 || e.y + e.h < view.y0 - 3 || e.y > view.y1 + 2) continue;
        ems.forEach((em, k) => {
          const key = `${e.id}:${k}`;
          let a = (this.acc.get(key) ?? Math.random()) + em.rate * dt;
          while (a >= 1) {
            a -= 1;
            // Modellpunkt drehen (im Uhrzeigersinn je Richtung) und auf den Bildschirm projizieren
            let [bx, by] = [em.at[0], em.at[1]];
            for (let r = 0; r < e.dir; r++) [bx, by] = [by, -bx];
            const sp = em.spread ?? 0;
            const ox = sp ? (Math.random() - 0.5) * 2 * sp : 0;
            const oy = sp ? (Math.random() - 0.5) * 2 * sp : 0;
            this.spawn(em.kind, (e.cx + bx + ox) * T, (e.cy - by + oy) * T - em.at[2] * TILT_LIFT * T);
          }
          this.acc.set(key, a);
        });
      }
      const p = world.player;
      if (p?.mineTarget && p.mineProgress > 0) {
        const key = 'mine';
        let a = (this.acc.get(key) ?? 0) + FX.mineDustRate * dt;
        const mt = p.mineTarget;
        const target = mt.kind === 'resource' ? { x: mt.x + 0.5, y: mt.y + 0.5 } : (() => {
          const e = world.entities.get(mt.id);
          return e ? { x: e.cx, y: e.cy } : null;
        })();
        while (a >= 1 && target) {
          a -= 1;
          this.spawn('dust', (target.x + (Math.random() - 0.5) * 0.6) * T, (target.y + (Math.random() - 0.5) * 0.5) * T);
        }
        this.acc.set(key, a);
      }
    }
    // bewegen, altern, zeichnen
    let n = 0;
    for (const q of this.parts) {
      const cfg = FX[q.kind];
      q.age += dt;
      if (q.age >= cfg.life) continue;
      q.x += q.vx * dt * T;
      q.y += q.vy * dt * T;
      q.rot += q.vr * dt;
      if (q.kind === 'spark') q.vy += 0.35 * dt; // Funken sinken nach dem Aufsteigen
      this.parts[n++] = q;
      const f = q.age / cfg.life;
      const size = cfg.size0 + (cfg.size1 - cfg.size0) * f;
      const fade = q.kind === 'spark' ? 1 - f : Math.min(1, f * 6) * (1 - f) * (1 - f);
      const s = (q.kind === 'spark' ? this.addPool : this.pool).get(q.tex);
      s.position.set(q.x, q.y);
      s.scale.set((size * T) / q.tex.width);
      s.rotation = q.rot;
      s.alpha = cfg.alpha * fade;
    }
    this.parts.length = n;
    this.pool.end();
    this.addPool.end();
  }

  private spawn(kind: FxKind, x: number, y: number): void {
    const list = this.tex[kind];
    if (!list.length || this.parts.length >= FX.maxParticles) return;
    const cfg = FX[kind];
    this.parts.push({
      kind, x, y,
      vx: cfg.wind + (Math.random() - 0.5) * 2 * cfg.jitter,
      vy: -cfg.rise * (0.8 + Math.random() * 0.4),
      age: 0,
      tex: list[(Math.random() * list.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.6,
    });
  }
}
