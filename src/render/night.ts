import { Container, Graphics, type Renderer, RenderTexture, Sprite, type Texture } from 'pixi.js';
import { NIGHT } from '../data/fx';
import { Status } from '../sim/entity';
import type { World } from '../sim/world';
import type { Camera } from './renderer';
import type { SpriteLib } from './assets';

/**
 * Dunkelheit bei Nacht: eine bildschirmgroße Ebene, in die Lichter (Lampen, Feuer, Taschenlampe) per
 * „erase“ hineinradiert werden. Wird je Bild in eine RenderTexture gezeichnet und über die Welt gelegt.
 */
export class NightLayer {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private readonly scene = new Container();
  private readonly dark = new Graphics();
  private readonly lights: Sprite[] = [];
  private readonly lightTex: Texture | null;

  constructor(sprites: SpriteLib, private readonly renderer: Renderer, private readonly tile: number) {
    this.rt = RenderTexture.create({ width: 16, height: 16 });
    this.sprite = new Sprite(this.rt);
    this.sprite.visible = false;
    this.scene.addChild(this.dark);
    this.lightTex = sprites.has('fx.light') ? sprites.frame('fx.light') : null;
  }

  update(world: World, cam: Camera, w: number, h: number): void {
    const d = world.darkness;
    if (d < 0.01) {
      this.sprite.visible = false;
      return;
    }
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.resize(w, h);
    }
    this.dark.clear().rect(0, 0, w, h).fill({ color: NIGHT.color, alpha: NIGHT.alpha * d });
    let n = 0;
    const T = this.tile * cam.zoom;
    const toX = (x: number) => w / 2 + (x - cam.x) * T;
    const toY = (y: number) => h / 2 + (y - cam.y) * T;
    const light = (x: number, y: number, r: number, a: number) => {
      if (!this.lightTex) return;
      const sx = toX(x);
      const sy = toY(y);
      if (sx < -r * T || sy < -r * T || sx > w + r * T || sy > h + r * T) return;
      let s = this.lights[n];
      if (!s) {
        s = new Sprite(this.lightTex);
        s.anchor.set(0.5);
        s.blendMode = 'erase';
        this.lights.push(s);
        this.scene.addChild(s);
      }
      s.visible = true;
      s.position.set(sx, sy);
      s.scale.set((2 * r * T) / this.lightTex.width);
      s.alpha = a;
      n++;
    };
    for (const e of world.entities.values()) {
      if (e.status !== Status.Working) continue;
      if (e.kind === 'lamp') light(e.cx, e.cy, NIGHT.lampRadius, 1);
      else if (e.kind === 'furnace' || e.kind === 'boiler') light(e.cx, e.cy + e.h * 0.4, NIGHT.fireRadius, 0.8);
    }
    const p = world.player;
    if (p) light(p.px / 256, p.py / 256 - 0.4, NIGHT.playerRadius, 0.85);
    for (let i = n; i < this.lights.length; i++) this.lights[i].visible = false;
    this.renderer.render({ container: this.scene, target: this.rt, clear: true });
    this.sprite.visible = true;
  }
}
