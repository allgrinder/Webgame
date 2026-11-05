import { entityDef } from '../data/entities';
import { ITEMS } from '../data/items';
import { RECIPE_LIST } from '../data/recipes';
import { TECHS, TECH_BY_ID } from '../data/tech';
import type { Game } from '../game/game';
import { deleteSave, listSaves, loadWorld, saveWorld } from '../game/save';
import { deserializeWorld, serializeWorld } from '../sim/serialize';
import type { SpriteLib } from '../render/assets';
import { Status } from '../sim/entity';
import { type Entity, acceptAmount, insertInto, itemId, itemIndex } from '../sim/machines';
import type { Inventory } from '../sim/inventory';
import { Minimap } from './minimap';
import { Tooltip } from './tooltip';

const STATUS_TEXT: Record<Status, string> = {
  [Status.Idle]: 'Leerlauf',
  [Status.Working]: 'Arbeitet',
  [Status.NoFuel]: 'Kein Brennstoff',
  [Status.OutputBlocked]: 'Ausgabe blockiert',
  [Status.NoInput]: 'Keine Zutaten',
  [Status.Depleted]: 'Ressourcen erschöpft',
  [Status.NoTarget]: 'Kein Ziel',
  [Status.NoPower]: 'Kein Strom',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
}

/** Schlankes DOM-Overlay für Schnellleiste, Inventar, Handwerk und Gebäudefenster. */
export class Hud {
  private readonly layer: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly debugBox: HTMLDivElement;
  private readonly quickbar: HTMLDivElement;
  private readonly cursorEl: HTMLDivElement;
  private readonly hoverEl: HTMLDivElement;
  private readonly msgEl: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private readonly invWin: HTMLDivElement;
  private readonly entWin: HTMLDivElement;
  private readonly menu: HTMLDivElement;
  private readonly techWin: HTMLDivElement;
  readonly tip: Tooltip;
  readonly minimap: Minimap;
  private readonly researchEl: HTMLDivElement;
  private readonly craftQueueEl: HTMLDivElement;
  private openEntityId: number | null = null;
  private showDebug = false;
  private frame = 0;
  typing = false;
  private title = '';

  constructor(root: HTMLElement, private readonly game: Game, private readonly sprites: SpriteLib) {
    this.layer = el('div', 'hud', root);
    this.info = el('div', 'hud-info', this.layer);
    this.debugBox = el('div', 'hud-debug', this.layer);
    this.quickbar = el('div', 'quickbar', this.layer);
    this.craftQueueEl = el('div', 'craft-queue', this.layer);
    this.cursorEl = el('div', 'cursor-item', this.layer);
    this.hoverEl = el('div', 'hover-info', this.layer);
    this.msgEl = el('div', 'messages', this.layer);
    this.help = el('div', 'window help hidden', this.layer);
    const row = el('div', 'window-row', this.layer);
    this.invWin = el('div', 'window inventory hidden', row);
    this.entWin = el('div', 'window entity hidden', row);
    this.menu = el('div', 'window menu hidden', this.layer);
    this.techWin = el('div', 'window tech hidden', this.layer);
    this.researchEl = el('div', 'research-bar', this.layer);
    this.minimap = new Minimap(this.layer, () => game.renderer.biomeField(game.world));
    this.minimap.onPick = (x, y) => {
      if (game.world.player) return; // im freien Spiel folgt die Kamera dem Spieler
      game.renderer.camera.x = x;
      game.renderer.camera.y = y;
    };
    this.tip = new Tooltip(this.layer, (n) => this.sprites.iconUrl(n));
    this.cursorEl.style.transform = 'translate(-100px, -100px)';
    this.buildHelp();
    this.showDebug = game.debug;
    window.addEventListener('pointermove', (e) => {
      this.cursorEl.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    });
    this.refreshAll();
  }

  setTitle(t: string): void {
    this.title = t;
  }

  icon(name: string, cls = 'icon'): HTMLImageElement {
    const img = el('img', cls);
    img.src = this.sprites.iconUrl(name);
    img.draggable = false;
    return img;
  }

  refreshAll(): void {
    this.buildQuickbar();
    if (!this.invWin.classList.contains('hidden')) this.buildInventory();
    if (this.openEntityId !== null) this.buildEntity();
  }

