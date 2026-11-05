import { Application, Container, Graphics, type Texture } from 'pixi.js';
import { BELT } from '../data/belt';
import { entityDef, sizeOf } from '../data/entities';
import { DECOR_MIN_ZOOM_SMALL } from '../data/decor';
import { MAPGEN } from '../data/mapgen';
import { RESOURCE_BY_INDEX, densityLevel } from '../data/resources';
import { BeltSystem, Shape } from '../sim/belts';
import { Status } from '../sim/entity';
import { DX, DY, type Dir } from '../sim/geom';
import { type Entity, InserterPhase, itemId } from '../sim/machines';
import type { World } from '../sim/world';
import type { SpriteLib } from './assets';
import { BiomeField } from './biome';
import { DecorField } from './decor';
import { CloudShadows } from './clouds';
import { Effects } from './effects';
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

/** Boden-Decal unter Gebäuden (Einbindung in die Landschaft). */
const GROUND_DECAL: Partial<Record<string, string>> = {
  drill: 'decal.dirt',
  furnace: 'decal.dirt',
  boiler: 'decal.dirt',
  generator: 'decal.gravel',
  assembler: 'decal.gravel',
  lab: 'decal.gravel',
};

/** Sprite-Präfix je Greifarm. */
const INSERTER_PREFIX: Record<string, string> = {
  'burner-inserter': 'inserter',
  inserter: 'inserter-electric',
  'long-handed-inserter': 'inserter-long',
};

export class GameRenderer {
  readonly app: Application;
  readonly camera = new Camera();
  private readonly root = new Container();
  private ground!: ParticlePool;
  private res!: ParticlePool;
  private water: ParticlePool | null = null;
  private waterTex: Texture[][] = [];
  private readonly decals = new SpritePool();
  private readonly groundItems = new SpritePool();
  private decor: DecorField | null = null;
  private decorMap: unknown = null;
  private belts!: ParticlePool;
  private items!: ParticlePool;
  private readonly shadows = new SpritePool();
  private readonly ents = new SpritePool();
  private readonly glow = new SpritePool();
  private readonly fxPool = new SpritePool();
  private readonly fxAddPool = new SpritePool();
  private effects: Effects | null = null;
  private readonly cloudPool = new SpritePool();
  private clouds: CloudShadows | null = null;
  /** Blickrichtung der Figur (0..7, 0 = Norden, im Uhrzeigersinn). */
  private playerDir = 4;
  private readonly icons = new SpritePool();
  private readonly overlay = new Graphics();
  private readonly wires = new Graphics();
  private readonly ghostSprites = new SpritePool();
  /** Boden ist eine periodische Fläche aus groundPeriod×groundPeriod Kacheln. */
  private groundPeriod = 1;
  private readonly groundTex: Texture[] = [];
  /** Bandbilder je Geschwindigkeit: [Form*4+Richtung] -> Frames. */
  private readonly beltTex = new Map<number, Texture[][]>();
  /** Endkappen je Geschwindigkeit: [Ende 0..3, Anfang 0..3] */
  private readonly capTex = new Map<number, Texture[]>();
  private readonly resCache = new Map<number, Texture>();
  private resVariants = 4;

