import { CLOUDS } from '../data/fx';
import { hash01 } from '../sim/rng';
import type { World } from '../sim/world';
import type { SpriteLib } from './assets';
import type { SpritePool } from './pools';

/** Ziehende Wolkenschatten über Landschaft und Gebäuden (deterministisch aus Seed und Zeit). */
export class CloudShadows {
  private readonly tex;
  private readonly scale: number;

  constructor(sprites: SpriteLib, private readonly pool: SpritePool, private readonly tile: number) {
    const list = [];
    for (let i = 0; sprites.has(`fx.cloud.${i}`); i++) list.push(sprites.frame(`fx.cloud.${i}`));
    this.tex = list;
    this.scale = sprites.info('fx.cloud.0')?.meta?.scale ?? 1;
  }

  update(world: World, alpha: number, view: { x0: number; y0: number; x1: number; y1: number }): void {
    this.pool.begin();
    if (this.tex.length) {
      const t = (world.tick + alpha) / 60;
      const ox = CLOUDS.windX * t;
      const oy = CLOUDS.windY * t;
      const C = CLOUDS.cell;
      const margin = C * 0.6;
      // Raster im mitziehenden Bezugssystem
      for (let gy = Math.floor((view.y0 - oy - margin) / C); gy <= Math.floor((view.y1 - oy + margin) / C); gy++) {
        for (let gx = Math.floor((view.x0 - ox - margin) / C); gx <= Math.floor((view.x1 - ox + margin) / C); gx++) {
          const h = (k: number) => hash01(world.seed ^ 0xc10d, gx, gy, k);
          if (h(1) >= CLOUDS.chance) continue;
          const x = (gx + 0.2 + 0.6 * h(2)) * C + ox;
          const y = (gy + 0.2 + 0.6 * h(3)) * C + oy;
          const s = this.pool.get(this.tex[Math.floor(h(4) * this.tex.length)]);
          s.position.set(x * this.tile, y * this.tile);
          s.scale.set(this.scale * (CLOUDS.sizeMin + (CLOUDS.sizeMax - CLOUDS.sizeMin) * h(5)));
          s.rotation = h(6) * Math.PI * 2;
          s.alpha = CLOUDS.alpha;
        }
      }
    }
    this.pool.end();
  }
}