  update(fps: number): void {
    this.frame++;
    const g = this.game;
    const w = g.world;
    {
      const c = g.renderer.camera;
      const pl = w.player;
      const r = g.renderer.screenToWorld(0, 0);
      const r2 = g.renderer.screenToWorld(g.renderer.app.screen.width, g.renderer.app.screen.height);
      this.minimap.update(w, pl ? pl.px / 256 : c.x, pl ? pl.py / 256 : c.y, { x0: r.x, y0: r.y, x1: r2.x, y1: r2.y });
    }
    this.info.textContent = `Eisenwerk – ${this.title} · H: Hilfe`;
    if (this.showDebug) {
      const st = g.renderer.stats;
      this.debugBox.style.display = 'block';
      this.debugBox.textContent =
        `FPS ${fps.toFixed(0)} | Tick ${w.tick} | Bänder ${w.belts.count} | Items ${w.belts.itemCount} | ` +
        `Gezeichnet: Boden ${st.ground}, Deko ${st.decor}, Band ${st.belts}, Items ${st.items}, Gebäude ${st.entities}` +
        (g.paused ? ' | PAUSE' : '');
    } else this.debugBox.style.display = 'none';
    // Cursor-Item
    const ci = g.cursorItem;
    if (ci) {
      const count = g.creative ? '∞' : String(w.player?.inventory.count(ci) ?? 0);
      const key = `${ci}|${count}`;
      if (this.cursorEl.dataset.key !== key) {
        this.cursorEl.dataset.key = key;
        this.cursorEl.replaceChildren(this.icon(`item.${ci}`), Object.assign(el('span'), { textContent: count }));
      }
      this.cursorEl.style.display = 'block';
    } else this.cursorEl.style.display = 'none';
    // Hover
    if (this.frame % 6 === 0) {
      this.hoverEl.textContent = g.hoverInfo();
      this.hoverEl.style.display = this.hoverEl.textContent ? 'block' : 'none';
      this.updateQuickbarCounts();
      this.updateCraftQueue();
      const p = w.player;
      this.updateResearch();
      if (p && p.messages.length) {
        this.msgEl.textContent = p.messages.join(' · ');
        this.msgEl.dataset.t = String(this.frame);
        p.messages.length = 0;
      } else if (Number(this.msgEl.dataset.t ?? 0) + 180 < this.frame) this.msgEl.textContent = '';
    }
    if (this.frame % 10 === 0) {
      if (!this.invWin.classList.contains('hidden')) this.updateInventory();
      if (this.openEntityId !== null) this.buildEntity();
    }
  }

  // ---------------------------------------------------------- Schnellleiste

