import { ITEMS } from '../data/items';
import { TECHS, type TechDef, type TechEffect } from '../data/tech';
import type { ResearchSystem } from '../sim/research';

/** Was der Baum vom HUD braucht. */
export interface TechTreeHost {
  research(): ResearchSystem;
  icon(name: string, cls?: string): HTMLImageElement;
  techIcon(id: string): HTMLImageElement;
  /** Tooltip mit dem Rezept an ein Symbol hängen. */
  recipeTip(target: HTMLElement, recipeId: string): void;
  effectText(e: TechEffect): string;
  flash(msg: string): void;
  /** Forschungsstand hat sich durch Bedienung geändert. */
  changed(): void;
}

/** Ein Knoten im Baum: eine Technologie oder eine Stufenreihe (z. B. Greifarm-Kapazität 1–7). */
interface Node {
  key: string;
  members: TechDef[];
  /** Voraussetzungen (Knotenschlüssel) der ersten Stufe: bestimmen Spalte und Linien. */
  prereqs: string[];
  /** Knoten, die hierauf aufbauen. */
  next: string[];
  col: number;
  y: number;
  el?: HTMLDivElement;
}

const CARD_W = 184;
const CARD_H = 66;
const COL_W = CARD_W + 64;
const ROW_H = CARD_H + 14;
const PAD = 16;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
}

const seriesKey = (t: TechDef) => (t.level !== undefined ? t.id.replace(/-\d+$/, '') : t.id);

