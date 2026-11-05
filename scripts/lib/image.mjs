// Minimales RGBA-Bild mit Zeichenfunktionen (für Platzhalter, Atlas und Kontaktbogen).
import fs from 'node:fs';
import { PNG } from 'pngjs';

export class Img {
  constructor(w, h, data) {
    this.w = w;
    this.h = h;
    this.data = data ?? Buffer.alloc(w * h * 4);
  }

  static read(file) {
    const png = PNG.sync.read(fs.readFileSync(file));
    return new Img(png.width, png.height, png.data);
  }

  write(file) {
    const png = new PNG({ width: this.w, height: this.h });
    this.data.copy(png.data);
    fs.writeFileSync(file, PNG.sync.write(png, { colorType: 6 }));
  }

  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Pixel mit Alpha-Überblendung setzen. c = [r,g,b,a] (0..255) */
  blend(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] / 255;
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round((c[k] * a + this.data[i + k] * da * (1 - a)) / oa);
    }
    this.data[i + 3] = Math.round(oa * 255);
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }

  fillRect(x0, y0, w, h, c) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y0 + h)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x0 + w)); x++) this.blend(x, y, c);
  }

  fillCircle(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) this.blend(x, y, c);
      }
  }

  line(x0, y0, x1, y1, width, c) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, c);
    }
  }

  /** Polygon füllen (Liste [x,y]). */
  fillPoly(pts, c) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        const yy = y + 0.5;
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.blend(x, y, c);
    }
  }

  /** Bild an Position zeichnen (Alpha-Überblendung, optional skaliert mit nächstem Nachbarn). */
  draw(src, dx, dy, scale = 1) {
    const w = Math.round(src.w * scale);
    const h = Math.round(src.h * scale);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = src.get(Math.min(src.w - 1, Math.floor(x / scale)), Math.min(src.h - 1, Math.floor(y / scale)));
        if (c[3] > 0) this.blend(dx + x, dy + y, c);
      }
  }

  /** Rohes Kopieren eines Ausschnitts (ohne Blending). */
  blit(src, sx, sy, w, h, dx, dy) {
    for (let y = 0; y < h; y++) {
      const si = ((sy + y) * src.w + sx) * 4;
      const di = ((dy + y) * this.w + dx) * 4;
      src.data.copy(this.data, di, si, si + w * 4);
    }
  }

  /** Halbe Größe (2×2-Mittel, alphagewichtet). */
  half() {
    const w = Math.max(1, this.w >> 1);
    const h = Math.max(1, this.h >> 1);
    const out = new Img(w, h);
    const d = this.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const sx = Math.min(this.w - 1, x * 2 + i);
            const sy = Math.min(this.h - 1, y * 2 + j);
            const k = (sy * this.w + sx) * 4;
            const al = d[k + 3];
            r += d[k] * al;
            g += d[k + 1] * al;
            b += d[k + 2] * al;
            a += al;
          }
        }
        const o = (y * w + x) * 4;
        if (a > 0) {
          out.data[o] = Math.round(r / a);
          out.data[o + 1] = Math.round(g / a);
          out.data[o + 2] = Math.round(b / a);
        }
        out.data[o + 3] = Math.round(a / 4);
      }
    }
    return out;
  }

  crop(x, y, w, h) {
    const out = new Img(w, h);
    out.blit(this, x, y, w, h, 0, 0);
    return out;
  }
}

/** Deterministischer Hash für Platzhalter-Rauschen. */
export function h01(...v) {
  let h = 2166136261;
  for (const x of v) {
    h ^= x | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 100000) / 100000;
}
