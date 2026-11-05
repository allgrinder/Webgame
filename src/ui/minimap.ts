import { MAPGEN } from '../data/mapgen';
import { RESOURCE_BY_INDEX } from '../data/resources';
import { MINIMAP } from '../data/ui';
import type { BiomeField } from '../render/biome';
import type { World } from '../sim/world';

interface TerrainChunk {
  canvas: HTMLCanvasElement;
  frame: number;
}

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Farbe multiplizieren (Bodenton × Landschaftsfarbe). */
function mul(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
  const bl = ((a & 255) * (b & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/**
 * Übersichtskarte: Gelände je Chunk zwischengespeichert (Landschaftsfarbe, Wasser, Erz), darüber Gebäude,
 * Bänder, Spieler und der sichtbare Ausschnitt. Ohne Spieler (Sandkasten/Demo) verschiebt ein Klick die Kamera.
 */
export class Minimap {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrain = new Map<number, TerrainChunk>();
  private frame = 0;
  private sizeIdx = 0;
  private center = { x: 0, y: 0 };
  /** Klick auf die Karte (Weltkoordinaten). */
  onPick: ((x: number, y: number) => void) | null = null;

  constructor(parent: HTMLElement, private readonly biome: () => BiomeField | null) {
    this.el = document.createElement('canvas');
    this.el.className = 'minimap';
    parent.appendChild(this.el);
    this.ctx = this.el.getContext('2d')!;
    this.applySize();
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.onPick) return;
      const r = this.el.getBoundingClientRect();
      const s = MINIMAP.sizes[this.sizeIdx];
      const x = this.center.x + (e.clientX - r.left - s.px / 2) / s.scale;
      const y = this.center.y + (e.clientY - r.top - s.px / 2) / s.scale;
      this.onPick(x, y);
      e.stopPropagation();
    });
  }

  get visible(): boolean {
    return this.sizeIdx < MINIMAP.sizes.length;
  }

  /** Klein → groß → aus → klein. */
  toggle(): void {
    this.sizeIdx = (this.sizeIdx + 1) % (MINIMAP.sizes.length + 1);
    this.applySize();
    this.frame = 0;
  }

  private applySize(): void {
    if (!this.visible) {
      this.el.style.display = 'none';
      return;
    }
    const s = MINIMAP.sizes[this.sizeIdx];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.el.width = Math.round(s.px * dpr);
    this.el.height = Math.round(s.px * dpr);
    this.el.style.width = `${s.px}px`;
    this.el.style.height = `${s.px}px`;
    this.el.style.display = 'block';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private chunkCanvas(world: World, cx: number, cy: number): HTMLCanvasElement {
    const key = (cx + 32768) * 65536 + (cy + 32768);
    let t = this.terrain.get(key);
    if (t && this.frame - t.frame < MINIMAP.terrainRefresh) return t.canvas;
    const CS = MAPGEN.chunkSize;
    const canvas = t?.canvas ?? document.createElement('canvas');
    canvas.width = CS;
    canvas.height = CS;
    const c = canvas.getContext('2d')!;
    const img = c.createImageData(CS, CS);
    const chunk = world.map.getChunk(cx, cy);
    const bio = this.biome();
    for (let i = 0; i < CS * CS; i++) {
      const tx = cx * CS + (i % CS);
      const ty = cy * CS + Math.floor(i / CS);
      let col: number;
      if (chunk.water[i]) {
        col = MINIMAP.water;
      } else if (chunk.amount[i] > 0) {
        col = RESOURCE_BY_INDEX[chunk.resource[i]]?.mapColor ?? MINIMAP.groundBase;
      } else {
        col = mul(MINIMAP.groundBase, bio ? bio.color(tx, ty) : 0xffffff);
        // feine Körnung, damit die Fläche nicht glatt wirkt
        const n = (chunk.ground[i] & 7) - 3;
        col = ((Math.max(0, Math.min(255, ((col >> 16) & 255) + n)) << 16) | (Math.max(0, Math.min(255, ((col >> 8) & 255) + n)) << 8) | Math.max(0, Math.min(255, (col & 255) + n)));
      }
      img.data[i * 4] = (col >> 16) & 255;
      img.data[i * 4 + 1] = (col >> 8) & 255;
      img.data[i * 4 + 2] = col & 255;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    if (t) t.frame = this.frame;
    else this.terrain.set(key, (t = { canvas, frame: this.frame }));
    return canvas;
  }

  /** view: sichtbarer Bereich in Feldern (für den Rahmen). */
  update(world: World, cx: number, cy: number, view: { x0: number; y0: number; x1: number; y1: number }): void {
    if (!this.visible) return;
    if (this.frame++ % MINIMAP.every !== 0) return;
    const s = MINIMAP.sizes[this.sizeIdx];
    const ctx = this.ctx;
    this.center = { x: cx, y: cy };
    const half = s.px / 2 / s.scale;
    const x0 = cx - half;
    const y0 = cy - half;
    const toX = (x: number) => (x - x0) * s.scale;
    const toY = (y: number) => (y - y0) * s.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1d1b17';
    ctx.fillRect(0, 0, s.px, s.px);
    const CS = MAPGEN.chunkSize;
    for (let gy = Math.floor(y0 / CS); gy <= Math.floor((y0 + 2 * half) / CS); gy++) {
      for (let gx = Math.floor(x0 / CS); gx <= Math.floor((x0 + 2 * half) / CS); gx++) {
        ctx.drawImage(this.chunkCanvas(world, gx, gy), toX(gx * CS), toY(gy * CS), CS * s.scale + 0.5, CS * s.scale + 0.5);
      }
    }
    for (const e of world.entities.values()) {
      if (e.x + e.w < x0 || e.y + e.h < y0 || e.x > x0 + 2 * half || e.y > y0 + 2 * half) continue;
      ctx.fillStyle = css(e.kind === 'belt' || e.kind === 'underground' || e.kind === 'splitter' ? MINIMAP.belt : MINIMAP.building);
      ctx.fillRect(toX(e.x), toY(e.y), Math.max(1, e.w * s.scale), Math.max(1, e.h * s.scale));
    }
    // sichtbarer Ausschnitt
    ctx.strokeStyle = MINIMAP.view;
    ctx.lineWidth = 1;
    ctx.strokeRect(toX(view.x0) + 0.5, toY(view.y0) + 0.5, (view.x1 - view.x0) * s.scale, (view.y1 - view.y0) * s.scale);
    const p = world.player;
    if (p) {
      const px = toX(p.px / 256);
      const py = toY(p.py / 256);
      ctx.fillStyle = css(MINIMAP.player);
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
