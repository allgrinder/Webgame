import { Application, Container, Graphics, type Texture } from 'pixi.js';
import { BELT } from '../data/belt';
import { entityDef } from '../data/entities';
import { MAPGEN } from '../data/mapgen';
import { RESOURCE_BY_INDEX, densityLevel } from '../data/resources';
import { BeltSystem, Shape, laneLength } from '../sim/belts';
import { Status } from '../sim/entity';
import { DX, DY, type Dir } from '../sim/geom';
import { type Entity, InserterPhase, itemId } from '../sim/machines';
import type { World } from '../sim/world';
import type { SpriteLib } from './assets';
import { ParticlePool, SpritePool } from './pools';

export const TILE = 64;

export interface Ghost {
  name: string;
  x: number;
  y: number;
  dir: Dir;
  ok: boolean;
}

export interface RenderUi {
  ghost: Ghost | null;
  alt: boolean;
  /** Markierung unter dem Cursor (Feldrechteck). */
  hover: { x: number; y: number; w: number; h: number } | null;
  /** Abbaufortschritt 0..1 am Hover-Ziel. */
  mining: number;
}

const SHAPE_KEY = ['s', 'l', 'r'];
const ITEM_SCALE_BELT = 0.42;

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  minZoom = 0.25;
  maxZoom = 3;
}

export class GameRenderer {
  readonly app: Application;
  readonly camera = new Camera();
  private readonly root = new Container();
  private ground!: ParticlePool;
  private belts!: ParticlePool;
  private items!: ParticlePool;
  private readonly shadows = new SpritePool();
  private readonly ents = new SpritePool();
  private readonly glow = new SpritePool();
  private readonly icons = new SpritePool();
  private readonly overlay = new Graphics();
  private readonly ghostSprites = new SpritePool();
  private groundVariants = 1;
  private readonly tmp = { x: 0, y: 0 };
  stats = { ground: 0, belts: 0, items: 0, entities: 0 };

  private constructor(app: Application, readonly sprites: SpriteLib) {
    this.app = app;
  }

