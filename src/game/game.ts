import { entityDef } from '../data/entities';
import { ITEMS } from '../data/items';
import { PLAYER } from '../data/player';
import { RESOURCE_BY_INDEX } from '../data/resources';
import type { SpriteLib } from '../render/assets';
import { type Ghost, GameRenderer, type RenderUi } from '../render/renderer';
import { type Dir, dirFromDelta, rotCW } from '../sim/geom';
import { type Entity, insertInto, itemIndex } from '../sim/machines';
import type { World } from '../sim/world';
import { Hud } from '../ui/hud';
import { Input } from './input';
import type { Scene } from './scenes';

const STEP_MS = 1000 / 60;
/** Autosave alle 5 Minuten Spielzeit. */
const AUTOSAVE_TICKS = 5 * 60 * 60;

type HistoryEntry =
  | { type: 'build'; id: number; name: string; x: number; y: number; dir: Dir }
  | { type: 'remove'; name: string; x: number; y: number; dir: Dir };
const MAX_STEPS_PER_FRAME = 5;

export class Game {
  world: World;
  creative: boolean;
  readonly renderer: GameRenderer;
  readonly input: Input;
  readonly hud: Hud;
  cursorItem: string | null = null;
  buildDir: Dir = 0;
  alt = false;
  paused = false;
  private acc = 0;
  private dragLast: { x: number; y: number } | null = null;
  private dragBelts: number[] = [];
  private dragStart: { x: number; y: number } | null = null;
  private dragAxis: 'x' | 'y' | null = null;
  /** Bau- und Abbauaktionen des Spielers (Rückgängig mit Strg+Z). */
  private readonly history: HistoryEntry[] = [];
  private lastAutosaveTick = 0;
  private fps = 60;
  private frameCount = 0;
  private fpsTime = 0;
  /** Für Tests/Debugging von außen lesbar. */
  readonly debug: boolean;

  constructor(readonly root: HTMLElement, renderer: GameRenderer, readonly sprites: SpriteLib, scene: Scene, debug: boolean) {
    this.renderer = renderer;
    this.world = scene.world;
    this.creative = scene.creative;
    this.debug = debug || scene.creative;
    this.input = new Input(renderer.app.canvas);
    this.hud = new Hud(root, this, sprites);
    this.applySceneCamera(scene);
    this.hud.setTitle(scene.title);
    if (this.creative) this.cursorItem = 'transport-belt';
  }

  applySceneCamera(scene: Scene): void {
    const c = this.renderer.camera;
    c.x = scene.camera.x;
    c.y = scene.camera.y;
    c.zoom = scene.camera.zoom;
    c.minZoom = Math.min(0.25, scene.camera.zoom);
  }

  /** Spielstand ersetzen (Laden). */
  setWorld(world: World, creative: boolean): void {
    this.world = world;
    this.creative = creative;
    this.acc = 0;
    this.hud.refreshAll();
  }

  start(): void {
    this.renderer.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  private frame(dt: number): void {
    this.handleInput();
    if (!this.paused) {
      this.acc += Math.min(dt, 250);
      let steps = 0;
      while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.applyPlayerInput();
        this.world.step();
        this.acc -= STEP_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = Math.min(this.acc, STEP_MS);
      const p = this.world.player;
      if (p) {
        for (const r of p.minedLog.splice(0)) this.pushHistory({ type: 'remove', name: r.name, x: r.x, y: r.y, dir: r.dir as Dir });
        if (!this.creative && this.world.tick - this.lastAutosaveTick >= AUTOSAVE_TICKS) {
          this.lastAutosaveTick = this.world.tick;
          void this.hud.saveGame('autosave', true);
        }
      }
    }
    const alpha = this.paused ? 1 : this.acc / STEP_MS;
    this.updateCamera(dt, alpha);
    this.renderer.render(this.world, alpha, this.buildUi());
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 500) {
      this.fps = (this.frameCount * 1000) / this.fpsTime;
      this.frameCount = 0;
      this.fpsTime = 0;
    }
    this.hud.update(this.fps);
    this.input.endFrame();
  }

  // ------------------------------------------------------------ Kamera

  private updateCamera(dt: number, alpha: number): void {
    const c = this.renderer.camera;
    const wheel = this.input.takeWheel();
    if (wheel !== 0 && this.input.overCanvas) {
      c.zoom = Math.min(c.maxZoom, Math.max(c.minZoom, c.zoom * Math.pow(0.85, wheel)));
    }
    const p = this.world.player;
    if (p) {
      c.x = (p.prevPx + (p.px - p.prevPx) * alpha) / 256;
      c.y = (p.prevPy + (p.py - p.prevPy) * alpha) / 256;
    } else if (!this.hud.typing) {
      const speed = (dt / 1000) * 12 / c.zoom;
      const d = this.input.down;
      if (d.has('w')) c.y -= speed;
      if (d.has('s')) c.y += speed;
      if (d.has('a')) c.x -= speed;
      if (d.has('d')) c.x += speed;
    }
  }

