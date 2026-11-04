import { entityDef } from '../data/entities';
import { ITEMS } from '../data/items';
import { RECIPE_LIST } from '../data/recipes';
import type { Game } from '../game/game';
import { deleteSave, listSaves, loadWorld, saveWorld } from '../game/save';
import { deserializeWorld, serializeWorld } from '../sim/serialize';
import type { SpriteLib } from '../render/assets';
import { Status } from '../sim/entity';
import { type Entity, acceptAmount, insertInto } from '../sim/machines';
import type { Inventory } from '../sim/inventory';

const STATUS_TEXT: Record<Status, string> = {
  [Status.Idle]: 'Leerlauf',
  [Status.Working]: 'Arbeitet',
  [Status.NoFuel]: 'Kein Brennstoff',
  [Status.OutputBlocked]: 'Ausgabe blockiert',
  [Status.NoInput]: 'Keine Zutaten',
  [Status.Depleted]: 'Ressourcen erschöpft',
  [Status.NoTarget]: 'Kein Ziel',
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
      return s;
    });
    const right = el('div', 'col', body);
    el('div', 'sub-head', right).textContent = 'Handwerk (Klick: 1, Umschalt: 5, Strg: alle)';
    const rgrid = el('div', 'grid recipes', right);
    this.recipeEls.clear();
    for (const r of RECIPE_LIST) {
      if (r.category !== 'crafting') continue;
      const s = el('div', 'slot recipe', rgrid);
      s.appendChild(this.icon(`item.${r.results[0].item}`));
      el('span', 'count', s);
      s.title = `${ITEMS[r.results[0].item]?.name}${r.results[0].amount > 1 ? ` ×${r.results[0].amount}` : ''}\n` +
        r.ingredients.map((i) => `${i.amount}× ${ITEMS[i.item]?.name}`).join(', ') + `\n${r.time} s`;
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
        s.title = ITEMS[st.item]?.name ?? st.item;
      } else s.title = '';
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
      const d = entityDef(e.name);
      if (!p.canReach(e.x + d.width / 2, e.y + d.height / 2)) {
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
    for (const g of e.guiSlots()) row(g.label, g.inv);
    if (e.kind === 'drill') bar('Fortschritt', e.progress / Math.max(1, e.ticksPerItem(1)));
    if (e.kind === 'furnace') bar('Fortschritt', e.recipe ? e.progress / e.recipeTicks(e.recipe) : 0);
    const burner = e.burner;
    if (burner) bar('Energie', burner.energy / 4e6, 'energy');
    el('div', 'hint', body).textContent = 'Klick: Stapel nehmen · Mit Cursor-Item: einlegen · Strg+Klick im Inventar: Stapel übertragen';
  }

  private entityKey(e: Entity): string {
    const slots = e.guiSlots().map((g) => JSON.stringify(g.inv.slots)).join('|');
    const prog = e.kind === 'drill' || e.kind === 'furnace' ? e.progress >> 3 : 0;
    return `${e.kind}${e.status}|${slots}|${prog}|${(e.burner?.energy ?? 0) >> 16}`;
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
    for (const w of [this.help, this.invWin, this.entWin, this.menu]) {
      if (!w.classList.contains('hidden')) {
        w.classList.add('hidden');
        any = true;
      }
    }
    this.openEntityId = null;
    return any;
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
        <p><b>E</b> Inventar & Handwerk · <b>Klick</b> auf Gebäude öffnet Slots · <b>Strg+Klick</b> überträgt ganzen Stapel</p>
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
    btn('Laden (Schnellspeicher)', () => void this.loadGame());
    btn('Laden (Autosave)', () => void this.loadGame('autosave'));
    btn('Spielstand exportieren (Datei)', () => this.exportGame());
    btn('Spielstand importieren (Datei)', () => this.importGame());
    btn('Hilfe', () => { this.toggleMenu(); this.toggleHelp(); });
    btn('Neues Spiel', () => { location.search = ''; });
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