  static async create(parent: HTMLElement, sprites: SpriteLib): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: parent,
      background: '#1d1b17',
      antialias: false,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      preference: 'webgl',
    });
    parent.appendChild(app.canvas);
    const r = new GameRenderer(app, sprites);
    r.init();
    return r;
  }

  private init(): void {
    const s = this.sprites;
    this.ground = new ParticlePool(s.frame('ground.0'));
    this.belts = new ParticlePool(s.frame('belt.s.0'));
    this.items = new ParticlePool(s.frame('item.iron-ore'));
    this.glow.container.blendMode = 'add';
    this.ents.container.sortableChildren = true;
    this.ghostSprites.container.alpha = 0.55;
    this.root.addChild(
      this.ground.container,
      this.belts.container,
      this.items.container,
      this.shadows.container,
      this.ents.container,
      this.glow.container,
      this.ghostSprites.container,
      this.icons.container,
      this.overlay,
    );
    this.shadows.container.alpha = 1;
    this.app.stage.addChild(this.root);
    this.groundVariants = Math.max(1, s.countPrefix('ground.'));
  }

  /** Bildschirm -> Weltkoordinaten (Felder). */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const c = this.camera;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    return { x: c.x + (sx - w / 2) / (TILE * c.zoom), y: c.y + (sy - h / 2) / (TILE * c.zoom) };
  }

  viewRect(): { x0: number; y0: number; x1: number; y1: number } {
    const a = this.screenToWorld(0, 0);
    const b = this.screenToWorld(this.app.screen.width, this.app.screen.height);
    return { x0: Math.floor(a.x) - 2, y0: Math.floor(a.y) - 3, x1: Math.ceil(b.x) + 2, y1: Math.ceil(b.y) + 2 };
  }

  render(world: World, alpha: number, ui: RenderUi): void {
    const c = this.camera;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.root.scale.set(c.zoom);
    this.root.position.set(Math.round(w / 2 - c.x * TILE * c.zoom), Math.round(h / 2 - c.y * TILE * c.zoom));
    const view = this.viewRect();
    this.drawGround(world, view);
    this.drawBelts(world, view, alpha);
    this.drawItems(world, view, alpha);
    this.drawEntities(world, view, alpha, ui);
    this.drawOverlay(world, ui);
  }

  // ------------------------------------------------------------------ Boden

  private drawGround(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const g = this.ground;
    const s = this.sprites;
    g.begin();
    const CS = MAPGEN.chunkSize;
    for (let cy = Math.floor(v.y0 / CS); cy <= Math.floor(v.y1 / CS); cy++) {
      for (let cx = Math.floor(v.x0 / CS); cx <= Math.floor(v.x1 / CS); cx++) {
        const chunk = world.map.getChunk(cx, cy);
        const tx0 = Math.max(v.x0, cx * CS);
        const tx1 = Math.min(v.x1, cx * CS + CS - 1);
        const ty0 = Math.max(v.y0, cy * CS);
        const ty1 = Math.min(v.y1, cy * CS + CS - 1);
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            const i = (ty - cy * CS) * CS + (tx - cx * CS);
            const px = tx * TILE + TILE / 2;
            const py = ty * TILE + TILE / 2;
            g.push(s.frame(`ground.${chunk.ground[i] % this.groundVariants}`), px, py);
            const res = chunk.resource[i];
            if (res) {
              const def = RESOURCE_BY_INDEX[res]!;
              const lvl = densityLevel(def, chunk.amount[i]);
              const variant = (chunk.ground[i] >> 3) % 4;
              g.push(s.frame(`res.${def.id}.${variant}.${lvl}`), px, py);
            }
          }
        }
      }
    }
    g.end();
    this.stats.ground = g.count;
  }

  // ------------------------------------------------------------------ Bänder

  private drawBelts(world: World, v: ReturnType<GameRenderer['viewRect']>, alpha: number): void {
    const b = this.belts;
    b.begin();
    world.belts.ensure();
    // 16 Frames pro 32 px Rillenabstand: 1 Frame pro Tick = 8 Positionen = 2 px
    const frame = Math.floor(world.tick + alpha);
    for (const t of world.belts.allTiles()) {
      if (t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1) continue;
      const tex = this.sprites.frame(`belt.${SHAPE_KEY[t.shape]}.${t.dir}`, frame);
      b.push(tex, t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
    }
    b.end();
    this.stats.belts = b.count;
  }

  private drawItems(world: World, v: ReturnType<GameRenderer['viewRect']>, alpha: number): void {
    const pool = this.items;
    pool.begin();
    const lag = (1 - alpha) * BELT.speed;
    const p = this.tmp;
    const itemTex: Texture[] = [];
    for (const line of world.belts.lines) {
      const tiles = line.tiles;
      for (let l = 0; l < 2; l++) {
        const lane = line.lanes[l];
        const gaps = lane.gaps;
        if (gaps.length === 0) continue;
        let pos = 0;
        let j = tiles.length - 1;
        for (let i = 0; i < gaps.length; i++) {
          pos += gaps[i];
          let d = i >= lane.firstMoving ? pos + lag : pos;
          if (d >= lane.len) d = lane.len - 0.001;
          while (j > 0 && d >= lane.tileEnd[j] + laneLength(tiles[j].shape, l)) j--;
          while (j < tiles.length - 1 && d < lane.tileEnd[j]) j++;
          const t = tiles[j];
          if (t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1) continue;
          BeltSystem.pointOn(t.shape, t.dir, l, Math.max(0, d - lane.tileEnd[j]), p);
          const idx = lane.items[i];
          const tex = itemTex[idx] ?? (itemTex[idx] = this.sprites.frame(`item.${itemId(idx)}`));
          pool.push(tex, (t.x + p.x) * TILE, (t.y + p.y) * TILE, ITEM_SCALE_BELT);
        }
      }
    }
    pool.end();
    this.stats.items = pool.count;
  }

  // ------------------------------------------------------------------ Gebäude

  private drawEntities(world: World, v: ReturnType<GameRenderer['viewRect']>, alpha: number, ui: RenderUi): void {
    const s = this.sprites;
    this.shadows.begin();
    this.ents.begin();
    this.glow.begin();
    this.icons.begin();
    let n = 0;
    const blink = Math.floor((world.tick + alpha) / 30) % 2 === 0;
    for (const e of world.entities.values()) {
      if (e.kind === 'belt') continue;
      const def = entityDef(e.name);
      if (e.x + def.width < v.x0 || e.x > v.x1 || e.y + def.height < v.y0 || e.y > v.y1) continue;
      n++;
      const cx = (e.x + def.width / 2) * TILE;
      const cy = (e.y + def.height / 2) * TILE;
      this.drawEntity(e, cx, cy, world, alpha);
      if (blink && (e.status === Status.NoFuel || e.status === Status.OutputBlocked)) {
        const icon = this.icons.get(s.frame(e.status === Status.NoFuel ? 'icon.nofuel' : 'icon.blocked'));
        icon.position.set(cx, cy);
        icon.scale.set(0.5);
      }
    }
    const pl = world.player;
    if (pl) {
      const px = (pl.prevPx + (pl.px - pl.prevPx) * alpha) / 256;
      const py = (pl.prevPy + (pl.py - pl.prevPy) * alpha) / 256;
      const fr = pl.walking ? Math.floor((world.tick + alpha) / 5) : 0;
      const sp = this.ents.get(s.frame(`player.${pl.facing}`, fr));
      sp.position.set(px * TILE, py * TILE);
      sp.zIndex = py * TILE;
    }
    this.drawGhost(ui);
    this.shadows.end();
    this.ents.end();
    this.glow.end();
    this.icons.end();
    this.stats.entities = n;
  }

  private drawEntity(e: Entity, cx: number, cy: number, world: World, alpha: number): void {
    const s = this.sprites;
    const z = cy + 16;
    switch (e.kind) {
      case 'drill': {
        const sh = this.shadows.get(s.frame(`drill.${e.dir}.shadow`));
        sh.position.set(cx, cy);
        const sp = this.ents.get(s.frame(`drill.${e.dir}`, Math.floor(e.workTicks / 4)));
        sp.position.set(cx, cy);
        sp.zIndex = z;
        break;
      }
      case 'furnace': {
        const sh = this.shadows.get(s.frame('furnace.shadow'));
        sh.position.set(cx, cy);
        const on = e.status === Status.Working;
        const sp = this.ents.get(s.frame(on ? 'furnace.on' : 'furnace.off'));
        sp.position.set(cx, cy);
        sp.zIndex = z;
        if (on) {
          const t = world.tick + alpha;
          const g = this.glow.get(s.frame('furnace.glow', Math.floor(t / 5) + e.id));
          g.position.set(cx, cy);
          g.alpha = 0.75 + 0.25 * Math.sin(t * 0.37 + e.id) * Math.sin(t * 0.13);
        }
        break;
      }
      case 'inserter': {
        const sh = this.shadows.get(s.frame('inserter.shadow'));
        sh.position.set(cx, cy);
        const base = this.ents.get(s.frame('inserter.base'));
        base.position.set(cx, cy);
        base.zIndex = z;
        let t = e.armT();
        const moving = e.phase === InserterPhase.ToDrop || e.phase === InserterPhase.ToPickup;
        if (moving) {
          const back = ((1 - alpha) * e.turnPerTick) / 500;
          t = e.phase === InserterPhase.ToDrop ? Math.max(0, t - back) : Math.min(1, t + back);
        }
        const rot = ((e.dir + 2) * Math.PI) / 2 + t * Math.PI;
        const reach = e.def.pickupVector[1] + (-e.def.dropVector[1] - e.def.pickupVector[1]) * t;
        const arm = this.ents.get(s.frame('inserter.arm'));
        const info = s.info('inserter.arm');
        const armLen = info ? info.h * info.anchor[1] : 64;
        arm.position.set(cx, cy);
        arm.rotation = rot;
        arm.scale.set(1, (reach * TILE) / armLen);
        arm.zIndex = z + 1;
        if (e.held) {
          const hx = cx + Math.sin(rot) * reach * TILE;
          const hy = cy - Math.cos(rot) * reach * TILE;
          const it = this.ents.get(s.frame(`item.${e.held}`));
          it.position.set(hx, hy);
          it.scale.set(ITEM_SCALE_BELT);
          it.zIndex = z + 2;
        }
        break;
      }
      case 'belt':
        break;
    }
  }

  private drawGhost(ui: RenderUi): void {
    const gp = this.ghostSprites;
    gp.begin();
    const g = ui.ghost;
    if (g) {
      const def = entityDef(g.name);
      const cx = (g.x + def.width / 2) * TILE;
      const cy = (g.y + def.height / 2) * TILE;
      const tint = g.ok ? 0x7dff8a : 0xff6a5a;
      let tex: Texture;
      switch (def.kind) {
        case 'belt': tex = this.sprites.frame(`belt.s.${g.dir}`); break;
        case 'drill': tex = this.sprites.frame(`drill.${g.dir}`); break;
        case 'furnace': tex = this.sprites.frame('furnace.off'); break;
        case 'inserter': tex = this.sprites.frame('inserter.base'); break;
      }
      const sp = gp.get(tex);
      sp.position.set(cx, cy);
      sp.tint = tint;
      if (def.kind === 'inserter') {
        const arm = gp.get(this.sprites.frame('inserter.arm'));
        arm.position.set(cx, cy);
        arm.rotation = (g.dir * Math.PI) / 2;
        arm.tint = tint;
      }
    }
    gp.end();
  }

  // ------------------------------------------------------------------ Overlay

  private drawOverlay(world: World, ui: RenderUi): void {
    const g = this.overlay;
    g.clear();
    const z = this.camera.zoom;
    if (ui.hover) {
      const hv = ui.hover;
      g.rect(hv.x * TILE, hv.y * TILE, hv.w * TILE, hv.h * TILE).stroke({ width: 2 / z, color: 0xffe08a, alpha: 0.9 });
      if (ui.mining > 0) {
        g.rect(hv.x * TILE, (hv.y + hv.h) * TILE + 4, hv.w * TILE, 6).fill({ color: 0x222222, alpha: 0.8 });
        g.rect(hv.x * TILE, (hv.y + hv.h) * TILE + 4, hv.w * TILE * ui.mining, 6).fill({ color: 0xf0b030 });
      }
    }
    if (ui.ghost) {
      const def = entityDef(ui.ghost.name);
      if (def.rotatable) this.arrow(g, ui.ghost.x + def.width / 2, ui.ghost.y + def.height / 2, ui.ghost.dir, ui.ghost.ok ? 0x9dff9a : 0xff8070);
    }
    if (!ui.alt) return;
    const v = this.viewRect();
    for (const e of world.entities.values()) {
      const def = entityDef(e.name);
      if (e.x + def.width < v.x0 || e.x > v.x1 || e.y + def.height < v.y0 || e.y > v.y1) continue;
      if (e.kind === 'belt') {
        this.arrow(g, e.x + 0.5, e.y + 0.5, e.dir, 0xffffff, 0.22, 0.45);
        continue;
      }
      if (e.kind === 'drill') {
        const [px, py] = world.drillOutputPoint(e);
        this.arrow(g, px, py - DY[e.dir] * 0.3 - 0, e.dir, 0xffd060, 0.3);
        const area = e.areaTiles();
        g.rect(area[0][0] * TILE + 3, area[0][1] * TILE + 3, e.def.miningAreaSize * TILE - 6, e.def.miningAreaSize * TILE - 6).stroke({ width: 1.5 / z, color: 0x80c0ff, alpha: 0.5 });
      } else if (e.kind === 'inserter') {
        this.arrow(g, e.x + 0.5 + DX[e.dir] * 0.75, e.y + 0.5 + DY[e.dir] * 0.75, e.dir, 0xffd060, 0.22);
      }
      this.drawAltContents(e, g);
    }
  }

  private drawAltContents(e: Entity, g: Graphics): void {
    const def = entityDef(e.name);
    const list: string[] = [];
    if (e.kind === 'furnace') {
      const r = e.recipe?.results[0].item ?? e.result.firstItem() ?? e.source.firstItem();
      if (r) list.push(r);
    }
    if (e.kind === 'drill' || e.kind === 'furnace' || e.kind === 'inserter') {
      const f = e.burner.fuel.firstItem();
      if (f && e.kind !== 'inserter') list.push(f);
    }
    const cx = (e.x + def.width / 2) * TILE;
    const cy = (e.y + def.height / 2) * TILE;
    list.forEach((it, k) => {
      const sp = this.icons.get(this.sprites.frame(`item.${it}`));
      const off = (k - (list.length - 1) / 2) * 26;
      g.circle(cx + off, cy + 14, 14).fill({ color: 0x000000, alpha: 0.55 });
      sp.position.set(cx + off, cy + 14);
      sp.scale.set(0.38);
    });
    const stat = STATUS_COLORS[e.status];
    if (stat !== undefined) g.circle(cx + def.width * TILE * 0.36, cy - def.height * TILE * 0.36, 5).fill({ color: stat });
  }

  private arrow(g: Graphics, x: number, y: number, dir: Dir, color: number, size = 0.3, alpha = 0.85): void {
    const fx = DX[dir];
    const fy = DY[dir];
    const lx = -fy;
    const ly = fx;
    const cx = x * TILE;
    const cy = y * TILE;
    const s = size * TILE;
    g.poly([
      cx + fx * s, cy + fy * s,
      cx - fx * s * 0.6 + lx * s * 0.7, cy - fy * s * 0.6 + ly * s * 0.7,
      cx - fx * s * 0.2, cy - fy * s * 0.2,
      cx - fx * s * 0.6 - lx * s * 0.7, cy - fy * s * 0.6 - ly * s * 0.7,
    ]).fill({ color, alpha });
  }
}

const STATUS_COLORS: Partial<Record<Status, number>> = {
  [Status.Working]: 0x50d060,
  [Status.NoFuel]: 0xe04030,
  [Status.OutputBlocked]: 0xf0a020,
  [Status.NoInput]: 0xd0c040,
  [Status.Depleted]: 0x808080,
  [Status.NoTarget]: 0xd0c040,
  [Status.Idle]: 0x808080,
};

export { Shape };
