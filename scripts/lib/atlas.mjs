// Packt Einzelbilder zu Texturatlanten (PixiJS-Spritesheet-JSON) und schreibt manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import { Img } from './image.mjs';

const MAX = 2048;
const PAD = 1; // Rand mit Kantenwiederholung gegen Texturbluten

/**
 * @param {string} outDir
 * @param {{name:string, group:string, frames:Img[], anchor:[number,number], fps?:number}[]} sprites
 * @param {object} extra  zusätzliche Felder für manifest.json
 */
export function writeAtlases(outDir, sprites, extra = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (/^atlas-.*\.(png|json)$/.test(f)) fs.rmSync(path.join(outDir, f));
  }
  const groups = new Map();
  for (const s of sprites) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push(s);
  }
  const manifest = { version: 1, tileSize: 64, ...extra, atlases: [], sprites: {} };
  for (const [group, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Frames sammeln und nach Höhe sortieren (Regalpacken)
    const frames = [];
    for (const s of list) {
      s.frames.forEach((img, i) => frames.push({ key: `${s.name}#${i}`, img, sprite: s }));
    }
    frames.sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w || a.key.localeCompare(b.key));
    let pageIndex = 0;
    let remaining = frames;
    while (remaining.length) {
      const { placed, rest, w, h } = packPage(remaining);
      if (!placed.length) throw new Error(`Frame zu groß für Atlas: ${remaining[0].key}`);
      const page = new Img(w, h);
      const json = { frames: {}, meta: { image: '', format: 'RGBA8888', size: { w, h }, scale: 1 } };
      for (const p of placed) {
        const { img } = p;
        page.blit(img, 0, 0, img.w, img.h, p.x + PAD, p.y + PAD);
        extrude(page, p.x + PAD, p.y + PAD, img.w, img.h);
        json.frames[p.key] = {
          frame: { x: p.x + PAD, y: p.y + PAD, w: img.w, h: img.h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: img.w, h: img.h },
          sourceSize: { w: img.w, h: img.h },
          anchor: { x: p.sprite.anchor[0], y: p.sprite.anchor[1] },
        };
      }
      const base = `atlas-${group}-${pageIndex}`;
      json.meta.image = `${base}.png`;
      page.write(path.join(outDir, `${base}.png`));
      fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(json));
      manifest.atlases.push({ group, file: `${base}.json` });
      remaining = rest;
      pageIndex++;
    }
    for (const s of list.sort((a, b) => a.name.localeCompare(b.name))) {
      manifest.sprites[s.name] = {
        group,
        frames: s.frames.map((_, i) => `${s.name}#${i}`),
        w: s.frames[0].w,
        h: s.frames[0].h,
        anchor: s.anchor,
        ...(s.fps ? { fps: s.fps } : {}),
        ...(s.meta ? { meta: s.meta } : {}),
      };
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
}

function packPage(frames) {
  // Breite wählen: kleinste Zweierpotenz, in die alles (geschätzt) passt
  const area = frames.reduce((s, f) => s + (f.img.w + 2 * PAD) * (f.img.h + 2 * PAD), 0);
  let w = 256;
  while (w < MAX && w * w < area * 1.15) w *= 2;
  const placed = [];
  const rest = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const f of frames) {
    const fw = f.img.w + 2 * PAD;
    const fh = f.img.h + 2 * PAD;
    if (fw > w) { rest.push(f); continue; }
    if (x + fw > w) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    if (y + fh > MAX) { rest.push(f); continue; }
    placed.push({ ...f, x, y });
    x += fw;
    rowH = Math.max(rowH, fh);
  }
  let h = 1;
  while (h < y + rowH) h *= 2;
  return { placed, rest, w, h };
}

function extrude(page, x, y, w, h) {
  for (let i = 0; i < w; i++) {
    page.set(x + i, y - 1, page.get(x + i, y));
    page.set(x + i, y + h, page.get(x + i, y + h - 1));
  }
  for (let j = -1; j <= h; j++) {
    page.set(x - 1, y + j, page.get(x, Math.min(y + h - 1, Math.max(y, y + j))));
    page.set(x + w, y + j, page.get(x + w - 1, Math.min(y + h - 1, Math.max(y, y + j))));
  }
}