  private resTex(res: number, id: string, variant: number, lvl: number): Texture {
    const key = res * 64 + variant * 8 + lvl;
    let t = this.resCache.get(key);
    if (!t) this.resCache.set(key, (t = this.sprites.frame(`res.${id}.${variant}.${lvl}`)));
    return t;
  }
  private readonly tmp = { x: 0, y: 0 };
  stats = { ground: 0, decor: 0, belts: 0, items: 0, entities: 0 };

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
    this.ground = new ParticlePool(s.frame('ground.0.0'));
    this.res = new ParticlePool(s.frame('ground.0.0'));
    if (s.has('water.15.0')) {
      this.water = new ParticlePool(s.frame('water.15.0'));
      for (let c = 0; c < 16; c++) {
        const list: Texture[] = [];
        for (let v = 0; s.has(`water.${c}.${v}`); v++) list.push(s.frame(`water.${c}.${v}`));
        this.waterTex.push(list);
      }
    }
    this.belts = new ParticlePool(s.frame('belt.s.0'));
    this.items = new ParticlePool(s.frame('item.iron-ore'));
    this.glow.container.blendMode = 'add';
    this.fxAddPool.container.blendMode = 'add';
    this.effects = new Effects(s, this.fxPool, this.fxAddPool, TILE);
    this.clouds = new CloudShadows(s, this.cloudPool, TILE);
    this.ents.container.sortableChildren = true;
    this.ghostSprites.container.alpha = 0.55;
    this.root.addChild(
      this.ground.container,
      ...(this.water ? [this.water.container] : []),
      this.decals.container,
      this.res.container,
      this.groundItems.container,
      this.belts.container,
      this.items.container,
      this.shadows.container,
      this.ents.container,
      this.glow.container,
      this.fxPool.container,
      this.fxAddPool.container,
      this.cloudPool.container,
      this.wires,
      this.ghostSprites.container,
      this.icons.container,
      this.overlay,
    );
    this.shadows.container.alpha = 0.5;
    this.app.stage.addChild(this.root);
    while (s.has(`ground.${this.groundPeriod}.0`)) this.groundPeriod++;
    const gp = this.groundPeriod;
    for (let y = 0; y < gp; y++) for (let x = 0; x < gp; x++) this.groundTex[x + gp * y] = s.frame(`ground.${x}.${y}`);
    while (s.has(`res.iron-ore.${this.resVariants}.0`)) this.resVariants++;
    // Bandstufen: Präfix der Sprites je Geschwindigkeit (fehlt eine Stufe, wird das gelbe Band genutzt)
    for (const [speed, prefix] of [[BELT.speed, 'belt'], [BELT.speed * 2, 'fast-belt']] as const) {
      const pre = s.has(`${prefix}.s.0`) ? prefix : 'belt';
      const tex: Texture[][] = [];
      for (let sh = 0; sh < 3; sh++) for (let d = 0; d < 4; d++) tex[sh * 4 + d] = s.frames(`${pre}.${SHAPE_KEY[sh]}.${d}`);
      this.beltTex.set(speed, tex);
      const caps: Texture[] = [];
      if (s.has(`${pre}.cap.end.0`)) for (const k of ['end', 'start']) for (let d = 0; d < 4; d++) caps.push(s.frame(`${pre}.cap.${k}.${d}`));
      this.capTex.set(speed, caps);
    }
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
    this.drawWires(world, view);
    this.effects?.update(world, alpha, view);
    this.clouds?.update(world, alpha, view);
    this.drawOverlay(world, ui);
  }

  // ------------------------------------------------------------------ Boden

  private drawGround(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const g = this.ground;
    const rp = this.res;
    g.begin();
    rp.begin();
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
            const gp = this.groundPeriod;
            g.push(this.groundTex[(((tx % gp) + gp) % gp) + gp * (((ty % gp) + gp) % gp)], px, py, 1, 1, 0, this.biomeField(world).color(tx, ty));
            const res = chunk.resource[i];
            if (res) {
              const def = RESOURCE_BY_INDEX[res]!;
              const lvl = densityLevel(def, chunk.amount[i]);
              const variant = (chunk.ground[i] >> 3) % this.resVariants;
              const h = chunk.ground[i];
              const hh = (h * 2654435761) >>> 0;
              const rot = (((hh >>> 8) & 255) / 255 - 0.5) * 1.0;
              const sc = 0.88 + ((hh >>> 16) & 255) / 255 * 0.26;
              rp.push(this.resTex(res, def.id, variant, lvl), px + ((h & 7) - 3.5) * 1.6, py + (((h >> 5) & 7) - 3.5) * 1.6, sc, 1, rot);
            }
          }
        }
      }
    }
    g.end();
    rp.end();
    this.stats.ground = g.count + rp.count;
    this.drawWater(world, v);
    this.drawDecals(world, v);
    this.drawGroundItems(world, v);
  }

  // ------------------------------------------------------------------ Items auf dem Boden

  private drawGroundItems(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const p = this.groundItems;
    p.begin();
    if (world.ground.size) {
      const shadow = this.sprites.has('item.shadow') ? this.sprites.frame('item.shadow') : null;
      for (const list of world.ground.values()) {
        for (const g of list) {
          const x = g.x / 256;
          const y = g.y / 256;
          if (x < v.x0 || x > v.x1 + 1 || y < v.y0 || y > v.y1 + 1) continue;
          if (shadow) {
            const sh = p.get(shadow);
            sh.position.set(x * TILE + 2, y * TILE + 3);
            sh.alpha = 0.55;
          }
          const sp = p.get(this.sprites.frame(`item.${g.item}`));
          sp.position.set(x * TILE, y * TILE);
          sp.scale.set(ITEM_SCALE_BELT);
        }
      }
    }
    p.end();
  }

  // ------------------------------------------------------------------ Wasser

  /** Wasser nach dem Ecken-Prinzip: ein Sprite je Feldecke, Fall aus den vier Nachbarfeldern. */
  private drawWater(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const pool = this.water;
    if (!pool) return;
    pool.begin();
    const CS = MAPGEN.chunkSize;
    const m = world.map;
    for (let cy = Math.floor(v.y0 / CS); cy <= Math.floor((v.y1 + 1) / CS); cy++) {
      for (let cx = Math.floor(v.x0 / CS); cx <= Math.floor((v.x1 + 1) / CS); cx++) {
        // Ecken dieses Chunks brauchen Wasserinfo des Chunks und seiner Nachbarn links/oben
        if (!m.getChunk(cx, cy).hasWater && !m.getChunk(cx - 1, cy).hasWater && !m.getChunk(cx, cy - 1).hasWater && !m.getChunk(cx - 1, cy - 1).hasWater) continue;
        const x0 = Math.max(v.x0, cx * CS);
        const x1 = Math.min(v.x1 + 1, cx * CS + CS - 1);
        const y0 = Math.max(v.y0, cy * CS);
        const y1 = Math.min(v.y1 + 1, cy * CS + CS - 1);
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const c = (m.isWater(x - 1, y - 1) ? 1 : 0) | (m.isWater(x, y - 1) ? 2 : 0) | (m.isWater(x - 1, y) ? 4 : 0) | (m.isWater(x, y) ? 8 : 0);
            if (c === 0) continue;
            const list = this.waterTex[c];
            if (!list.length) continue;
            pool.push(list[(((x * 7 + y * 13) % list.length) + list.length) % list.length], x * TILE, y * TILE);
          }
        }
      }
    }
    pool.end();
  }

  // ------------------------------------------------------------------ Dekoration

  private decorField(world: World): DecorField {
    if (!this.decor || this.decorMap !== world.map) {
      const s = this.sprites;
      const bio = this.biomeField(world);
      this.decor = new DecorField(world.map, world.seed, (prefix) => s.countPrefix(`${prefix}.`), (tx, ty) => bio.fertility(tx, ty));
      this.decorMap = world.map;
    }
    return this.decor;
  }

  private biome: BiomeField | null = null;
  private biomeMap: World['map'] | null = null;
  biomeField(world: World): BiomeField {
    if (!this.biome || this.biomeMap !== world.map) {
      this.biome = new BiomeField(world.map);
      this.biomeMap = world.map;
    }
    return this.biome;
  }

  /** Sichtbare Dekoration je Chunk, mit Rand für große Sprites (Bäume). */
  private *visibleDecor(world: World, v: ReturnType<GameRenderer['viewRect']>, margin: number) {
    const field = this.decorField(world);
    const CS = MAPGEN.chunkSize;
    for (let cy = Math.floor((v.y0 - margin) / CS); cy <= Math.floor((v.y1 + margin) / CS); cy++)
      for (let cx = Math.floor((v.x0 - margin) / CS); cx <= Math.floor((v.x1 + margin) / CS); cx++)
        for (const d of field.chunk(cx, cy)) {
          if (d.x < v.x0 - margin || d.x > v.x1 + margin || d.y < v.y0 - margin || d.y > v.y1 + margin) continue;
          yield d;
        }
  }

  private drawDecals(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const p = this.decals;
    p.begin();
    const small = this.camera.zoom >= DECOR_MIN_ZOOM_SMALL;
    let n = 0;
    for (const d of this.visibleDecor(world, v, 4)) {
      if (d.kind.layer !== 'decal') continue;
      if (!small && d.kind.cell < 6) continue;
      if (!this.sprites.has(`${d.kind.sprite}.${d.variant}`)) continue;
      const name = `${d.kind.sprite}.${d.variant}`;
      const sp = p.get(this.sprites.frame(name));
      sp.position.set(d.x * TILE, d.y * TILE);
      const k = this.sprites.info(name)?.meta?.scale ?? 1;
      sp.scale.set(k * d.sx, k * d.sy);
      sp.rotation = d.rot;
      n++;
    }
    // Einbindung: festgetretene Erde bzw. Kies unter größeren Gebäuden
    if (this.sprites.has('decal.dirt.0')) {
      for (const e of world.entities.values()) {
        if (!GROUND_DECAL[e.kind]) continue;
        if (e.x + e.w < v.x0 - 1 || e.x > v.x1 + 1 || e.y + e.h < v.y0 - 1 || e.y > v.y1 + 1) continue;
        const h = (Math.imul(e.x * 73856093 ^ e.y * 19349663, 0x9e3779b1) >>> 0);
        const name = `${GROUND_DECAL[e.kind]}.${h % 4}`;
        if (!this.sprites.has(name)) continue;
        const tex = this.sprites.frame(name);
        const sp = p.get(tex);
        sp.position.set(e.cx * TILE, e.cy * TILE);
        const size = Math.max(e.w, e.h) * 1.45 * TILE;
        sp.scale.set(size / tex.width, (Math.min(e.w, e.h) * 1.45 * TILE) / tex.height);
        if (e.h > e.w) sp.scale.set((e.w * 1.45 * TILE) / tex.width, (e.h * 1.45 * TILE) / tex.height);
        sp.rotation = ((h >> 8) % 7 - 3) * 0.05;
        sp.alpha = 0.9;
        n++;
      }
    }
    p.end();
    this.stats.decor = n;
  }

  /** Flora im Gebäude-Layer (nach y sortiert), Schatten in der Schattenebene. Unter Gebäuden ausgeblendet. */
  private drawFlora(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const s = this.sprites;
    for (const d of this.visibleDecor(world, v, 7)) {
      if (d.kind.layer !== 'flora') continue;
      // Bäume halten Abstand zu Gebäuden (Krone), kleinere Pflanzen nur zum eigenen Feld
      const r = d.kind.id === 'tree' || d.kind.id === 'conifer' ? 2 : d.kind.id === 'rocks' ? 1 : 0;
      let blocked = false;
      for (let oy = -r; oy <= r && !blocked; oy++) for (let ox = -r; ox <= r && !blocked; ox++) if (world.entityAt(d.tx + ox, d.ty + oy)) blocked = true;
      if (blocked) continue;
      const name = `${d.kind.sprite}.${d.variant}`;
      if (d.kind.shadow) {
        const sh = this.shadows.get(s.frame(`${name}.shadow`));
        sh.position.set(d.x * TILE, d.y * TILE);
        sh.scale.set(s.info(`${name}.shadow`)?.meta?.scale ?? 1);
      }
      const sp = this.ents.get(s.frame(name));
      sp.position.set(d.x * TILE, d.y * TILE);
      sp.zIndex = d.y * TILE;
    }
    // Bäume aus der Simulation (fällbar)
    const CS = MAPGEN.chunkSize;
    const m = 7;
    for (let cy = Math.floor((v.y0 - 2) / CS); cy <= Math.floor((v.y1 + m) / CS); cy++) {
      for (let cx = Math.floor((v.x0 - m) / CS); cx <= Math.floor((v.x1 + m) / CS); cx++) {
        for (const t of world.map.trees.treesIn(cx, cy)) {
          if (t.x < v.x0 - m || t.x > v.x1 + m || t.y < v.y0 - 2 || t.y > v.y1 + m) continue;
          const name = this.treeSprite(t.kind, t.variant);
          if (!name) continue;
          if (s.has(`${name}.shadow`)) {
            const sh = this.shadows.get(s.frame(`${name}.shadow`));
            sh.position.set(t.x * TILE, t.y * TILE);
            sh.scale.set(s.info(`${name}.shadow`)?.meta?.scale ?? 1);
          }
          const sp = this.ents.get(s.frame(name));
          sp.position.set(t.x * TILE, t.y * TILE);
          sp.zIndex = t.y * TILE;
        }
      }
    }
  }

  private treeCounts: number[] | null = null;
  /** Sprite einer Baumart/Variante; fehlt die Art (z. B. abgestorbene Bäume), wird ein normaler Baum gezeigt. */
  private treeSprite(kind: number, variant: number): string | null {
    const kinds = MAPGEN.trees.kinds;
    if (!this.treeCounts) this.treeCounts = kinds.map((k) => this.sprites.countPrefix(`${k.sprite}.`));
    let k = kind;
    if (!this.treeCounts[k]) k = 0;
    const n = this.treeCounts[k];
    return n ? `${kinds[k].sprite}.${variant % n}` : null;
  }

  // ------------------------------------------------------------------ Bänder

  private drawBelts(world: World, v: ReturnType<GameRenderer['viewRect']>, alpha: number): void {
    const b = this.belts;
    b.begin();
    world.belts.ensure();
    // 16 Frames pro 32 px Rillenabstand: 1 Frame pro Tick = 8 Positionen = 2 px (schnelles Band: 2 Frames)
    const t0 = world.tick + alpha;
    const fallback = this.beltTex.get(BELT.speed)!;
    for (const t of world.belts.allTiles()) {
      if (t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1) continue;
      const frames = (this.beltTex.get(t.speed) ?? fallback)[t.shape * 4 + t.dir];
      const frame = Math.floor((t0 * t.speed) / BELT.speed);
      b.push(frames[frame % frames.length], t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
    }
    // Umlenktrommeln an offenen Bandanfängen und -enden (nur gerade Felder, nicht an Untergrund/Splitter)
    const off = (t: { x: number; y: number }) => t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1;
    for (const line of world.belts.lines) {
      const caps = this.capTex.get(line.speed);
      if (!caps?.length) continue;
      const first = line.tiles[0];
      const last = line.tiles[line.tiles.length - 1];
      const out = line.lanes[0].out;
      const loop = out !== null && out.line === line && !out.split;
      if (loop) continue;
      if (!line.fedStraight && first.shape === Shape.Straight && !first.ug && !first.splitter && !off(first)) {
        b.push(caps[4 + first.dir], first.x * TILE + TILE / 2, first.y * TILE + TILE / 2);
      }
      if (!out && last.shape === Shape.Straight && !last.ug && !last.splitter && !off(last)) {
        b.push(caps[last.dir], last.x * TILE + TILE / 2, last.y * TILE + TILE / 2);
      }
    }
    b.end();
    this.stats.belts = b.count;
  }

  private drawItems(world: World, v: ReturnType<GameRenderer['viewRect']>, alpha: number): void {
    const pool = this.items;
    pool.begin();
    const p = this.tmp;
    const itemTex: Texture[] = [];
    const shadow = this.sprites.has('item.shadow') ? this.sprites.frame('item.shadow') : null;
    for (const line of world.belts.lines) {
      const tiles = line.tiles;
      const lag = (1 - alpha) * line.speed;
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
          while (j > 0 && d >= lane.tileEnd[j] + tiles[j].lens[l]) j--;
          while (j < tiles.length - 1 && d < lane.tileEnd[j]) j++;
          const t = tiles[j];
          if (t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1) continue;
          const vo = BeltSystem.visualOffset(t, l, Math.max(0, d - lane.tileEnd[j]));
          if (vo < 0) continue; // unter der Erde
          BeltSystem.pointOn(t.shape, t.dir, l, vo, p);
          const idx = lane.items[i];
          const tex = itemTex[idx] ?? (itemTex[idx] = this.sprites.frame(`item.${itemId(idx)}`));
          const ix = (t.x + p.x) * TILE;
          const iy = (t.y + p.y) * TILE;
          if (shadow) pool.push(shadow, ix + 2, iy + 3, 1, 0.55);
          pool.push(tex, ix, iy, ITEM_SCALE_BELT);
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
      if (e.x + e.w < v.x0 || e.x > v.x1 || e.y + e.h < v.y0 || e.y > v.y1) continue;
      n++;
      const cx = e.cx * TILE;
      const cy = e.cy * TILE;
      this.drawEntity(e, cx, cy, world, alpha);
      if (blink && (e.status === Status.NoFuel || e.status === Status.OutputBlocked)) {
        const icon = this.icons.get(s.frame(e.status === Status.NoFuel ? 'icon.nofuel' : 'icon.blocked'));
        icon.position.set(cx, cy);
        icon.scale.set(0.5);
      }
    }
    this.drawFlora(world, v);
    const pl = world.player;
    if (pl) {
      const px = (pl.prevPx + (pl.px - pl.prevPx) * alpha) / 256;
      const py = (pl.prevPy + (pl.py - pl.prevPy) * alpha) / 256;
      const t = world.tick + alpha;
      let tex: Texture;
      if (s.has('player.walk.0')) {
        // 8 Richtungen aus der Bewegung bzw. zum Abbauziel; Ruhe, Laufen, Abbauen
        const mt = pl.mineTarget;
        const mining = mt !== null && pl.mineProgress > 0;
        let dx = pl.px - pl.prevPx;
        let dy = pl.py - pl.prevPy;
        if (mining) {
          const e = mt.kind === 'entity' ? world.entities.get(mt.id) : undefined;
          const tx = mt.kind === 'resource' ? mt.x + 0.5 : mt.kind === 'tree' ? mt.x : e?.cx ?? px;
          const ty = mt.kind === 'resource' ? mt.y + 0.5 : mt.kind === 'tree' ? mt.y : e?.cy ?? py;
          dx = tx - px;
          dy = ty - py;
        }
        if (dx !== 0 || dy !== 0) this.playerDir = (Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8;
        const k = this.playerDir;
        if (mining) tex = s.frame(`player.mine.${k}`, Math.floor(t / 7.5));
        else if (pl.walking) tex = s.frame(`player.walk.${k}`, Math.floor(t / 2.5));
        else tex = s.frame(`player.idle.${k}`, Math.floor(t / 10));
      } else tex = s.frame(`player.${pl.facing}`, pl.walking ? Math.floor(t / 5) : 0);
      const sp = this.ents.get(tex);
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
    cx = Math.round(cx);
    switch (e.kind) {
      case 'drill': {
        const base = e.name === 'burner-mining-drill' ? 'drill' : e.name;
        if (!s.has(`${base}.${e.dir}`)) {
          this.drawGeneric(e, cx, cy, z);
          break;
        }
        const sh = this.shadows.get(s.frame(`${base}.${e.dir}.shadow`));
        sh.position.set(cx, cy);
        const sp = this.ents.get(s.frame(`${base}.${e.dir}`, Math.floor(e.workTicks / 4)));
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
          const g = this.glow.get(s.frame('furnace.glow', Math.floor(t / 6) + e.id * 3));
          g.position.set(cx, cy);
          g.alpha = 0.8 + 0.2 * Math.sin(t * 0.37 + e.id) * Math.sin(t * 0.13 + e.id * 2);
        }
        break;
      }
      case 'inserter': {
        const pre = INSERTER_PREFIX[e.name] && s.has(`${INSERTER_PREFIX[e.name]}.arm`) ? INSERTER_PREFIX[e.name] : 'inserter';
        const sh = this.shadows.get(s.frame(`${pre}.shadow`));
        sh.position.set(cx, cy);
        const base = this.ents.get(s.frame(`${pre}.base`));
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
        const info = s.info(`${pre}.arm`);
        const angles = info?.meta?.angles ?? 0;
        let hx: number;
        let hy: number;
        if (angles > 0) {
          // vorgerenderte Winkel (geneigte Kamera), Reichweite über leichte Skalierung
          const k = ((Math.round((rot / (Math.PI * 2)) * angles) % angles) + angles) % angles;
          const arm = this.ents.get(s.frame(`${pre}.arm`, k));
          const sc = reach / (info?.meta?.reach ?? 1);
          arm.position.set(cx, cy);
          arm.scale.set(sc);
          arm.zIndex = z + 1;
          const lift = (info?.meta?.handLift ?? 0) * TILE;
          hx = cx + Math.sin(rot) * reach * TILE;
          hy = cy - Math.cos(rot) * reach * TILE - lift;
        } else {
          const arm = this.ents.get(s.frame(`${pre}.arm`));
          const armLen = (info?.meta?.reach ?? 1) * TILE;
          const lift = (s.info('inserter.base')?.meta?.pivotLift ?? 0) * TILE;
          arm.position.set(cx, cy - lift);
          arm.rotation = rot;
          arm.scale.set(1, (reach * TILE) / armLen);
          arm.zIndex = z + 1;
          hx = cx + Math.sin(rot) * reach * TILE;
          hy = cy - lift - Math.cos(rot) * reach * TILE;
        }
        if (e.held) {
          const it = this.ents.get(s.frame(`item.${e.held}`));
          it.position.set(hx, hy);
          it.scale.set(ITEM_SCALE_BELT);
          it.zIndex = z + 2;
        }
        break;
      }
      case 'pipe': {
        const mask = world.fluids.connections.get(e.id) ?? 0;
        if (s.has(`pipe.${mask}`)) {
          const sp = this.ents.get(s.frame(`pipe.${mask}`));
          sp.position.set(cx, cy);
          sp.zIndex = z - 32;
        } else this.drawGeneric(e, cx, cy, z - 32);
        break;
      }
      case 'belt':
        break;
      case 'underground': {
        const base = s.has(`${e.name}.in.0`) ? e.name : 'underground-belt';
        const key = `${base}.${e.output ? 'out' : 'in'}.${e.dir}`;
        if (s.has(key)) {
          const sp = this.ents.get(s.frame(key));
          sp.position.set(cx, cy);
          sp.zIndex = z;
        } else this.drawGeneric(e, cx, cy, z);
        break;
      }
      default:
        this.drawGeneric(e, cx, cy, z);
    }
  }

  /** Stromkabel zwischen Masten, leicht durchhängend. */
  private drawWires(world: World, v: ReturnType<GameRenderer['viewRect']>): void {
    const g = this.wires;
    g.clear();
    const lift = (this.sprites.info('small-electric-pole')?.meta?.wireLift ?? 0.95) * TILE;
    for (const [a, b] of world.power.wires) {
      const pa = world.entities.get(a);
      const pb = world.entities.get(b);
      if (!pa || !pb) continue;
      if (Math.max(pa.cx, pb.cx) < v.x0 || Math.min(pa.cx, pb.cx) > v.x1 || Math.max(pa.cy, pb.cy) < v.y0 || Math.min(pa.cy, pb.cy) > v.y1) continue;
      const ax = pa.cx * TILE;
      const ay = pa.cy * TILE - lift;
      const bx = pb.cx * TILE;
      const by = pb.cy * TILE - lift;
      const sag = Math.hypot(bx - ax, by - ay) * 0.08;
      g.moveTo(ax, ay).quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by).stroke({ width: 1.6, color: 0x5a3a22, alpha: 0.85 });
    }
  }

  /** Sprite nach Schema name.richtung bzw. name (animiert, mit Schatten und Leuchten), sonst Item-Symbol. */
  private drawGeneric(e: Entity, cx: number, cy: number, z: number): void {
    const s = this.sprites;
    const base = s.has(`${e.name}.${e.dir}`) ? `${e.name}.${e.dir}` : s.has(e.name) ? e.name : null;
    const work = (e as { workTicks?: number }).workTicks ?? 0;
    if (!base) {
      const sp = this.ents.get(s.frame(`item.${e.def.item}`));
      sp.position.set(cx, cy);
      sp.scale.set(Math.min(e.w, e.h) * 0.85);
      sp.zIndex = z;
      return;
    }
    if (s.has(`${base}.shadow`)) {
      const sh = this.shadows.get(s.frame(`${base}.shadow`));
      sh.position.set(cx, cy);
      sh.scale.set(s.info(`${base}.shadow`)?.meta?.scale ?? 1);
    }
    const sp = this.ents.get(s.frame(base, Math.floor(work / 4)));
    sp.position.set(cx, cy);
    sp.zIndex = z;
    if (e.status === Status.Working && s.has(`${base}.glow`)) {
      const g = this.glow.get(s.frame(`${base}.glow`, Math.floor(work / 6)));
      g.position.set(cx, cy);
    }
  }

  private drawGhost(ui: RenderUi): void {
    const gp = this.ghostSprites;
    gp.begin();
    const g = ui.ghost;
    if (g) {
      const def = entityDef(g.name);
      const [gw, gh] = sizeOf(def, g.dir);
      const cx = (g.x + gw / 2) * TILE;
      const cy = (g.y + gh / 2) * TILE;
      const tint = g.ok ? 0x7dff8a : 0xff6a5a;
      let tex: Texture;
      switch (def.kind) {
        case 'belt': tex = this.sprites.frame(def.speed > BELT.speed && this.sprites.has(`fast-belt.s.${g.dir}`) ? `fast-belt.s.${g.dir}` : `belt.s.${g.dir}`); break;
        case 'underground': {
          const b = this.sprites.has(`${g.name}.in.${g.dir}`) ? g.name : 'underground-belt';
          tex = this.sprites.frame(this.sprites.has(`${b}.in.${g.dir}`) ? `${b}.in.${g.dir}` : `item.${def.item}`);
          break;
        }
        case 'drill': tex = this.sprites.frame(g.name === 'burner-mining-drill' || !this.sprites.has(`${g.name}.${g.dir}`) ? `drill.${g.dir}` : `${g.name}.${g.dir}`); break;
        case 'furnace': tex = this.sprites.frame('furnace.off'); break;
        case 'inserter': tex = this.sprites.frame('inserter.base'); break;
        default: {
          const b = this.sprites.has(`${g.name}.${g.dir}`) ? `${g.name}.${g.dir}` : this.sprites.has(g.name) ? g.name : `item.${def.item}`;
          tex = this.sprites.frame(b);
        }
      }
      const sp = gp.get(tex);
      sp.position.set(cx, cy);
      sp.tint = tint;
      if (def.kind === 'inserter') {
        const angles = this.sprites.info('inserter.arm')?.meta?.angles ?? 0;
        const arm = gp.get(this.sprites.frame('inserter.arm', angles ? (g.dir * angles) / 4 : 0));
        arm.position.set(cx, cy);
        if (!angles) arm.rotation = (g.dir * Math.PI) / 2;
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
      if (def.kind === 'drill') {
        const a = def.miningAreaSize;
        const [gw, gh] = sizeOf(def, ui.ghost.dir);
        const ox = ui.ghost.x + (gw - a) / 2;
        const oy = ui.ghost.y + (gh - a) / 2;
        g.rect(ox * TILE + 2, oy * TILE + 2, a * TILE - 4, a * TILE - 4).stroke({ width: 2 / z, color: 0x80c0ff, alpha: 0.8 });
      }
      const [aw, ah] = sizeOf(def, ui.ghost.dir);
      if (def.rotatable) this.arrow(g, ui.ghost.x + aw / 2, ui.ghost.y + ah / 2, ui.ghost.dir, ui.ghost.ok ? 0x9dff9a : 0xff8070);
    }
    if (!ui.alt) return;
    const v = this.viewRect();
    for (const e of world.entities.values()) {
      if (e.x + e.w < v.x0 || e.x > v.x1 || e.y + e.h < v.y0 || e.y > v.y1) continue;
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
    const list: string[] = [];
    if (e.kind === 'furnace') {
      const r = e.recipe?.results[0].item ?? e.result.firstItem() ?? e.source.firstItem();
      if (r) list.push(r);
    }
    const f = e.burner?.fuel.firstItem();
    if (f && e.kind !== 'inserter') list.push(f);
    if (e.kind === 'container') {
      const f = e.inventory.firstItem();
      if (f) list.push(f);
    }
    const cx = e.cx * TILE;
    const cy = e.cy * TILE;
    list.forEach((it, k) => {
      const sp = this.icons.get(this.sprites.frame(`item.${it}`));
      const off = (k - (list.length - 1) / 2) * 26;
      g.circle(cx + off, cy + 14, 14).fill({ color: 0x000000, alpha: 0.55 });
      sp.position.set(cx + off, cy + 14);
      sp.scale.set(0.38);
    });
    const stat = STATUS_COLORS[e.status];
    if (stat !== undefined) g.circle(cx + e.w * TILE * 0.36, cy - e.h * TILE * 0.36, 5).fill({ color: stat });
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
  [Status.NoPower]: 0xe04030,
};

export { Shape };
