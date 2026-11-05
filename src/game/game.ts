import { entityDef, sizeOf } from '../data/entities';
import { ITEMS } from '../data/items';
import { RESOURCE_BY_INDEX } from '../data/resources';
import type { SpriteLib } from '../render/assets';
import { type Ghost, GameRenderer, type RenderUi } from '../render/renderer';
import { type Dir, dirFromDelta, rotCW } from '../sim/geom';
import { MAPGEN } from '../data/mapgen';
import { type Blueprint, placed as bpPlaced, capture as bpCapture, rotate as bpRotate } from '../sim/blueprint';
import { CircuitSystem } from '../sim/circuit';
import { type Entity, insertInto, itemIndex } from '../sim/machines';
import type { Tree } from '../sim/trees';
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
  /** Drahtwerkzeug (G): Farbe und erster gewählter Anschluss. */
  wireTool: 'red' | 'green' | null = null;
  /** Gleisform beim Bauen (R): 0/1 gerade senkrecht/waagerecht, 2–5 Bögen. */
  railShape = 0;
  wireFrom: { id: number; side: 0 | 1 } | null = null;
  /** Blaupause im Cursor (Strg+V, Bibliothek); Klick legt Geister ab. */
  cursorBlueprint: Blueprint | null = null;
  /** Zuletzt kopierte Blaupause (Strg+C). */
  clipboard: Blueprint | null = null;
  /** Auswahlrechteck beim Kopieren (Strg+C, dann ziehen). */
  private selecting: { x0: number; y0: number; x1: number; y1: number; active: boolean; cut: boolean } | null = null;
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
    this.hud.setTitle(scene.world.player?.god ? `${scene.title} · GOTTMODUS` : scene.title);
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
    this.lastAutosaveTick = world.tick;
    this.hud.setTitle(creative ? 'Sandkasten' : `Freies Spiel${world.player?.god ? ' · GOTTMODUS' : ''} · Karte ${world.seed}`);
    if (world.player) {
      this.renderer.camera.x = world.player.px / 256;
      this.renderer.camera.y = world.player.py / 256;
    }
    this.hud.refreshAll();
  }

  start(): void {
    this.renderer.app.ticker.add((t) => this.frame(t.deltaMS));
    // Beim Verlassen oder Verstecken der Seite automatisch speichern (Tab schließen, App wechseln)
    const autosave = () => {
      if (!this.creative && this.world.player && this.world.tick > this.lastAutosaveTick + 60) {
        this.lastAutosaveTick = this.world.tick;
        void this.hud.saveGame('autosave', true);
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') autosave();
    });
    window.addEventListener('pagehide', autosave);
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
    // Leertaste: auf den nächsten Gegner in Reichweite schießen (wie im Original)
    p.shooting = d.has(' ') || d.has('space');
  }

  // ------------------------------------------------------------ Eingabe

  mouseWorld(): { x: number; y: number } {
    return this.renderer.screenToWorld(this.input.mouseX, this.input.mouseY);
  }

  private handleInput(): void {
    const inp = this.input;
    if (this.cursorItem && (this.cursorBlueprint || this.selecting || this.wireTool)) {
      this.cursorBlueprint = null;
      this.selecting = null;
      this.wireTool = null;
      this.wireFrom = null;
    }
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
      // Zeiger kurz über dem HUD: laufenden Abbau bei gehaltener Taste nicht abbrechen
      if (this.world.player && !inp.right) this.world.player.setMineTarget(null);
      return;
    }
    // Ziehen mit gedrückter linker Taste
    if (!pressedThisFrame && inp.left && this.dragLast) this.onDrag(tx, ty);
    if (this.selecting?.active) {
      this.selecting.x1 = tx;
      this.selecting.y1 = ty;
      if (!inp.left) this.finishCopy();
    }
    if (!inp.left) {
      this.dragLast = null;
      this.dragBelts = [];
      if (this.world.player) this.world.player.repairTarget = null;
    }
    // Rechtsklick halten: abbauen
    const p = this.world.player;
    if (inp.right) {
      const e = this.world.entityAt(tx, ty);
      const veh = !e || e.kind === 'rail' ? this.world.trains.vehicleAt(m.x, m.y) : null;
      if (veh && this.input.rightPressed) {
        const items = this.world.trains.remove(veh.vehicle.id);
        if (p && !this.creative) for (const it of items) p.inventory.add(it.item, it.count);
        return;
      }
      if (veh) return;
      const gh = e ? undefined : this.world.ghosts.at(tx, ty);
      if (gh) {
        this.world.ghosts.remove(gh.id);
        return;
      }
      if (this.creative && !p) {
        if (e) {
          this.pushHistory({ type: 'remove', name: e.name, x: e.x, y: e.y, dir: e.dir });
          this.world.remove(e.id);
        }
      } else if (p) {
        const tree = e ? undefined : this.treeNear(m.x, m.y);
        if (e) p.setMineTarget({ kind: 'entity', id: e.id });
        else if (tree) p.setMineTarget({ kind: 'tree', cx: tree.cx, cy: tree.cy, i: tree.i, x: tree.x, y: tree.y });
        else {
          const r = this.world.map.resourceAt(tx, ty);
          if (r.amount > 0 && !RESOURCE_BY_INDEX[r.res]?.fluid) p.setMineTarget({ kind: 'resource', x: tx, y: ty, res: r.res });
          // leeres Feld unter dem Zeiger: bisheriges Ziel weiter abbauen, solange die Taste gehalten wird
          else if (this.input.rightPressed) p.setMineTarget(null);
        }
      }
    } else if (p && p.mineTarget) p.setMineTarget(null);
  }

  private onKey(k: string, ctrl: boolean, shift: boolean): void {
    if (this.hud.typing) return;
    if (ctrl && k === 's') { void this.hud.saveGame(); return; }
    if (ctrl && k === 'z') { this.undo(); return; }
    if (ctrl && k === 'l') { void this.hud.loadGame(); return; }
    if (ctrl && (k === 'c' || k === 'x')) {
      this.cursorItem = null;
      this.cursorBlueprint = null;
      this.selecting = { x0: 0, y0: 0, x1: 0, y1: 0, active: false, cut: k === 'x' };
      this.world.player?.note(k === 'x' ? 'Ausschneiden: Bereich aufziehen (Bauroboter reißen ab)' : 'Kopieren: Bereich mit gedrückter Maustaste aufziehen');
      return;
    }
    if (ctrl && k === 'v') {
      if (this.clipboard) this.setBlueprint(this.clipboard);
      return;
    }
    if (k === 'b') { this.hud.toggleBlueprints(); return; }
    if (k === 'g') {
      this.cursorItem = null;
      this.cursorBlueprint = null;
      this.wireTool = this.wireTool === null ? 'red' : this.wireTool === 'red' ? 'green' : null;
      this.wireFrom = null;
      this.world.player?.note(this.wireTool ? `${this.wireTool === 'red' ? 'Roter' : 'Grüner'} Draht: zwei Gebäude nacheinander anklicken (G wechselt)` : 'Draht weggelegt');
      return;
    }
    if (k === 'escape' && this.wireTool) {
      this.wireTool = null;
      this.wireFrom = null;
      return;
    }
    if (this.cursorBlueprint && k === 'r') { this.cursorBlueprint = bpRotate(this.cursorBlueprint); return; }
    if (k === 'escape' && (this.cursorBlueprint || this.selecting)) {
      this.cursorBlueprint = null;
      this.selecting = null;
      return;
    }
    if (k === 'q' && (this.cursorBlueprint || this.selecting)) {
      this.cursorBlueprint = null;
      this.selecting = null;
      return;
    }
    switch (k) {
      case 'r': {
        const m = this.mouseWorld();
        const e = this.world.entityAt(m.x, m.y);
        const rev = shift;
        if (this.cursorItem === 'rail') this.railShape = (this.railShape + (rev ? 5 : 1)) % 6;
        else if (!this.cursorItem && e && entityDef(e.name).rotatable) {
          this.world.rotate(e.id, rotCW(e.dir, rev ? 3 : 1));
        } else this.buildDir = rotCW(this.buildDir, rev ? 3 : 1);
        break;
      }
      case 'q': this.pipette(); break;
      case 'e': this.hud.toggleInventory(); break;
      case 't': this.hud.toggleResearch(); break;
      case 'm': this.hud.minimap.toggle(); break;
      case 'escape':
        if (!this.hud.closeWindows()) {
          if (this.cursorItem) this.cursorItem = null;
          else this.hud.toggleMenu();
        }
        break;
      case 'alt': this.alt = !this.alt; break;
      case 'f3': this.hud.toggleDebug(); break;
      case 'p': this.hud.toggleStats(); break;
      case 'f4': if (this.debug) this.paused = !this.paused; break;
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

  /** Baum unter dem Mauszeiger: Stamm oder Krone (die Krone liegt im Bild über dem Stamm). */
  treeNear(x: number, y: number): Tree | undefined {
    let best: Tree | undefined;
    let bd = Infinity;
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = this.world.map.trees.treeAt(Math.floor(x) + dx, Math.floor(y) + dy);
        if (!t) continue;
        // Abstand zur Bildmitte des Baums (etwa 1,2 Felder über dem Stammfuß)
        const d = (t.x - x) ** 2 + (t.y - 1.2 - y) ** 2;
        if (d < bd && d < 2.2) {
          bd = d;
          best = t;
        }
      }
    }
    return best;
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
    let place = ITEMS[item]?.placeResult;
    if (!place) return null;
    let dir = this.buildDir;
    if (item === 'rail') {
      place = this.railShape < 2 ? 'straight-rail' : 'curved-rail';
      dir = (this.railShape < 2 ? this.railShape : this.railShape - 2) as Dir;
    }
    const def = entityDef(place);
    if (!this.creative && (this.world.player?.inventory.count(item) ?? 0) < (def.itemCount ?? 1)) return null;
    const [w, h] = sizeOf(def, dir);
    let x = Math.round(m.x - w / 2);
    let y = Math.round(m.y - h / 2);
    // Gleise und Bahnhöfe liegen auf dem 2-Felder-Raster
    if (def.kind === 'rail' || def.kind === 'train-stop') {
      x = Math.round((m.x - w / 2) / 2) * 2;
      y = Math.round((m.y - h / 2) / 2) * 2;
    }
    const chk = this.world.canPlace(place, x, y, dir);
    let ok = chk.ok;
    const p = this.world.player;
    if (p && !this.creative && p.distanceTo(x + w / 2, y + h / 2) > (p.buildDistance)) ok = false;
    return { name: place, x, y, dir, ok };
  }

  private tryBuild(g: Ghost): Entity | null {
    if (!g.ok) return null;
    const item = entityDef(g.name).item;
    const chk = this.world.canPlace(g.name, g.x, g.y, g.dir);
    const e = this.world.place(g.name, g.x, g.y, g.dir);
    if (e && chk.replace === undefined) {
      if (!this.creative) this.world.player?.inventory.remove(item, entityDef(g.name).itemCount ?? 1);
      this.pushHistory({ type: 'build', id: e.id, name: g.name, x: g.x, y: g.y, dir: g.dir });
    }
    return e;
  }

  private clickMods = { ctrl: false, shift: false };

  /** Blaupause in den Cursor nehmen. */
  setBlueprint(bp: Blueprint): void {
    this.cursorItem = null;
    this.selecting = null;
    this.cursorBlueprint = bp;
  }

  /** Linke obere Ecke der Cursor-Blaupause (mittig unter der Maus). */
  private blueprintOrigin(): { x: number; y: number } {
    const bp = this.cursorBlueprint!;
    const m = this.mouseWorld();
    return { x: Math.round(m.x - bp.w / 2), y: Math.round(m.y - bp.h / 2) };
  }

  private finishCopy(): void {
    const s = this.selecting!;
    this.selecting = null;
    const bp = bpCapture(this.world, s.x0, s.y0, s.x1, s.y1);
    if (!bp) {
      this.world.player?.note('Keine Gebäude im Bereich');
      return;
    }
    this.clipboard = bp;
    if (s.cut) {
      // Ausschneiden: alle Gebäude im Bereich zum Abriss markieren (Bauroboter)
      for (let y = Math.min(s.y0, s.y1); y <= Math.max(s.y0, s.y1); y++) {
        for (let x = Math.min(s.x0, s.x1); x <= Math.max(s.x0, s.x1); x++) {
          const e = this.world.entityAt(x, y);
          if (e) this.world.robots.marked.add(e.id);
        }
      }
    }
    this.setBlueprint(bp);
    this.hud.rememberClipboard(bp);
  }

  /** Geist von Hand bauen: passendes Item aus dem Inventar an Ort und Richtung des Geists. */
  private buildGhost(tx: number, ty: number): boolean {
    const gh = this.world.ghosts.at(tx, ty);
    if (!gh) return false;
    const item = entityDef(gh.name).item;
    const p = this.world.player;
    if (!this.creative && (!p || p.inventory.count(item) < 1)) {
      p?.note(`${ITEMS[item]?.name ?? item} fehlt im Inventar`);
      return true;
    }
    const g: Ghost = { name: gh.name, x: gh.x, y: gh.y, dir: gh.dir, ok: true };
    g.ok = this.ghostOk(g);
    if (!g.ok) {
      const chk = this.world.canPlace(gh.name, gh.x, gh.y, gh.dir);
      p?.note(chk.reason ?? 'Außer Reichweite');
      return true;
    }
    this.tryBuild(g);
    return true;
  }

  /** Anschluss unter der Maus: bei 1×2-Kombinatoren entscheidet das Feld (vorn = Ausgang). */
  private wirePointAt(tx: number, ty: number): { id: number; side: 0 | 1 } | null {
    const e = this.world.entityAt(tx, ty);
    if (!e) return null;
    if (e.kind === 'combinator' && e.def.height === 2) {
      const front = CircuitSystem.pointPos(e, 1);
      return { id: e.id, side: Math.floor(front.x) === tx && Math.floor(front.y) === ty ? 1 : 0 };
    }
    return { id: e.id, side: 0 };
  }

  private onLeftPress(tx: number, ty: number, at: { x: number; y: number }): void {
    if (this.wireTool) {
      const pt = this.wirePointAt(tx, ty);
      if (!pt) return;
      if (!this.wireFrom) {
        this.wireFrom = pt;
        return;
      }
      const r = this.world.circuit.toggle(this.world, this.wireFrom, pt, this.wireTool);
      if (r === 'far') this.world.player?.note('Zu weit für einen Draht');
      this.wireFrom = r === 'far' || r === 'invalid' ? this.wireFrom : pt;
      return;
    }
    if (this.selecting) {
      this.selecting = { ...this.selecting, x0: tx, y0: ty, x1: tx, y1: ty, active: true };
      return;
    }
    if (this.cursorBlueprint) {
      const o = this.blueprintOrigin();
      const n = this.world.ghosts.placeBlueprint(this.world, this.cursorBlueprint, o.x, o.y);
      if (!n) this.world.player?.note('Kein Platz für die Blaupause');
      return;
    }
    const p = this.world.player;
    const target = this.world.entityAt(tx, ty);
    const item = this.cursorItem;
    const placeable = item ? ITEMS[item]?.placeResult : undefined;
    const ctrl = this.clickMods.ctrl;
    if (item === 'repair-pack') {
      if (p && target && target.hp < target.def.health) p.repairTarget = target.id;
      else if (p && target) p.note('Nicht beschädigt');
      return;
    }
    if (item === 'landfill') {
      this.placeLandfill(tx, ty);
      this.dragLast = { x: tx, y: ty };
      return;
    }
    if (item === 'locomotive' || item === 'cargo-wagon') {
      if (!this.creative && (!p || p.inventory.count(item) < 1)) return;
      const v = DIR_VEC[this.buildDir];
      if (this.world.trains.place(this.world, item, at.x, at.y, v[0], v[1])) {
        if (!this.creative) p?.inventory.remove(item, 1);
      } else p?.note('Fahrzeuge nur auf ein Gleis stellen');
      return;
    }
    if (!item) {
      const veh = this.world.trains.vehicleAt(at.x, at.y);
      if (veh && (!target || target.kind === 'rail')) {
        this.hud.openTrain(veh.train.id, veh.vehicle.id);
        return;
      }
    }
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
      if (!target && this.buildGhost(tx, ty)) return;
      if (target && ctrl && p) this.takeAllFrom(target);
      else if (target && hasWindow(target)) this.hud.openEntity(target.id);
      return;
    }
    const g = this.ghostAt(at);
    if (!g) return;
    if (!g.ok && target && hasWindow(target) && entityDef(g.name).kind !== 'belt') {
      this.hud.openEntity(target.id);
      return;
    }
    const e = this.tryBuild(g);
    this.dragLast = { x: tx, y: ty };
    this.dragStart = { x: tx, y: ty };
    this.dragAxis = null;
    this.dragBelts = e && e.kind === 'belt' ? [e.id] : [];
  }

  /** Landaufschüttung auf ein Wasserfeld (verbraucht 1 Stück, außer im Sandkasten). */
  private placeLandfill(tx: number, ty: number): void {
    const p = this.world.player;
    if (p && !this.creative) {
      if (p.inventory.count('landfill') < 1) return;
      if (!p.canReach(tx + 0.5, ty + 0.5)) {
        p.note('Außer Reichweite');
        return;
      }
    }
    if (this.world.landfill(tx, ty) && p && !this.creative) p.inventory.remove('landfill', 1);
  }

  private onDrag(tx: number, ty: number): void {
    if (this.cursorItem === 'landfill') {
      this.placeLandfill(tx, ty);
      this.dragLast = { x: tx, y: ty };
      return;
    }
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
    if (def.kind === 'rail' || def.kind === 'train-stop') {
      // Gleise: an der Mausposition auf dem Raster bauen
      const g = this.ghostAt(this.mouseWorld());
      if (g?.ok) this.tryBuild(g);
      this.dragLast = { x: tx, y: ty };
      return;
    }
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
        const [w, h] = sizeOf(def, this.buildDir);
        const g: Ghost = { name: place, x: nx - Math.floor((w - 1) / 2), y: ny - Math.floor((h - 1) / 2), dir: this.buildDir, ok: true };
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
      const [w, h] = sizeOf(def, g.dir);
      if (p.distanceTo(g.x + w / 2, g.y + h / 2) > (p.buildDistance)) return false;
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
        hover = { x: e.x, y: e.y, w: e.w, h: e.h };
      } else {
        const tx = Math.floor(m.x);
        const ty = Math.floor(m.y);
        if (this.world.map.resourceAt(tx, ty).amount > 0) hover = { x: tx, y: ty, w: 1, h: 1 };
      }
      const p = this.world.player;
      if (p && p.mineTarget && p.mineTotal > 0) mining = p.mineProgress / p.mineTotal;
    }
    const ghosts: Ghost[] = [];
    if (this.cursorBlueprint && this.input.overCanvas) {
      const o = this.blueprintOrigin();
      for (const e of bpPlaced(this.cursorBlueprint, o.x, o.y)) {
        ghosts.push({ name: e.name, x: e.x, y: e.y, dir: e.dir, ok: this.world.ghosts.canPlace(this.world, e.name, e.x, e.y, e.dir) });
      }
    }
    const sel = this.selecting?.active ? this.selecting : null;
    // Hangarbereiche: Hangar oder Logistikkiste im Cursor bzw. unter der Maus
    const under = this.input.overCanvas ? this.world.entityAt(m.x, m.y) : undefined;
    const showAreas = /roboport|provider-chest|storage-chest|requester-chest|buffer-chest/.test(this.cursorItem ?? '')
      || under?.kind === 'roboport' || (under?.kind === 'container' && !!under.logistic);
    let wire: RenderUi['wire'] = null;
    if (this.wireTool) {
      const from = this.wireFrom ? this.world.entities.get(this.wireFrom.id) : undefined;
      const p = from ? CircuitSystem.pointPos(from, this.wireFrom!.side) : null;
      wire = { color: this.wireTool, from: p, to: m };
    }
    return {
      ghost, ghosts, alt: this.alt, hover, mining, robotAreas: showAreas, wire,
      selection: sel ? { x0: Math.min(sel.x0, sel.x1), y0: Math.min(sel.y0, sel.y1), x1: Math.max(sel.x0, sel.x1) + 1, y1: Math.max(sel.y0, sel.y1) + 1, cut: sel.cut } : null,
    };
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
    const tree = this.treeNear(m.x, m.y);
    if (tree) {
      const k = MAPGEN.trees.kinds[tree.kind];
      return `${k.id === 'dead' ? 'Abgestorbener Baum' : 'Baum'} – ${k.wood} Holz (Rechtsklick halten)`;
    }
    const r = this.world.map.resourceAt(Math.floor(m.x), Math.floor(m.y));
    if (r.amount > 0) {
      const def = RESOURCE_BY_INDEX[r.res]!;
      return def.fluid ? `${def.name}: ${(r.amount / 1000).toFixed(1)} % Ergiebigkeit` : `${def.name}: ${r.amount}`;
    }
    return '';
  }
}

const CREATIVE_QUICKBAR: (string | null)[] = [
  'transport-belt', 'burner-inserter', 'burner-mining-drill', 'stone-furnace', null, null, null, null, null, null,
];

/** Gebäude mit eigenem Fenster (Bänder, Rohre, Masten haben keins). */
const DIR_VEC: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function hasWindow(e: Entity): boolean {
  return e.guiSlots().length > 0 || e.kind === 'train-stop' || e.kind === 'combinator' || e.kind === 'inserter' || e.kind === 'lamp' || e.kind === 'pump' || e.kind === 'assembler' || e.kind === 'lab' || e.kind === 'splitter' || e.kind === 'solar' || e.kind === 'accumulator' || e.kind === 'pole';
}