  private applyPlayerInput(): void {
    const p = this.world.player;
    if (!p) return;
    const d = this.input.down;
    p.moveX = (d.has('d') ? 1 : 0) - (d.has('a') ? 1 : 0);
    p.moveY = (d.has('s') ? 1 : 0) - (d.has('w') ? 1 : 0);
    p.pickingUp = d.has('f');
  }

  // ------------------------------------------------------------ Eingabe

  mouseWorld(): { x: number; y: number } {
    return this.renderer.screenToWorld(this.input.mouseX, this.input.mouseY);
  }

  private handleInput(): void {
    const inp = this.input;
    let pressedThisFrame = false;
    for (const ev of inp.takePressed()) {
      if (ev.type === 'key') this.onKey(ev.key, ev.ctrl, ev.shift);
      else if (ev.button === 0) {
        const w = this.renderer.screenToWorld(ev.x, ev.y);
        this.clickMods = { ctrl: ev.ctrl, shift: ev.shift };
        this.onLeftPress(Math.floor(w.x), Math.floor(w.y), w);
        pressedThisFrame = true;
      }
    }
    const m = this.mouseWorld();
    const tx = Math.floor(m.x);
    const ty = Math.floor(m.y);
    if (!inp.overCanvas) {
      this.dragLast = null;
      if (this.world.player) this.world.player.setMineTarget(null);
      return;
    }
    // Ziehen mit gedrückter linker Taste
    if (!pressedThisFrame && inp.left && this.dragLast) this.onDrag(tx, ty);
    if (!inp.left) {
      this.dragLast = null;
      this.dragBelts = [];
    }
    // Rechtsklick halten: abbauen
    const p = this.world.player;
    if (inp.right) {
      const e = this.world.entityAt(tx, ty);
      if (this.creative && !p) {
        if (e) {
          this.pushHistory({ type: 'remove', name: e.name, x: e.x, y: e.y, dir: e.dir });
          this.world.remove(e.id);
        }
      } else if (p) {
        if (e) p.setMineTarget({ kind: 'entity', id: e.id });
        else if (this.world.map.resourceAt(tx, ty).amount > 0) p.setMineTarget({ kind: 'resource', x: tx, y: ty });
        else p.setMineTarget(null);
      }
    } else if (p && p.mineTarget) p.setMineTarget(null);
  }

  private onKey(k: string, ctrl: boolean, shift: boolean): void {
    if (this.hud.typing) return;
    if (ctrl && k === 's') { void this.hud.saveGame(); return; }
    if (ctrl && k === 'z') { this.undo(); return; }
    if (ctrl && k === 'l') { void this.hud.loadGame(); return; }
    switch (k) {
      case 'r': {
        const m = this.mouseWorld();
        const e = this.world.entityAt(m.x, m.y);
        const rev = shift;
        if (!this.cursorItem && e && entityDef(e.name).rotatable) {
          this.world.rotate(e.id, rotCW(e.dir, rev ? 3 : 1));
        } else this.buildDir = rotCW(this.buildDir, rev ? 3 : 1);
        break;
      }
      case 'q': this.pipette(); break;
      case 'e': this.hud.toggleInventory(); break;
      case 'escape':
        if (!this.hud.closeWindows()) {
          if (this.cursorItem) this.cursorItem = null;
          else this.hud.toggleMenu();
        }
        break;
      case 'alt': this.alt = !this.alt; break;
      case 'f3': this.hud.toggleDebug(); break;
      case 'p': if (this.debug) this.paused = !this.paused; break;
      case 'h': this.hud.toggleHelp(); break;
      case 'z':
        // Z: ein Item ablegen (mit Spieler); im Sandkasten Debug-Erz
        if (this.world.player && this.cursorItem) {
          const m = this.mouseWorld();
          this.world.player.dropItem(this.world, this.cursorItem, m.x, m.y);
        } else if (this.debug) this.debugItem('iron-ore');
        break;
      case 'x': case 'c': case 'v':
        if (this.debug) this.debugItem({ x: 'coal', c: 'stone', v: 'iron-plate' }[k]);
        break;
      default:
        if (/^[0-9]$/.test(k)) {
          const slot = k === '0' ? 9 : Number(k) - 1;
          this.selectQuickbar(slot);
        }
    }
  }

  selectQuickbar(slot: number): void {
    const item = this.quickbar()[slot];
    this.cursorItem = this.cursorItem === item ? null : item;
  }

  quickbar(): (string | null)[] {
    if (this.world.player) return this.world.player.quickbar;
    return CREATIVE_QUICKBAR;
  }

