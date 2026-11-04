import { ITEMS } from '../data/items';
import { MJ } from '../data/time';
import type { RecipeDef } from '../data/recipes';

/** Ein gemeinsames Tooltip-Fenster für Slots und Rezepte (folgt der Maus). */
export class Tooltip {
  readonly el: HTMLDivElement;

  constructor(parent: HTMLElement, private readonly iconUrl: (name: string) => string) {
    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    parent.appendChild(this.el);
    window.addEventListener('pointermove', (e) => {
      if (this.el.style.display !== 'block') return;
      const w = this.el.offsetWidth;
      const h = this.el.offsetHeight;
      const x = Math.min(window.innerWidth - w - 6, e.clientX + 16);
      const y = Math.min(window.innerHeight - h - 6, e.clientY + 16);
      this.el.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  /** Tooltip an ein Element hängen; build wird beim Überfahren aufgerufen (aktuelle Werte). */
  attach(target: HTMLElement, build: () => HTMLElement | null): void {
    target.addEventListener('pointerenter', () => {
      const c = build();
      if (!c) return;
      this.el.replaceChildren(c);
      this.el.style.display = 'block';
    });
    target.addEventListener('pointerleave', () => this.hide());
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  private icon(item: string): HTMLImageElement {
    const img = document.createElement('img');
    img.className = 'icon';
    img.src = this.iconUrl(`item.${item}`);
    return img;
  }

  /** Inhalt für ein Item (Name, Stapel, Brennwert, Bau). */
  item(id: string, count?: number): HTMLElement {
    const def = ITEMS[id];
    const box = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'tt-head';
    head.textContent = `${def?.name ?? id}${count ? ` (${count})` : ''}`;
    box.appendChild(head);
    const lines: string[] = [`Stapel: ${def?.stackSize ?? 1}`];
    if (def?.fuelValue) lines.push(`Brennwert: ${(def.fuelValue / MJ).toFixed(1)} MJ`);
    if (def?.placeResult) lines.push('Baubar');
    for (const l of lines) {
      const d = document.createElement('div');
      d.className = 'tt-line';
      d.textContent = l;
      box.appendChild(d);
    }
    return box;
  }

  /** Inhalt für ein Rezept: Ergebnis, Zutaten mit Symbolen, Zeit, optional verfügbare Menge. */
  recipe(r: RecipeDef, speed = 1, craftable?: number): HTMLElement {
    const box = document.createElement('div');
    const res = r.results[0];
    const head = document.createElement('div');
    head.className = 'tt-head';
    head.textContent = `${ITEMS[res.item]?.name ?? res.item}${res.amount > 1 ? ` ×${res.amount}` : ''}`;
    box.appendChild(head);
    const ing = document.createElement('div');
    ing.className = 'tt-ings';
    for (const g of r.ingredients) {
      const row = document.createElement('div');
      row.className = 'tt-ing';
      row.appendChild(this.icon(g.item));
      const t = document.createElement('span');
      t.textContent = `${g.amount} × ${ITEMS[g.item]?.name ?? g.item}`;
      row.appendChild(t);
      ing.appendChild(row);
    }
    box.appendChild(ing);
    const time = document.createElement('div');
    time.className = 'tt-line';
    time.textContent = `Zeit: ${(r.time / speed).toLocaleString('de-DE', { maximumFractionDigits: 2 })} s`;
    box.appendChild(time);
    if (craftable !== undefined) {
      const c = document.createElement('div');
      c.className = 'tt-line dim';
      c.textContent = craftable > 0 ? `Herstellbar: ${craftable}` : 'Zutaten fehlen';
      box.appendChild(c);
    }
    return box;
  }
}