/** Knoten und Lage berechnen (Spalte = längste Voraussetzungskette, Zeilen nach Schwerpunkt der Vorgänger). */
function layout(): { nodes: Map<string, Node>; byTech: Map<string, string>; cols: number; height: number } {
  const nodes = new Map<string, Node>();
  const byTech = new Map<string, string>();
  for (const t of TECHS) {
    const k = seriesKey(t);
    byTech.set(t.id, k);
    let n = nodes.get(k);
    if (!n) nodes.set(k, (n = { key: k, members: [], prereqs: [], next: [], col: 0, y: 0 }));
    n.members.push(t);
  }
  for (const n of nodes.values()) {
    n.members.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const first = n.members[0];
    n.prereqs = [...new Set(first.prerequisites.map((p) => byTech.get(p)!).filter((p) => p && p !== n.key))];
  }
  for (const n of nodes.values()) for (const p of n.prereqs) nodes.get(p)!.next.push(n.key);
  // Spalten
  const depth = new Map<string, number>();
  const dep = (k: string): number => {
    const d = depth.get(k);
    if (d !== undefined) return d;
    depth.set(k, 0);
    const n = nodes.get(k)!;
    const v = n.prereqs.length ? 1 + Math.max(...n.prereqs.map(dep)) : 0;
    depth.set(k, v);
    return v;
  };
  let cols = 0;
  for (const n of nodes.values()) {
    n.col = dep(n.key);
    cols = Math.max(cols, n.col + 1);
  }
  const columns: Node[][] = Array.from({ length: cols }, () => []);
  for (const n of nodes.values()) columns[n.col].push(n);
  // Zeilen: Spalte 0 der Reihe nach, danach am Mittel der Vorgänger ausrichten und Überlappungen nach unten schieben
  const place = (col: Node[], want: (n: Node) => number) => {
    const ws = col.map((n) => ({ n, w: want(n) })).sort((a, b) => a.w - b.w);
    let last = -Infinity;
    for (const { n, w } of ws) {
      n.y = Math.max(w, last + ROW_H);
      last = n.y;
    }
  };
  columns[0].forEach((n, i) => (n.y = i * ROW_H));
  const avg = (keys: string[], fallback: number) => (keys.length ? keys.reduce((s, k) => s + nodes.get(k)!.y, 0) / keys.length : fallback);
  for (let c = 1; c < cols; c++) place(columns[c], (n) => avg(n.prereqs, 0));
  // Rückwärts: Grundlagen zu ihren Nachfolgern ziehen, dann noch einmal vorwärts
  for (let c = cols - 2; c >= 0; c--) place(columns[c], (n) => avg(n.next, n.y) * 0.5 + n.y * 0.5);
  for (let c = 1; c < cols; c++) place(columns[c], (n) => avg(n.prereqs, n.y));
  let minY = Infinity;
  let maxY = 0;
  for (const n of nodes.values()) {
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  for (const n of nodes.values()) n.y -= minY;
  return { nodes, byTech, cols, height: maxY - minY + CARD_H };
}

/**
 * Forschungsfenster nach dem Vorbild des Originals: links Liste mit Suche, in der Mitte der Baum
 * (Grundlagen links, darauf aufbauende Forschung rechts, Linien zu den Voraussetzungen), rechts die Einzelheiten.
 * Farben: erforscht grün, erforschbar gelb, gesperrt rot, durch die Warteschlange erreichbar orange.
 */
export class TechTreeView {
  readonly root: HTMLDivElement;
  private readonly data = layout();
  private readonly tree: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly edges: { from: string; to: string; path: SVGPathElement }[] = [];
  private readonly list: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private selected: string | null = null;
  private readonly canvas: HTMLDivElement;
  private zoom = 1;

  constructor(private readonly host: TechTreeHost) {
    this.root = el('div', 'tt-main');
    const left = el('div', 'tt-left', this.root);
    this.search = el('input', 'tt-search', left);
    this.search.placeholder = 'Suchen …';
    this.search.addEventListener('input', () => this.refresh());
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    const zb = el('div', 'tt-zoom', left);
    for (const [label, title, f] of [['−', 'Verkleinern', 0.8], ['+', 'Vergrößern', 1.25], ['Übersicht', 'Ganzen Baum zeigen', 0]] as const) {
      const b = el('button', '', zb);
      b.textContent = label;
      b.title = title;
      b.onclick = () => this.setZoom(f === 0 ? this.fitZoom() : this.zoom * f);
    }
    this.list = el('div', 'tt-list', left);
    this.tree = el('div', 'tt-tree', this.root);
    const canvas = el('div', 'tt-canvas', this.tree);
    this.canvas = canvas;
    const W = this.data.cols * COL_W - (COL_W - CARD_W) + PAD * 2;
    const H = this.data.height + PAD * 2;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'tt-edges');
    this.svg.setAttribute('width', String(W));
    this.svg.setAttribute('height', String(H));
    canvas.appendChild(this.svg);
    this.detail = el('div', 'tt-detail', this.root);
    const pos = (n: Node) => ({ x: PAD + n.col * COL_W, y: PAD + n.y });
    // Linien (unter den Karten)
    for (const n of this.data.nodes.values()) {
      for (const p of n.prereqs) {
        const a = pos(this.data.nodes.get(p)!);
        const b = pos(n);
        const x1 = a.x + CARD_W;
        const y1 = a.y + CARD_H / 2;
        const x2 = b.x;
        const y2 = b.y + CARD_H / 2;
        const mx = (x1 + x2) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        this.svg.appendChild(path);
        this.edges.push({ from: p, to: n.key, path });
      }
    }
    // Karten
    for (const n of this.data.nodes.values()) {
      const c = el('div', 'tt-card', canvas);
      const p = pos(n);
      c.style.left = `${p.x}px`;
      c.style.top = `${p.y}px`;
      c.addEventListener('click', (ev) => {
        if (ev.shiftKey) this.enqueue(n);
        else this.select(n.key, false);
      });
      c.addEventListener('dblclick', () => this.enqueue(n));
      n.el = c;
    }
    this.panAndWheel();
    this.refresh();
  }

  /** Knoten der Technologie, die gerade zu erforschen ist (nächste offene Stufe). */
  private rep(n: Node): TechDef {
    const r = this.host.research();
    return n.members.find((t) => !r.done.has(t.id)) ?? n.members[n.members.length - 1];
  }

  private state(t: TechDef): 'done' | 'current' | 'queued' | 'avail' | 'reach' | 'locked' {
    const r = this.host.research();
    if (r.done.has(t.id)) return 'done';
    if (r.current === t.id) return 'current';
    if (r.queue.includes(t.id)) return 'queued';
    if (r.available(t.id)) return 'avail';
    // erreichbar über die Warteschlange (Original: orange)
    const ok = (p: string) => r.done.has(p) || r.current === p || r.queue.includes(p);
    if (t.prerequisites.every(ok)) return 'reach';
    return 'locked';
  }

  private enqueue(n: Node): void {
    const r = this.host.research();
    const t = this.rep(n);
    if (r.done.has(t.id)) return;
    if (t.trigger) {
      this.host.flash('Auslöser-Forschung: schließt sich von selbst ab');
      return;
    }
    if (!r.enqueue(t.id)) this.host.flash(r.queue.includes(t.id) || r.current === t.id ? 'Schon in der Warteschlange' : 'Warteschlange voll');
    this.host.changed();
    this.refresh();
  }

  /** Auswahl setzen und (auf Wunsch) im Baum dorthin rollen. */
  select(key: string | null, scroll: boolean): void {
    this.selected = key;
    this.refresh();
    if (scroll && key) {
      const n = this.data.nodes.get(key)!;
      const z = this.zoom;
      const x = (PAD + n.col * COL_W + CARD_W / 2) * z - this.tree.clientWidth / 2;
      const y = (PAD + n.y + CARD_H / 2) * z - this.tree.clientHeight / 2;
      this.tree.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: 'smooth' });
    }
  }

  /** Maßstab, bei dem der ganze Baum in die Fläche passt (höchstens 1). */
  private fitZoom(): number {
    const w = parseFloat(this.canvas.style.width);
    const h = parseFloat(this.canvas.style.height);
    return Math.min(1, (this.tree.clientWidth - 4) / w, (this.tree.clientHeight - 4) / h);
  }

  /** Zoomen um die Mitte der sichtbaren Fläche. */
  private setZoom(z: number): void {
    const nz = Math.max(0.25, Math.min(1.5, z));
    const cx = (this.tree.scrollLeft + this.tree.clientWidth / 2) / this.zoom;
    const cy = (this.tree.scrollTop + this.tree.clientHeight / 2) / this.zoom;
    this.zoom = nz;
    this.canvas.style.zoom = String(nz);
    this.tree.scrollLeft = cx * nz - this.tree.clientWidth / 2;
    this.tree.scrollTop = cy * nz - this.tree.clientHeight / 2;
  }

  /** Beim Öffnen: laufende bzw. erste erforschbare Forschung auswählen. */
  focusDefault(): void {
    const r = this.host.research();
    const pick = r.current ?? TECHS.find((t) => r.available(t.id) && !t.trigger)?.id ?? null;
    this.select(pick ? this.data.byTech.get(pick)! : this.selected, true);
  }

  /** Alle Vorgänger bzw. Nachfolger eines Knotens. */
  private closure(key: string, dir: 'prereqs' | 'next'): Set<string> {
    const out = new Set<string>();
    const stack = [key];
    while (stack.length) {
      const k = stack.pop()!;
      for (const p of this.data.nodes.get(k)![dir]) {
        if (!out.has(p)) {
          out.add(p);
          stack.push(p);
        }
      }
    }
    return out;
  }

  /** Zustände, Fortschritt, Hervorhebung und Einzelheiten aktualisieren (ohne den Baum neu aufzubauen). */
  refresh(): void {
    const r = this.host.research();
    const sel = this.selected;
    const anc = sel ? this.closure(sel, 'prereqs') : null;
    const desc = sel ? this.closure(sel, 'next') : null;
    const q = this.search.value.trim().toLowerCase();
    for (const n of this.data.nodes.values()) {
      const t = this.rep(n);
      const st = n.members.every((m) => r.done.has(m.id)) ? 'done' : this.state(t);
      const match = q && n.members.some((m) => m.name.toLowerCase().includes(q));
      const rel = !sel ? '' : n.key === sel ? ' sel' : anc!.has(n.key) ? ' anc' : desc!.has(n.key) ? ' desc' : ' faded';
      const c = n.el!;
      c.className = `tt-card ${st}${rel}${match ? ' match' : ''}`;
      c.replaceChildren();
      c.appendChild(this.host.techIcon(t.id)).className = 'icon tt-icon';
      const body = el('div', 'tt-body', c);
      el('div', 'tt-name', body).textContent = r.nameOf(t.id);
      const cost = el('div', 'tt-cost', body);
      if (t.trigger) {
        cost.appendChild(this.host.icon(`item.${t.trigger.item}`, 'icon tt-pack'));
        el('span', '', cost).textContent = `Auslöser ${Math.min(t.trigger.count, r.made.get(t.trigger.item) ?? 0)}/${t.trigger.count}`;
      } else {
        for (const pk of t.packs) cost.appendChild(this.host.icon(`item.${pk}`, 'icon tt-pack'));
        el('span', '', cost).textContent = `×${r.countOf(t)}`;
      }
      if (n.members.length > 1 || t.infinite) {
        const last = n.members[n.members.length - 1];
        const lv = el('span', 'tt-level', c);
        const doneCount = n.members.filter((m) => r.done.has(m.id)).length;
        lv.textContent = last.infinite ? `${r.levelOf(t)}/∞` : `${Math.min(doneCount + 1, n.members.length)}/${n.members.length}`;
      }
      const f = r.fraction(t.id);
      if (st !== 'done' && f > 0) {
        const b = el('div', 'tt-progress', c);
        el('div', 'fill', b).style.width = `${(f * 100).toFixed(1)}%`;
      }
      c.title = `${r.nameOf(t.id)} – Klick: auswählen · Doppelklick/Umschalt+Klick: Warteschlange`;
    }
    for (const e of this.edges) {
      const done = r.done.has(this.data.nodes.get(e.from)!.members[0].id);
      const hi = sel && ((e.to === sel || anc!.has(e.to)) && (e.from === sel || anc!.has(e.from)) ? 'anc' : (e.from === sel || desc!.has(e.from)) && desc!.has(e.to) ? 'desc' : '');
      e.path.setAttribute('class', `${done ? 'done' : ''} ${hi || (sel ? 'faded' : '')}`);
    }
    this.buildList(q);
    this.buildDetail();
  }

  private buildList(q: string): void {
    const r = this.host.research();
    this.list.replaceChildren();
    const section = (title: string, nodes: Node[]) => {
      if (!nodes.length) return;
      el('div', 'tt-sec', this.list).textContent = title;
      for (const n of nodes) {
        const t = this.rep(n);
        const row = el('div', `tt-row ${this.state(t)}${n.key === this.selected ? ' sel' : ''}`, this.list);
        row.appendChild(this.host.techIcon(t.id));
        el('span', '', row).textContent = r.nameOf(t.id);
        row.onclick = () => this.select(n.key, true);
        row.ondblclick = () => this.enqueue(n);
      }
    };
    const all = [...this.data.nodes.values()];
    if (q) {
      section('Treffer', all.filter((n) => n.members.some((m) => m.name.toLowerCase().includes(q))));
      return;
    }
    const st = (n: Node) => this.state(this.rep(n));
    section('Läuft / Warteschlange', all.filter((n) => st(n) === 'current' || st(n) === 'queued')
      .sort((a, b) => (st(a) === 'current' ? -1 : r.queue.indexOf(this.rep(a).id)) - (st(b) === 'current' ? -1 : r.queue.indexOf(this.rep(b).id))));
    section('Erforschbar', all.filter((n) => st(n) === 'avail'));
    section('Über Warteschlange erreichbar', all.filter((n) => st(n) === 'reach'));
  }

  private buildDetail(): void {
    const d = this.detail;
    d.replaceChildren();
    const r = this.host.research();
    if (!this.selected) {
      el('div', 'dim', d).textContent = 'Forschung im Baum oder in der Liste auswählen.';
      return;
    }
    const n = this.data.nodes.get(this.selected)!;
    const t = this.rep(n);
    const st = n.members.every((m) => r.done.has(m.id)) ? 'done' : this.state(t);
    const head = el('div', 'tt-dhead', d);
    head.appendChild(this.host.techIcon(t.id)).className = 'icon tt-dicon';
    const hb = el('div', '', head);
    el('div', 'tt-dname', hb).textContent = r.nameOf(t.id);
    el('div', `tt-dstate ${st}`, hb).textContent = {
      done: 'erforscht', current: 'wird erforscht', queued: `Warteschlange ${r.queue.indexOf(t.id) + 1}`,
      avail: 'erforschbar', reach: 'nach der Warteschlange erforschbar', locked: 'Voraussetzungen fehlen',
    }[st];
    // Kosten
    const cost = el('div', 'tt-dcost', d);
    if (t.trigger) {
      cost.appendChild(this.host.icon(`item.${t.trigger.item}`));
      const made = Math.min(t.trigger.count, r.made.get(t.trigger.item) ?? 0);
      el('span', '', cost).textContent = ` Auslöser: ${t.trigger.count} × ${ITEMS[t.trigger.item]?.name ?? t.trigger.item} herstellen (${st === 'done' ? t.trigger.count : made}/${t.trigger.count})`;
    } else {
      for (const pk of t.packs) cost.appendChild(this.host.icon(`item.${pk}`));
      el('span', '', cost).textContent = ` × ${r.countOf(t)} · ${t.time} s je Einheit${t.infinite ? ' · unendlich' : ''}`;
    }
    if (st !== 'done' && r.fraction(t.id) > 0) {
      const b = el('div', 'progress', d);
      el('div', 'fill', b).style.width = `${(r.fraction(t.id) * 100).toFixed(1)}%`;
    }
    // Knöpfe
    const btns = el('div', 'tt-btns', d);
    const btn = (label: string, fn: () => void, primary = false) => {
      const b = el('button', primary ? 'primary' : '', btns);
      b.textContent = label;
      b.onclick = () => {
        fn();
        this.host.changed();
        this.refresh();
      };
    };
    if (st === 'avail' && !t.trigger) btn('Forschung starten', () => r.start(t.id), true);
    if (st === 'current') btn('Anhalten', () => r.start(null));
    if ((st === 'avail' || st === 'reach' || st === 'locked') && !t.trigger) btn('In die Warteschlange', () => this.enqueue(n));
    if (st === 'queued' || st === 'current') btn('Aus der Warteschlange', () => r.dequeue(t.id));
    // Wirkung
    if (t.effects?.length || t.unlocks.length) {
      el('div', 'tt-sec', d).textContent = 'Wirkung';
      if (t.effects?.length) el('div', 'tech-effects', d).textContent = t.effects.map((e) => this.host.effectText(e)).join(' · ');
      const un = el('div', 'tt-unlocks', d);
      for (const u of t.unlocks) {
        const ic = this.host.icon(`item.${u}`);
        un.appendChild(ic);
        this.host.recipeTip(ic, u);
      }
    }
    // Stufen einer Reihe
    if (n.members.length > 1) {
      el('div', 'tt-sec', d).textContent = 'Stufen';
      const lv = el('div', 'tt-levels', d);
      for (const m of n.members) {
        const s = el('span', `tt-lv ${this.state(m)}`, lv);
        s.textContent = m.infinite ? `${r.levelOf(m)}–∞` : String(m.level ?? '');
        s.title = r.nameOf(m.id);
      }
    }
    const links = (title: string, keys: string[]) => {
      if (!keys.length) return;
      el('div', 'tt-sec', d).textContent = title;
      for (const k of keys) {
        const m = this.data.nodes.get(k)!;
        const mt = this.rep(m);
        const row = el('div', `tt-row ${m.members.every((x) => r.done.has(x.id)) ? 'done' : this.state(mt)}`, d);
        row.appendChild(this.host.techIcon(mt.id));
        el('span', '', row).textContent = r.nameOf(mt.id);
        row.onclick = () => this.select(k, true);
      }
    };
    // weitere Voraussetzungen späterer Stufen (z. B. neue Wissenschaftspakete)
    const extra = [...new Set(t.prerequisites.map((p) => this.data.byTech.get(p)!).filter((k) => k !== n.key && !n.prereqs.includes(k)))];
    links('Voraussetzungen (Grundlagen)', [...n.prereqs, ...extra]);
    links('Ermöglicht', n.next);
  }

  /** Ziehen mit der Maus verschiebt den Baum; Mausrad rollt seitlich (Umschalt: senkrecht). */
  private panAndWheel(): void {
    let drag: { x: number; y: number; sl: number; st: number } | null = null;
    this.tree.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.tt-card') || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, sl: this.tree.scrollLeft, st: this.tree.scrollTop };
      this.tree.classList.add('panning');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.tree.scrollLeft = drag.sl - (e.clientX - drag.x);
      this.tree.scrollTop = drag.st - (e.clientY - drag.y);
    });
    window.addEventListener('mouseup', () => {
      drag = null;
      this.tree.classList.remove('panning');
    });
    this.tree.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey) this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      else if (e.shiftKey) this.tree.scrollTop += e.deltaY;
      else {
        this.tree.scrollLeft += e.deltaY + e.deltaX;
      }
    }, { passive: false });
  }
}