  private pipette(): void {
    if (this.cursorItem) {
      this.cursorItem = null;
      return;
    }
    const m = this.mouseWorld();
    const e = this.world.entityAt(m.x, m.y);
    if (!e) return;
    const item = entityDef(e.name).item;
    if (this.creative || (this.world.player && this.world.player.inventory.count(item) > 0)) {
      this.cursorItem = item;
      this.buildDir = e.dir;
    }
  }

  private debugItem(item: string): void {
    const m = this.mouseWorld();
    const tx = Math.floor(m.x);
    const ty = Math.floor(m.y);
    const t = this.world.belts.tileAt(tx, ty);
    if (t) this.world.belts.insertAtPoint(t, m.x - tx, m.y - ty, itemIndex(item));
  }

  /** Strg+Klick ohne Cursor-Item: Ausgabe/Inhalt eines Gebäudes ins Inventar holen. */
  private takeAllFrom(e: Entity): void {
    const p = this.world.player;
    if (!p) return;
    const invs = e.kind === 'furnace' ? [e.result] : [];
    for (const inv of invs) {
      for (let i = 0; i < inv.slots.length; i++) {
        const st = inv.slots[i];
        if (!st) continue;
        const n = p.inventory.add(st.item, st.count);
        st.count -= n;
        if (st.count === 0) inv.slots[i] = null;
      }
    }
  }

  /** Platzierungsposition des Geisterbilds für den Cursor. */
  ghost(): Ghost | null {
    if (!this.input.overCanvas) return null;
    return this.ghostAt(this.mouseWorld());
  }

  private ghostAt(m: { x: number; y: number }): Ghost | null {
    const item = this.cursorItem;
    if (!item) return null;
    const place = ITEMS[item]?.placeResult;
    if (!place) return null;
    if (!this.creative && (this.world.player?.inventory.count(item) ?? 0) < 1) return null;
    const def = entityDef(place);
    const x = Math.round(m.x - def.width / 2);
    const y = Math.round(m.y - def.height / 2);
    const chk = this.world.canPlace(place, x, y, this.buildDir);
    let ok = chk.ok;
    const p = this.world.player;
    if (p && !this.creative && p.distanceTo(x + def.width / 2, y + def.height / 2) > PLAYER.buildDistance) ok = false;
    return { name: place, x, y, dir: this.buildDir, ok };
  }

  private tryBuild(g: Ghost): Entity | null {
    if (!g.ok) return null;
    const item = entityDef(g.name).item;
    const chk = this.world.canPlace(g.name, g.x, g.y, g.dir);
    const e = this.world.place(g.name, g.x, g.y, g.dir);
    if (e && chk.replace === undefined) {
      if (!this.creative) this.world.player?.inventory.remove(item, 1);
      this.pushHistory({ type: 'build', id: e.id, name: g.name, x: g.x, y: g.y, dir: g.dir });
    }
    return e;
  }

  private clickMods = { ctrl: false, shift: false };

  private onLeftPress(tx: number, ty: number, at: { x: number; y: number }): void {
    const p = this.world.player;
    const target = this.world.entityAt(tx, ty);
    const item = this.cursorItem;
    const placeable = item ? ITEMS[item]?.placeResult : undefined;
    const ctrl = this.clickMods.ctrl;
    if (item && !placeable) {
      // Item in Gebäude legen (Brennstoff, Erz); Strg: ganzer Vorrat
      if (target && p) {
        const have = p.inventory.count(item);
        const amount = ctrl ? have : Math.min(have, 1);
        const n = insertInto(target, item, amount, 'player');
        p.inventory.remove(item, n);
      }
      return;
    }
    if (!item) {
      if (target && ctrl && p) this.takeAllFrom(target);
      else if (target && target.kind !== 'belt') this.hud.openEntity(target.id);
      return;
    }
    const g = this.ghostAt(at);
    if (!g) return;
    if (!g.ok && target && target.kind !== 'belt' && entityDef(g.name).kind !== 'belt') {
      this.hud.openEntity(target.id);
      return;
    }
    const e = this.tryBuild(g);
    this.dragLast = { x: tx, y: ty };
    this.dragStart = { x: tx, y: ty };
    this.dragAxis = null;
    this.dragBelts = e && e.kind === 'belt' ? [e.id] : [];
  }

