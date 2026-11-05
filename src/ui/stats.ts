import { ENTITIES } from '../data/entities';
import { FLUIDS } from '../data/fluids';
import { ITEMS } from '../data/items';
import { STATS } from '../data/ui';
import type { ProductionStats } from '../sim/stats';

const COLORS = ['#e0a53a', '#6fb1e0', '#8fcf6a', '#d9503a', '#b48ad8', '#e0d36a', '#5fd1b8', '#d98a5a'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
}

function nameOf(id: string): string {
  return ITEMS[id]?.name ?? FLUIDS[id]?.name ?? ENTITIES[id]?.name ?? id;
}

/** Menge kurz: 1,2 k / 3,4 M. */
export function fmtAmount(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)} G`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)} k`;
  if (a >= 100 || Number.isInteger(n)) return String(Math.round(n));
  return n.toFixed(1);
}

/** Leistung in W aus J je Tick. */
export function fmtPower(jPerTick: number): string {
  const w = jPerTick * 60;
  if (w >= 1e9) return `${(w / 1e9).toFixed(2)} GW`;
  if (w >= 1e6) return `${(w / 1e6).toFixed(2)} MW`;
  if (w >= 1e3) return `${(w / 1e3).toFixed(1)} kW`;
  return `${Math.round(w)} W`;
}

/**
 * Statistik-Ansicht (Produktion oder Stromnetz): Zeitfenster-Reiter, Verlaufsgrafik der wichtigsten Einträge,
 * Listen „Hergestellt“ und „Verbraucht“ mit Balken. mode 'power' zeigt Leistungen statt Mengen.
 */
export class StatsView {
  win = 0;
  /** Hervorgehobener Eintrag (Klick auf eine Zeile). */
  focus: string | null = null;
  constructor(
    private readonly icon: (id: string) => HTMLElement | null,
    private readonly mode: 'items' | 'power',
  ) {}

  render(body: HTMLElement, stats: ProductionStats): void {
    body.replaceChildren();
    const tabs = el('div', 'stats-tabs', body);
    STATS.windows.forEach((w, i) => {
      const b = el('button', i === this.win ? 'active' : '', tabs);
      b.textContent = w.label;
      b.onclick = () => {
        this.win = i;
        this.render(body, stats);
      };
    });
    const { made, used } = stats.totals(this.win);
    const span = STATS.windows[this.win].step * STATS.windows[this.win].count;
    const secs = Math.max(1, Math.min(span, stats.rings[this.win].made.length * STATS.windows[this.win].step));
    const top = [...made.entries()].sort((a, b) => b[1] - a[1]).slice(0, COLORS.length).map(([k]) => k);
    const shown = this.focus ? [this.focus] : top;
    const canvas = el('canvas', 'stats-graph', body);
    canvas.width = 560;
    canvas.height = 150;
    this.graph(canvas, stats, shown, this.mode === 'power' ? 'made' : 'made');
    const cols = el('div', 'stats-cols', body);
    this.list(cols, this.mode === 'power' ? 'Erzeugung' : 'Hergestellt', made, secs, top, stats);
    this.list(cols, this.mode === 'power' ? 'Verbrauch' : 'Verbraucht', used, secs, top, stats);
  }

  private list(parent: HTMLElement, title: string, m: Map<string, number>, secs: number, top: string[], stats: ProductionStats): void {
    const col = el('div', 'stats-col', parent);
    el('div', 'stats-title', col).textContent = title;
    const rows = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = rows[0]?.[1] ?? 1;
    if (!rows.length) el('div', 'dim', col).textContent = 'Noch nichts erfasst.';
    for (const [id, v] of rows) {
      const row = el('div', `stats-row${this.focus === id ? ' active' : ''}`, col);
      const ic = this.icon(id);
      if (ic) row.appendChild(ic);
      el('span', 'stats-name', row).textContent = nameOf(id);
      const bar = el('div', 'stats-bar', row);
      const fill = el('div', 'fill', bar);
      fill.style.width = `${(v / max) * 100}%`;
      const ci = top.indexOf(id);
      if (ci >= 0) fill.style.background = COLORS[ci];
      el('span', 'stats-val', row).textContent = this.mode === 'power'
        ? fmtPower(v / (secs * 60))
        : `${fmtAmount(v)} · ${fmtAmount((v / secs) * 60)}/min`;
      row.onclick = () => {
        this.focus = this.focus === id ? null : id;
        const body = parent.parentElement!;
        this.render(body, stats);
      };
    }
  }

  private graph(c: HTMLCanvasElement, stats: ProductionStats, ids: string[], kind: 'made' | 'used'): void {
    const g = c.getContext('2d');
    if (!g) return;
    const w = c.width;
    const h = c.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, w, h);
    const n = STATS.windows[this.win].count;
    const series = ids.map((id) => {
      const s = stats.series(this.win, id, kind);
      if (this.focus) return { id, s, u: stats.series(this.win, id, 'used') };
      return { id, s, u: null as number[] | null };
    });
    let max = 1;
    for (const { s, u } of series) for (const v of [...s, ...(u ?? [])]) max = Math.max(max, v);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(0, (h * k) / 4);
      g.lineTo(w, (h * k) / 4);
      g.stroke();
    }
    const draw = (s: number[], color: string) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      s.forEach((v, i) => {
        const x = ((i + n - s.length) / Math.max(1, n - 1)) * w;
        const y = h - 4 - (v / max) * (h - 12);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    };
    series.forEach(({ s, u }, i) => {
      draw(s, this.focus ? COLORS[0] : COLORS[i % COLORS.length]);
      if (u) draw(u, COLORS[3]);
    });
    g.fillStyle = 'rgba(232,223,207,0.7)';
    g.font = '11px system-ui';
    const step = STATS.windows[this.win].step;
    g.fillText(this.mode === 'power' ? fmtPower(max / (step * 60)) : `${fmtAmount(max)} je ${step} s`, 6, 13);
  }
}