  private buildQuickbar(): void {
    this.tip.hide();
    this.quickbar.replaceChildren();
    const qb = this.game.quickbar();
    qb.forEach((item, i) => {
      const slot = el('div', 'slot', this.quickbar);
      slot.dataset.slot = String(i);
      const key = el('span', 'key', slot);
      key.textContent = i === 9 ? '0' : String(i + 1);
      if (item) slot.appendChild(this.icon(`item.${item}`));
      el('span', 'count', slot);
      slot.addEventListener('click', () => this.game.selectQuickbar(i));
      if (item) this.tip.attach(slot, () => this.tip.item(item));
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Rechtsklick: Schnellleistenplatz mit Cursor-Item belegen oder leeren
        const p = this.game.world.player;
        if (p) {
          p.quickbar[i] = this.game.cursorItem;
          this.buildQuickbar();
        }
      });
    });
  }

  private updateQuickbarCounts(): void {
    const qb = this.game.quickbar();
    const p = this.game.world.player;
    this.quickbar.querySelectorAll<HTMLDivElement>('.slot').forEach((slot, i) => {
      const item = qb[i];
      const c = slot.querySelector('.count')!;
      c.textContent = item && p && !this.game.creative ? String(p.inventory.count(item)) : '';
      slot.classList.toggle('active', !!item && item === this.game.cursorItem);
      slot.classList.toggle('empty', !!item && !!p && !this.game.creative && p.inventory.count(item) === 0);
    });
  }

  private updateCraftQueue(): void {
    const p = this.game.world.player;
    const q = p?.craftQueue ?? [];
    const key = q.map((j) => `${j.recipe}:${j.toInventory}`).join(',') + (q[0] ? `|${Math.ceil(q[0].ticks / 6)}` : '');
    if (this.craftQueueEl.dataset.key === key) return;
    this.craftQueueEl.dataset.key = key;
    this.craftQueueEl.replaceChildren();
    q.slice(0, 12).forEach((j, i) => {
      const s = el('div', 'slot small', this.craftQueueEl);
      s.appendChild(this.icon(`item.${j.recipe}`));
      if (i === 0) {
        const bar = el('div', 'bar', s);
        const total = Math.round(RECIPE_LIST.find((r) => r.id === j.recipe)!.time * 60);
        bar.style.width = `${100 * (1 - j.ticks / total)}%`;
      }
    });
  }

  // ---------------------------------------------------------- Inventar & Handwerk

  toggleInventory(): void {
    if (!this.game.world.player) return;
    const hidden = this.invWin.classList.toggle('hidden');
    if (!hidden) this.buildInventory();
    else this.closeEntity();
  }

  private invSlots: HTMLDivElement[] = [];
  private recipeEls = new Map<string, HTMLDivElement>();

  private buildInventory(): void {
    const p = this.game.world.player;
    if (!p) return;
    this.tip.hide();
    this.invWin.replaceChildren();
    const head = el('div', 'win-head', this.invWin);
    head.textContent = 'Inventar & Handwerk';
    const close = el('button', 'close', head);
    close.textContent = '×';
    close.onclick = () => this.toggleInventory();
    const body = el('div', 'win-body two', this.invWin);
    const left = el('div', 'col', body);
    const sortBtn = el('button', 'small-btn', left);
    sortBtn.textContent = 'Sortieren';
    sortBtn.onclick = () => { p.inventory.sort(); this.updateInventory(true); };
    const grid = el('div', 'grid inv', left);
    this.invSlots = p.inventory.slots.map((_, i) => {
      const s = el('div', 'slot', grid);
      s.addEventListener('click', (e) => this.onInvSlot(i, e.ctrlKey || e.metaKey, e.shiftKey));
      this.tip.attach(s, () => (s.dataset.item ? this.tip.item(s.dataset.item, Number(s.dataset.count)) : null));
      return s;
    });
    const right = el('div', 'col', body);
    el('div', 'sub-head', right).textContent = 'Handwerk (Klick: 1, Umschalt: 5, Strg: alle)';
    const rgrid = el('div', 'grid recipes', right);
    this.recipeEls.clear();
    const research = this.game.world.research;
    for (const r of RECIPE_LIST) {
      if (r.category !== 'crafting' || !research.recipeUnlocked(r.id)) continue;
      const s = el('div', 'slot recipe', rgrid);
      s.appendChild(this.icon(`item.${r.results[0].item}`));
      el('span', 'count', s);
      s.dataset.recipe = r.id;
      this.tip.attach(s, () => this.tip.recipe(r, 1, p.craftableCount(r.id), (it) => p.inventory.count(it)));
      s.addEventListener('click', (e) => {
        const n = e.ctrlKey || e.metaKey ? 1000 : e.shiftKey ? 5 : 1;
        p.craft(r.id, n);
        this.updateInventory(true);
      });
      this.recipeEls.set(r.id, s);
    }
    const cancel = el('button', 'small-btn', right);
    cancel.textContent = 'Warteschlange abbrechen';
    cancel.onclick = () => { p.cancelCrafting(); this.updateInventory(true); };
    this.updateInventory(true);
  }

  private invKey = '';
  private updateInventory(force = false): void {
    const p = this.game.world.player;
    if (!p) return;
    const key = JSON.stringify(p.inventory.slots) + this.game.cursorItem;
    if (!force && key === this.invKey) return;
    this.invKey = key;
    p.inventory.slots.forEach((st, i) => {
      const s = this.invSlots[i];
      if (!s) return;
      s.replaceChildren();
      if (st) {
        s.appendChild(this.icon(`item.${st.item}`));
        el('span', 'count', s).textContent = String(st.count);
        s.dataset.item = st.item;
        s.dataset.count = String(st.count);
      } else {
        delete s.dataset.item;
      }
      s.classList.toggle('active', !!st && st.item === this.game.cursorItem);
    });
    for (const [id, s] of this.recipeEls) {
      const n = p.craftableCount(id);
      s.classList.toggle('disabled', n === 0);
      s.querySelector('.count')!.textContent = n > 0 ? String(n) : '';
    }
  }

  private onInvSlot(i: number, ctrl: boolean, shift: boolean): void {
    const g = this.game;
    const p = g.world.player;
    if (!p) return;
    const st = p.inventory.slots[i];
    if (!st) {
      g.cursorItem = null;
      return;
    }
    const target = this.openEntityId !== null ? g.world.entities.get(this.openEntityId) : undefined;
    if ((ctrl || shift) && target) {
      // Stapel ins geöffnete Gebäude übertragen
      const amount = ctrl ? st.count : Math.ceil(st.count / 2);
      const n = insertInto(target, st.item, Math.min(amount, st.count), 'player');
      if (n > 0) {
        st.count -= n;
        if (st.count === 0) p.inventory.slots[i] = null;
      }
      this.updateInventory(true);
      this.buildEntity();
      return;
    }
    g.cursorItem = g.cursorItem === st.item ? null : st.item;
    this.updateInventory(true);
  }

  // ---------------------------------------------------------- Gebäudefenster

  openEntity(id: number): void {
    const g = this.game;
    const e = g.world.entities.get(id);
    if (!e) return;
    const p = g.world.player;
    if (p && !g.creative) {
      if (!p.canReach(e.cx, e.cy)) {
        p.note('Außer Reichweite');
        return;
      }
    }
    this.openEntityId = id;
    this.entWin.classList.remove('hidden');
    if (p && this.invWin.classList.contains('hidden')) {
      this.invWin.classList.remove('hidden');
      this.buildInventory();
    }
    this.buildEntity();
  }

  private closeEntity(): void {
    this.openEntityId = null;
    this.entWin.classList.add('hidden');
  }

  private buildEntity(): void {
    const g = this.game;
    const e = this.openEntityId !== null ? g.world.entities.get(this.openEntityId) : undefined;
    if (!e) {
      this.closeEntity();
      return;
    }
    const def = entityDef(e.name);
    const key = this.entityKey(e);
    if (this.entWin.dataset.key === key) return;
    this.entWin.dataset.key = key;
    if (this.entWin.matches(':hover')) this.tip.hide();
    this.entWin.replaceChildren();
    const head = el('div', 'win-head', this.entWin);
    head.textContent = def.name;
    const close = el('button', 'close', head);
    close.textContent = '×';
    close.onclick = () => this.closeEntity();
    const body = el('div', 'win-body', this.entWin);
    el('div', `status s${e.status}`, body).textContent = STATUS_TEXT[e.status];
    const row = (label: string, inv: Inventory) => {
      const r = el('div', 'slot-row', body);
      el('span', 'label', r).textContent = label;
      inv.slots.forEach((st, i) => {
        const s = el('div', 'slot', r);
        if (st) {
          s.appendChild(this.icon(`item.${st.item}`));
          el('span', 'count', s).textContent = String(st.count);
        }
        s.addEventListener('click', (ev) => this.onEntitySlot(e, inv, i, ev.ctrlKey || ev.metaKey));
      });
    };
    const bar = (label: string, frac: number, cls = '') => {
      const r = el('div', 'progress-row', body);
      el('span', 'label', r).textContent = label;
      const b = el('div', `progress ${cls}`, r);
      el('div', 'fill', b).style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
    };
    if (e.kind === 'assembler') this.recipePicker(e, body);
    if (e.kind === 'splitter') this.splitterControls(e, body);
    for (const g of e.guiSlots()) row(g.label, g.inv);
    if (e.kind === 'assembler') bar('Fortschritt', e.recipe && e.crafting ? e.progress / e.recipeTicks(e.recipe) : 0);
    if (e.kind === 'lab') {
      const t = g.world.research.currentTech;
      bar(t ? t.name : 'Keine Forschung (T)', t ? g.world.research.fraction(t.id) : 0);
    }
    const en = (e as { energy?: { type?: string; buffer?: number; capacity?: number } }).energy;
    if (en?.type === 'electric') bar('Strom', (en.buffer ?? 0) / Math.max(1, en.capacity ?? 1), 'power');
    if (e.kind === 'drill') bar('Fortschritt', e.progress / Math.max(1, e.ticksPerItem(1)));
    if (e.kind === 'furnace') bar('Fortschritt', e.recipe ? e.progress / e.recipeTicks(e.recipe) : 0);
    const burner = e.burner;
    if (burner) bar('Energie', burner.energy / 4e6, 'energy');
    el('div', 'hint', body).textContent = 'Klick: Stapel nehmen · Mit Cursor-Item: einlegen · Strg+Klick im Inventar: Stapel übertragen';
  }

  private entityKey(e: Entity): string {
    const slots = e.guiSlots().map((g) => JSON.stringify(g.inv.slots)).join('|');
    const prog = e.kind === 'drill' || e.kind === 'furnace' || e.kind === 'assembler' ? e.progress >> 3 : 0;
    const extra = e.kind === 'splitter' ? `${e.state.inputPriority}${e.state.outputPriority}${e.state.filter}` : e.kind === 'assembler' ? e.recipe?.id ?? '-' : e.kind === 'lab' ? `${this.game.world.research.current}${this.game.world.research.fraction(this.game.world.research.current ?? '') * 100 | 0}` : '';
    const en = (e as { energy?: { type?: string; buffer?: number } }).energy;
    const power = en?.type === 'electric' ? (en.buffer ?? 0) >> 6 : 0;
    return `${e.kind}${e.status}|${slots}|${prog}|${(e.burner?.energy ?? 0) >> 16}|${extra}|${power}`;
  }

  private onEntitySlot(e: Entity, inv: Inventory, i: number, ctrl: boolean): void {
    const g = this.game;
    const p = g.world.player;
    const st = inv.slots[i];
    const ci = g.cursorItem;
    if (ci && p && acceptAmount(e, ci, 'player') > 0 && (!st || st.item === ci)) {
      const have = p.inventory.count(ci);
      const amount = ctrl ? have : Math.min(have, ITEMS[ci]?.stackSize ?? 1);
      const n = insertInto(e, ci, amount, 'player');
      p.inventory.remove(ci, n);
    } else if (st && p) {
      const n = p.inventory.add(st.item, st.count);
      st.count -= n;
      if (st.count === 0) inv.slots[i] = null;
    }
    this.entWin.dataset.key = '';
    this.buildEntity();
    this.updateInventory(true);
  }

  // ---------------------------------------------------------- Menü, Hilfe

  closeWindows(): boolean {
    let any = false;
    for (const w of [this.help, this.invWin, this.entWin, this.menu, this.techWin]) {
      if (!w.classList.contains('hidden')) {
        w.classList.add('hidden');
        any = true;
      }
    }
    this.openEntityId = null;
    return any;
  }

  // ---------------------------------------------------------- Montage, Forschung

  private recipePicker(e: Extract<Entity, { kind: 'assembler' }>, body: HTMLElement): void {
    const g = this.game;
    el('div', 'sub-head', body).textContent = e.recipe ? 'Rezept (Klick zum Wechseln)' : 'Rezept wählen';
    const grid = el('div', 'grid recipes', body);
    for (const r of RECIPE_LIST) {
      if (!e.canCraft(r) || !g.world.research.recipeUnlocked(r.id)) continue;
      const s = el('div', `slot recipe${e.recipe?.id === r.id ? ' active' : ''}`, grid);
      s.appendChild(this.icon(`item.${r.results[0].item}`));
      this.tip.attach(s, () => this.tip.recipe(r, e.def.craftingSpeed));
      s.addEventListener('click', () => {
        const back = e.setRecipe(e.recipe?.id === r.id ? null : r.id);
        const p = g.world.player;
        for (const st of back) {
          const n = p ? p.inventory.add(st.item, st.count) : 0;
          for (let k = n; k < st.count; k++) g.world.dropGround(e.cx, e.cy, st.item);
        }
        this.entWin.dataset.key = '';
        this.buildEntity();
        this.updateInventory(true);
      });
    }
  }

  private splitterControls(e: Extract<Entity, { kind: 'splitter' }>, body: HTMLElement): void {
    const st = e.state;
    const choice = (label: string, value: number, set: (v: number) => void) => {
      const r = el('div', 'slot-row', body);
      el('span', 'label', r).textContent = label;
      for (const [v, name] of [[0, 'Links'], [-1, 'Keiner'], [1, 'Rechts']] as const) {
        const b = el('button', `small-btn${value === v ? ' active' : ''}`, r);
        b.textContent = name;
        b.onclick = () => {
          set(v);
          this.entWin.dataset.key = '';
          this.buildEntity();
        };
      }
    };
    choice('Eingang', st.inputPriority, (v) => (st.inputPriority = v));
    choice(st.filter >= 0 ? 'Filter-Seite' : 'Ausgang', st.outputPriority, (v) => (st.outputPriority = v));
    const r = el('div', 'slot-row', body);
    el('span', 'label', r).textContent = 'Filter';
    const slot = el('div', 'slot', r);
    if (st.filter >= 0) slot.appendChild(this.icon(`item.${itemId(st.filter)}`));
    slot.title = 'Mit Item im Cursor klicken: Filter setzen · ohne: Filter löschen';
    slot.addEventListener('click', () => {
      const ci = this.game.cursorItem;
      st.filter = ci ? itemIndex(ci) : -1;
      if (st.filter >= 0 && st.outputPriority < 0) st.outputPriority = 0;
      this.entWin.dataset.key = '';
      this.buildEntity();
    });
  }

  toggleResearch(): void {
    const hidden = this.techWin.classList.toggle('hidden');
    if (!hidden) this.buildResearch();
  }

  private researchKey = '';
  private updateResearch(): void {
    const r = this.game.world.research;
    if (r.finished.length) {
      for (const id of r.finished) this.game.world.player?.note(`Forschung abgeschlossen: ${TECH_BY_ID[id]?.name ?? id}`);
      r.finished.length = 0;
      this.refreshAll();
    }
    const t = r.currentTech;
    const key = t ? `${t.id}${Math.floor(r.fraction(t.id) * 200)}` : '-';
    if (key === this.researchKey) return;
    this.researchKey = key;
    this.researchEl.replaceChildren();
    this.researchEl.style.display = t ? 'flex' : 'none';
    if (!t) return;
    el('span', '', this.researchEl).textContent = t.name;
    const b = el('div', 'progress', this.researchEl);
    el('div', 'fill', b).style.width = `${(r.fraction(t.id) * 100).toFixed(1)}%`;
    if (!this.techWin.classList.contains('hidden')) this.buildResearch();
  }

  private buildResearch(): void {
    const r = this.game.world.research;
    this.techWin.replaceChildren();
    const head = el('div', 'win-head', this.techWin);
    head.textContent = 'Forschung';
    const close = el('button', 'close', head);
    close.textContent = '×';
    close.onclick = () => this.toggleResearch();
    const body = el('div', 'win-body tech-body', this.techWin);
    for (const t of TECHS) {
      const done = r.done.has(t.id);
      const avail = r.available(t.id);
      const card = el('div', `tech-card${done ? ' done' : avail ? '' : ' locked'}${r.current === t.id ? ' active' : ''}`, body);
      const top = el('div', 'tech-top', card);
      el('b', '', top).textContent = t.name;
      el('span', 'dim', top).textContent = done ? 'erforscht' : r.current === t.id ? 'läuft' : avail ? '' : 'gesperrt';
      const cost = el('div', 'tech-cost', card);
      if (t.trigger) {
        cost.appendChild(this.icon(`item.${t.trigger.item}`));
        const made = Math.min(t.trigger.count, r.made.get(t.trigger.item) ?? 0);
        el('span', '', cost).textContent = ` Auslöser: ${t.trigger.count} × ${ITEMS[t.trigger.item]?.name ?? t.trigger.item} herstellen (${done ? t.trigger.count : made}/${t.trigger.count})`;
      } else {
        for (const pk of t.packs) cost.appendChild(this.icon(`item.${pk}`));
        el('span', '', cost).textContent = ` × ${t.count} · ${t.time} s je Einheit`;
      }
      const un = el('div', 'tech-unlocks', card);
      for (const u of t.unlocks) {
        const ic = this.icon(`item.${u}`);
        un.appendChild(ic);
        const rec = RECIPE_LIST.find((x) => x.id === u);
        if (rec) this.tip.attach(ic, () => this.tip.recipe(rec));
      }
      if (t.prerequisites.length) el('div', 'dim', card).textContent = `Voraussetzung: ${t.prerequisites.map((p) => TECH_BY_ID[p].name).join(', ')}`;
      if (!done) {
        const b = el('div', 'progress', card);
        el('div', 'fill', b).style.width = `${(r.fraction(t.id) * 100).toFixed(1)}%`;
      }
      if (avail && !t.trigger) {
        card.addEventListener('click', () => {
          r.start(r.current === t.id ? null : t.id);
          this.researchKey = '';
          this.buildResearch();
        });
      }
    }
    el('div', 'hint', body).textContent = 'Klick: Forschung starten/anhalten · Labore brauchen Strom und Pakete (je Einheit ein Paket jeder Sorte) · Auslöser-Forschungen schließen sich von selbst ab';
  }

  toggleHelp(): void {
    this.help.classList.toggle('hidden');
  }

  toggleDebug(): void {
    this.showDebug = !this.showDebug;
  }

  private buildHelp(): void {
    this.help.innerHTML = `
      <div class="win-head">Steuerung<button class="close">×</button></div>
      <div class="win-body help-body">
        <p><b>WASD</b> laufen · <b>Mausrad</b> zoomen</p>
        <p><b>Linksklick</b> bauen (Bänder durch Ziehen) · <b>R</b> drehen · <b>Q</b> Gebäude/Item aufnehmen bzw. Cursor leeren</p>
        <p><b>Rechtsklick halten</b> abbauen oder Gebäude aufnehmen</p>
        <p><b>E</b> Inventar & Handwerk · <b>T</b> Forschung · <b>M</b> Karte · <b>Klick</b> auf Gebäude öffnet Slots · <b>Strg+Klick</b> überträgt ganzen Stapel</p>
        <p><b>1–0</b> Schnellleiste (Rechtsklick auf Platz: mit Cursor-Item belegen) · <b>Alt</b> Detailansicht</p>
        <p><b>Z</b> Cursor-Item ablegen · <b>F</b> halten: Items vom Boden aufheben · <b>Strg+Z</b> rückgängig · <b>Umschalt</b>+Ziehen: gerade Linie</p>
        <p><b>Strg+S</b> speichern · <b>Strg+L</b> laden · <b>Esc</b> Menü (Autosave, Export, Import) · <b>F3</b> Debug · <b>H</b> diese Hilfe</p>
        <p class="dim">Debug/Sandkasten: <b>Z/X/C/V</b> Eisenerz/Kohle/Stein/Platte auf Band unter dem Cursor · <b>P</b> Pause</p>
      </div>`;
    this.help.querySelector('.close')!.addEventListener('click', () => this.toggleHelp());
  }

  toggleMenu(): void {
    const hidden = this.menu.classList.toggle('hidden');
    if (!hidden) void this.buildMenu();
  }

  private async buildMenu(): Promise<void> {
    this.menu.replaceChildren();
    const head = el('div', 'win-head', this.menu);
    head.textContent = 'Menü';
    const body = el('div', 'win-body menu-body', this.menu);
    const btn = (label: string, fn: () => void) => {
      const b = el('button', 'menu-btn', body);
      b.textContent = label;
      b.onclick = fn;
    };
    btn('Weiterspielen', () => this.toggleMenu());
    btn('Speichern', () => void this.saveGame());
    btn('Speichern unter …', () => {
      const name = prompt('Name des Spielstands', `Spiel ${new Date().toLocaleDateString('de-DE')}`)?.trim();
      if (name) void this.saveGame(name).then(() => this.buildMenu());
    });
    btn('Laden (Schnellspeicher)', () => void this.loadGame());
    btn('Laden (Autosave)', () => void this.loadGame('autosave'));
    btn('Spielstand exportieren (Datei)', () => this.exportGame());
    btn('Spielstand importieren (Datei)', () => this.importGame());
    btn('Hilfe', () => { this.toggleMenu(); this.toggleHelp(); });
    btn('Neues Spiel (neue Karte)', () => { location.search = '?new'; });
    el('div', 'hint', body).textContent = `Karte ${this.game.world.seed} · Autosave alle 5 Minuten und beim Schließen des Tabs`;
    const saves = await listSaves().catch(() => []);
    if (saves.length) {
      el('div', 'sub-head', body).textContent = 'Spielstände';
      for (const s of saves) {
        const r = el('div', 'save-row', body);
        el('span', '', r).textContent = `${s.name} – ${new Date(s.time).toLocaleString('de-DE')}`;
        const l = el('button', 'small-btn', r);
        l.textContent = 'Laden';
        l.onclick = () => void this.loadGame(s.name);
        const d = el('button', 'small-btn', r);
        d.textContent = 'Löschen';
        d.onclick = async () => { await deleteSave(s.name); void this.buildMenu(); };
      }
    }
  }

  /** Startdialog: neuesten Spielstand fortsetzen oder neu beginnen. */
  async offerContinue(): Promise<void> {
    const saves = await listSaves().catch(() => []);
    if (!saves.length) return;
    const latest = saves[0];
    this.menu.replaceChildren();
    const head = el('div', 'win-head', this.menu);
    head.textContent = 'Willkommen zurück';
    const body = el('div', 'win-body menu-body', this.menu);
    const b1 = el('button', 'menu-btn primary', body);
    b1.textContent = `Weiterspielen – ${latest.name} (${new Date(latest.time).toLocaleString('de-DE')})`;
    b1.onclick = () => { this.menu.classList.add('hidden'); void this.loadGame(latest.name); };
    const b2 = el('button', 'menu-btn', body);
    b2.textContent = `Neues Spiel (Karte ${this.game.world.seed})`;
    b2.onclick = () => this.menu.classList.add('hidden');
    if (saves.length > 1) {
      el('div', 'sub-head', body).textContent = 'Weitere Spielstände';
      for (const s of saves.slice(1)) {
        const r = el('div', 'save-row', body);
        el('span', '', r).textContent = `${s.name} – ${new Date(s.time).toLocaleString('de-DE')}`;
        const l = el('button', 'small-btn', r);
        l.textContent = 'Laden';
        l.onclick = () => { this.menu.classList.add('hidden'); void this.loadGame(s.name); };
      }
    }
    this.menu.classList.remove('hidden');
  }

  async saveGame(name = 'schnellspeicher', quiet = false): Promise<void> {
    try {
      await saveWorld(name, this.game.world, this.game.creative);
      if (!quiet) this.flash('Gespeichert');
    } catch (err) {
      this.flash(`Speichern fehlgeschlagen: ${String(err)}`);
    }
  }

  async loadGame(name = 'schnellspeicher'): Promise<void> {
    try {
      const r = await loadWorld(name);
      if (!r) {
        this.flash('Kein Spielstand vorhanden');
        return;
      }
      this.closeWindows();
      this.game.setWorld(r.world, r.creative);
      this.flash('Geladen');
    } catch (err) {
      this.flash(`Laden fehlgeschlagen: ${String(err)}`);
    }
  }

  /** Spielstand als JSON-Datei herunterladen. */
  exportGame(): void {
    const data = JSON.stringify({ format: 'eisenwerk', creative: this.game.creative, data: serializeWorld(this.game.world) });
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eisenwerk-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.flash('Exportiert');
  }

  /** Spielstand aus einer JSON-Datei laden. */
  importGame(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        if (j.format !== 'eisenwerk') throw new Error('keine Eisenwerk-Datei');
        this.closeWindows();
        this.game.setWorld(deserializeWorld(j.data), !!j.creative);
        this.flash('Importiert');
      } catch (err) {
        this.flash(`Import fehlgeschlagen: ${String(err)}`);
      }
    };
    input.click();
  }

  private flash(msg: string): void {
    this.msgEl.textContent = msg;
    this.msgEl.dataset.t = String(this.frame);
  }
}