  private onDrag(tx: number, ty: number): void {
    const last = this.dragLast!;
    // Umschalt: Linie auf die zuerst gezogene Achse festlegen
    if (this.input.shift && this.dragStart) {
      if (!this.dragAxis && (tx !== this.dragStart.x || ty !== this.dragStart.y)) {
        this.dragAxis = Math.abs(tx - this.dragStart.x) >= Math.abs(ty - this.dragStart.y) ? 'x' : 'y';
      }
      if (this.dragAxis === 'x') ty = this.dragStart.y;
      if (this.dragAxis === 'y') tx = this.dragStart.x;
    }
    if (last.x === tx && last.y === ty) return;
    const item = this.cursorItem;
    const place = item ? ITEMS[item]?.placeResult : undefined;
    if (!place) return;
    const def = entityDef(place);
    // Schrittweise entlang der Mausbewegung (4er-Nachbarschaft)
    let x = last.x;
    let y = last.y;
    let guard = 0;
    while ((x !== tx || y !== ty) && guard++ < 64) {
      const dx = Math.sign(tx - x);
      const dy = Math.sign(ty - y);
      const stepX = Math.abs(tx - x) >= Math.abs(ty - y);
      const nx = stepX ? x + dx : x;
      const ny = stepX ? y : y + dy;
      if (def.kind === 'belt') {
        const dir = dirFromDelta(nx - x, ny - y)!;
        this.buildDir = dir;
        // vorheriges Band in Zugrichtung drehen
        const prevId = this.dragBelts[this.dragBelts.length - 1];
        const prev = prevId !== undefined ? this.world.entities.get(prevId) : undefined;
        if (prev && prev.dir !== dir && prev.x === x && prev.y === y) this.world.rotate(prev.id, dir);
        const g: Ghost = { name: place, x: nx, y: ny, dir, ok: true };
        g.ok = this.ghostOk(g);
        const e = this.tryBuild(g);
        if (e) this.dragBelts.push(e.id);
        else {
          const ex = this.world.entityAt(nx, ny);
          if (ex && ex.kind === 'belt') this.dragBelts.push(ex.id);
        }
      } else {
        const g: Ghost = { name: place, x: nx - Math.floor((def.width - 1) / 2), y: ny - Math.floor((def.height - 1) / 2), dir: this.buildDir, ok: true };
        g.ok = this.ghostOk(g);
        this.tryBuild(g);
      }
      x = nx;
      y = ny;
    }
    this.dragLast = { x: tx, y: ty };
  }

  private ghostOk(g: Ghost): boolean {
    const def = entityDef(g.name);
    if (!this.creative) {
      const p = this.world.player;
      if (!p || p.inventory.count(def.item) < 1) return false;
      if (p.distanceTo(g.x + def.width / 2, g.y + def.height / 2) > PLAYER.buildDistance) return false;
    }
    return this.world.canPlace(g.name, g.x, g.y, g.dir).ok;
  }

  private buildUi(): RenderUi {
    const ghost = this.ghost();
    const m = this.mouseWorld();
    let hover: RenderUi['hover'] = null;
    let mining = 0;
    if (!ghost && this.input.overCanvas) {
      const e = this.world.entityAt(m.x, m.y);
      if (e) {
        const d = entityDef(e.name);
        hover = { x: e.x, y: e.y, w: d.width, h: d.height };
      } else {
        const tx = Math.floor(m.x);
        const ty = Math.floor(m.y);
        if (this.world.map.resourceAt(tx, ty).amount > 0) hover = { x: tx, y: ty, w: 1, h: 1 };
      }
      const p = this.world.player;
      if (p && p.mineTarget && p.mineTotal > 0) mining = p.mineProgress / p.mineTotal;
    }
    return { ghost, alt: this.alt, hover, mining };
  }

  private pushHistory(h: HistoryEntry): void {
    this.history.push(h);
    if (this.history.length > 100) this.history.shift();
  }

  /** Letzte Bau- oder Abbauaktion zurücknehmen. */
  undo(): void {
    const h = this.history.pop();
    if (!h) return;
    const p = this.world.player;
    if (h.type === 'build') {
      const e = this.world.entities.get(h.id);
      if (!e || e.name !== h.name) return;
      if (p && !this.creative) p.pickUpEntity(this.world, h.id);
      else this.world.remove(h.id);
    } else {
      const item = entityDef(h.name).item;
      if (p && !this.creative && p.inventory.count(item) < 1) {
        p.note('Kein Gebäude im Inventar');
        return;
      }
      const e = this.world.place(h.name, h.x, h.y, h.dir);
      if (e && p && !this.creative) p.inventory.remove(item, 1);
    }
  }

  /** Text für die Hover-Info im HUD. */
  hoverInfo(): string {
    const m = this.mouseWorld();
    const e = this.world.entityAt(m.x, m.y);
    if (e) return entityDef(e.name).name;
    const r = this.world.map.resourceAt(Math.floor(m.x), Math.floor(m.y));
    if (r.amount > 0) return `${RESOURCE_BY_INDEX[r.res]!.name}: ${r.amount}`;
    return '';
  }
}

const CREATIVE_QUICKBAR: (string | null)[] = [
  'transport-belt', 'burner-inserter', 'burner-mining-drill', 'stone-furnace', null, null, null, null, null, null,
];
