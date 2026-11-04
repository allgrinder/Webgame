import { MINIMAP } from '../data/ui';
import { RESOURCE_BY_INDEX } from '../data/resources';
import type { World } from '../sim/world';

/** Kleine Übersichtskarte aus den Kartendaten (Ressourcen, Wasser, Gebäude, Bänder, Spieler). */
export class Minimap {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private frame = 0;
  visible = true;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('canvas');
    this.el.className = 'minimap';
    this.el.width = MINIMAP.tiles;
    this.el.height = MINIMAP.tiles;
    const px = Math.round(MINIMAP.tiles * MINIMAP.scale);
    this.el.style.width = `${px}px`;
    this.el.style.height = `${px}px`;
    parent.appendChild(this.el);
    this.ctx = this.el.getContext('2d')!;
    this.img = this.ctx.createImageData(MINIMAP.tiles, MINIMAP.tiles);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  update(world: World, cx: number, cy: number, force = false): void {
    if (!this.visible) return;
    if (!force && this.frame++ % MINIMAP.every !== 0) return;
    const n = MINIMAP.tiles;
    const x0 = Math.floor(cx) - n / 2;
    const y0 = Math.floor(cy) - n / 2;
    const d = this.img.data;
    const put = (i: number, c: number) => {
      d[i] = (c >> 16) & 255;
      d[i + 1] = (c >> 8) & 255;
      d[i + 2] = c & 255;
      d[i + 3] = 255;
    };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const tx = x0 + x;
        const ty = y0 + y;
        const i = (y * n + x) * 4;
        if (world.map.isWater(tx, ty)) {
          put(i, MINIMAP.water);
          continue;
        }
        const r = world.map.resourceAt(tx, ty);
        const def = r.amount > 0 ? RESOURCE_BY_INDEX[r.res] : undefined;
        put(i, def ? def.mapColor : ((tx ^ ty) & 4 ? MINIMAP.grass : MINIMAP.grassDark));
      }
    }
    for (const e of world.entities.values()) {
      const col = e.kind === 'belt' || e.kind === 'underground' || e.kind === 'splitter' ? MINIMAP.belt : MINIMAP.building;
      for (let j = 0; j < e.h; j++) {
        for (let k = 0; k < e.w; k++) {
          const x = e.x + k - x0;
          const y = e.y + j - y0;
          if (x >= 0 && y >= 0 && x < n && y < n) put((y * n + x) * 4, col);
        }
      }
    }
    const p = world.player;
    if (p) {
      const px = Math.floor(p.px / 256) - x0;
      const py = Math.floor(p.py / 256) - y0;
      for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = px + ox;
        const y = py + oy;
        if (x >= 0 && y >= 0 && x < n && y < n) put((y * n + x) * 4, MINIMAP.player);
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
