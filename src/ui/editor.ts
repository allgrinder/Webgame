import { ENTITIES } from '../data/entities';
import { FLOOR_BY_ITEM } from '../data/floors';
import { ITEMS } from '../data/items';

/** Was die Editor-Leiste vom Spiel braucht. */
export interface EditorHost {
  readonly editor: boolean;
  readonly paused: boolean;
  cursorItem: string | null;
  toggleEditor(on?: boolean): void;
  toggleEditorRun(): void;
  icon(name: string, cls?: string): HTMLImageElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

/** Gruppen der Palette nach Gebäudeart. */
const GROUPS: { title: string; kinds: string[] }[] = [
  { title: 'Logistik', kinds: ['belt', 'underground', 'splitter', 'inserter', 'container'] },
  { title: 'Produktion', kinds: ['drill', 'furnace', 'assembler', 'lab', 'beacon', 'rocket-silo'] },
  { title: 'Flüssigkeiten', kinds: ['pipe', 'pipe-ground', 'pump', 'tank', 'offshore-pump', 'pumpjack'] },
  { title: 'Strom & Wärme', kinds: ['pole', 'boiler', 'generator', 'solar', 'accumulator', 'reactor', 'heat-pipe', 'heat-exchanger', 'lamp'] },
  { title: 'Züge', kinds: ['rail', 'train-stop', 'vehicle'] },
  { title: 'Schaltung & Roboter', kinds: ['combinator', 'roboport', 'radar'] },
  { title: 'Militär', kinds: ['turret', 'wall'] },
  { title: 'Boden', kinds: ['floor'] },
];

/** Alle Gegenstände, die sich in der Welt aufstellen oder verlegen lassen, mit ihrer Gruppe. */
export function editorPalette(): { title: string; items: string[] }[] {
  const kindOf = (id: string): string | null => {
    if (FLOOR_BY_ITEM[id] || id === 'landfill') return 'floor';
    if (id === 'locomotive' || id === 'cargo-wagon') return 'vehicle';
    const pr = ITEMS[id]?.placeResult;
    return pr && ENTITIES[pr] ? ENTITIES[pr].kind : null;
  };
  const all = Object.values(ITEMS).sort((a, b) => a.order - b.order).map((i) => i.id);
  const used = new Set<string>();
  const out = GROUPS.map((g) => {
    const items = all.filter((id) => {
      const k = kindOf(id);
      return k !== null && g.kinds.includes(k);
    });
    items.forEach((i) => used.add(i));
    return { title: g.title, items };
  });
  const rest = all.filter((id) => kindOf(id) !== null && !used.has(id));
  if (rest.length) out.push({ title: 'Sonstiges', items: rest });
  return out.filter((g) => g.items.length);
}

/**
 * Editor-Modus (F2): Leiste oben (Status, Simulation an/aus, Beenden) und Palette links mit allen Gebäuden,
 * unabhängig von Forschung und Inventar.
 */
export class EditorPanel {
  readonly bar: HTMLDivElement;
  readonly palette: HTMLDivElement;
  private readonly status: HTMLSpanElement;
  private readonly runBtn: HTMLButtonElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private shownItem: string | null | undefined;
  private readonly search: HTMLInputElement;

  constructor(parent: HTMLElement, private readonly host: EditorHost) {
    this.bar = el('div', 'editor-bar hidden', parent);
    el('b', 'editor-title', this.bar, 'EDITOR-MODUS');
    this.status = el('span', 'editor-status', this.bar);
    this.runBtn = el('button', 'small-btn', this.bar);
    this.runBtn.onclick = () => host.toggleEditorRun();
    const end = el('button', 'small-btn editor-end', this.bar, 'Editor beenden (F2)');
    end.onclick = () => host.toggleEditor(false);
    el('div', 'editor-hint dim', this.bar,
      'Linksklick baut (kostenlos, ohne Reichweite, auch Unerforschtes) · Rechtsklick entfernt sofort (auch Bäume) · '
      + 'WASD/Mausrad: Kamera · Strg+C/X/V: Bereich kopieren/leeren/einfügen (sofort) · Strg+Z rückgängig');

    this.palette = el('div', 'window editor-palette hidden', parent);
    const head = el('div', 'win-head', this.palette, 'Bauteile');
    void head;
    this.search = el('input', 'tt-search', this.palette);
    this.search.placeholder = 'Suchen …';
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    this.search.addEventListener('input', () => this.filter());
    const body = el('div', 'editor-groups', this.palette);
    for (const g of editorPalette()) {
      const sec = el('div', 'editor-group', body);
      el('div', 'hb-group', sec, g.title);
      const grid = el('div', 'hb-grid', sec);
      for (const id of g.items) {
        const b = el('button', 'hb-item', grid);
        b.appendChild(host.icon(`item.${id}`, 'icon'));
        b.title = ITEMS[id]?.name ?? id;
        b.dataset.item = id;
        b.onclick = () => {
          host.cursorItem = host.cursorItem === id ? null : id;
          this.update();
        };
        this.buttons.set(id, b);
      }
    }
    this.update();
  }

  private filter(): void {
    const q = this.search.value.trim().toLowerCase();
    for (const [id, b] of this.buttons) b.style.display = !q || (ITEMS[id]?.name ?? id).toLowerCase().includes(q) ? '' : 'none';
    for (const sec of this.palette.querySelectorAll<HTMLElement>('.editor-group')) {
      const any = [...sec.querySelectorAll<HTMLElement>('.hb-item')].some((b) => b.style.display !== 'none');
      sec.style.display = any ? '' : 'none';
    }
  }

  /** Sichtbarkeit, Status und markiertes Bauteil aktualisieren (jedes Bild, billig). */
  update(): void {
    const on = this.host.editor;
    this.bar.classList.toggle('hidden', !on);
    this.palette.classList.toggle('hidden', !on);
    if (!on) {
      this.shownItem = undefined;
      return;
    }
    const running = !this.host.paused;
    const txt = running ? 'Simulation läuft' : 'Spiel angehalten';
    if (this.status.textContent !== txt) {
      this.status.textContent = txt;
      this.status.classList.toggle('running', running);
      this.runBtn.textContent = running ? '⏸ Anhalten' : '▶ Simulation laufen lassen';
    }
    const ci = this.host.cursorItem;
    if (ci !== this.shownItem) {
      this.shownItem = ci;
      for (const [id, b] of this.buttons) b.classList.toggle('on', id === ci);
    }
  }
}
