// Kontaktbogen: alle Sprites (inkl. Animationsstreifen) und eine Testszene zur Kontrolle von
// Maßstab, Ausrichtung, Beschnitt und Nahtlosigkeit. Ausgabe: assets/preview/contact-sheet.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawText } from './lib/font.mjs';
import { Img } from './lib/image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/assets');
const PREV = path.join(root, 'assets/preview');
fs.mkdirSync(PREV, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
const frames = new Map();
for (const a of manifest.atlases) {
  const json = JSON.parse(fs.readFileSync(path.join(OUT, a.file), 'utf8'));
  const img = Img.read(path.join(OUT, json.meta.image));
  for (const [k, fr] of Object.entries(json.frames)) frames.set(k, img.crop(fr.frame.x, fr.frame.y, fr.frame.w, fr.frame.h));
}
const frame = (name, i = 0) => {
  const s = manifest.sprites[name];
  if (!s) return null;
  return frames.get(s.frames[i % s.frames.length]);
};
const T = 64;
const BG = [52, 70, 60, 255];

// ------------------------------------------------------------------ Testszene
function scene() {
  const W = 14;
  const H = 10;
  const img = new Img(W * T, H * T);
  const P = Object.keys(manifest.sprites).filter((n) => /^ground\.\d+\.0$/.test(n)).length || 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = frame(`ground.${x % P}.${y % P}`);
      if (g) img.blit(g, 0, 0, T, T, x * T, y * T);
    }
  const put = (name, tx, ty, i = 0) => {
    const f = frame(name, i);
    if (!f) return;
    const s = manifest.sprites[name];
    img.draw(f, Math.round(tx * T - s.anchor[0] * f.w), Math.round(ty * T - s.anchor[1] * f.h));
  };
  // Erzfelder mit Dichtestufen
  ['iron-ore', 'coal', 'stone'].forEach((r, k) => {
    for (let d = 0; d < 4; d++) for (let v = 0; v < 2; v++) put(`res.${r}.${(v + d) % 4}.${d}`, 0.5 + d, 0.5 + k * 2 + v);
  });
  // Bandschleife mit Kurven
  const belts = [
    ['r', 1, 1, 5], ['s', 1, 2, 5], ['r', 2, 3, 5], ['s', 2, 3, 6], ['r', 3, 3, 7], ['s', 3, 2, 7], ['r', 0, 1, 7], ['s', 0, 1, 6],
    ['s', 1, 4, 5], ['s', 1, 5, 5], ['l', 0, 6, 5], ['s', 0, 6, 4],
  ];
  for (const [sh, d, x, y] of belts) put(`belt.${sh}.${d}`, x + 0.5, y + 0.5, 0);
  for (const [x, y] of [[5.5, 3.6], [6.5, 4.4], [7.4, 3.5]]) put('item.iron-ore', x, y);
  // Gebäude mit Schatten
  const ent = (base, x, y, i = 0) => {
    put(`${base}.shadow`, x, y);
    put(base, x, y, i);
  };
  ent('drill.2', 10, 2);
  ent('drill.1', 12.5, 2);
  put('furnace.shadow', 10, 6);
  put('furnace.on', 10, 6);
  put('furnace.glow', 10, 6, 0);
  put('furnace.shadow', 12.5, 6);
  put('furnace.off', 12.5, 6);
  put('inserter.shadow', 10.5, 8.5);
  put('inserter.base', 10.5, 8.5);
  put('inserter.arm', 10.5, 8.5);
  put('player.2', 12.5, 8.6, 0);
  return img;
}

// ------------------------------------------------------------------ Sprite-Übersicht
const names = Object.keys(manifest.sprites).sort();
const rows = [];
let row = [];
let rowW = 0;
const MAXW = 1800;
for (const n of names) {
  const s = manifest.sprites[n];
  const strip = s.frames.length > 1;
  const cellW = Math.max(strip ? Math.min(s.frames.length, 16) * (s.w + 2) : s.w, n.length * 6) + 12;
  if (rowW + cellW > MAXW) {
    rows.push(row);
    row = [];
    rowW = 0;
  }
  row.push({ n, s, cellW });
  rowW += cellW;
}
if (row.length) rows.push(row);
const rowH = rows.map((r) => Math.max(...r.map((c) => c.s.h)) + 22);
const sc = scene();
const totalH = sc.h + 40 + rowH.reduce((a, b) => a + b, 0) + 20;
const sheet = new Img(MAXW + 20, totalH);
sheet.fillRect(0, 0, sheet.w, sheet.h, [40, 38, 34, 255]);
drawText(sheet, 10, 8, `EISENWERK KONTAKTBOGEN - ${manifest.generator} - ${names.length} SPRITES`, [240, 190, 90, 255], 2);
sheet.blit(sc, 0, 0, sc.w, sc.h, 10, 30);
let y = sc.h + 50;
rows.forEach((r, ri) => {
  let x = 10;
  for (const { n, s, cellW } of r) {
    drawText(sheet, x, y, n);
    const count = s.frames.length > 1 ? Math.min(s.frames.length, 16) : 1;
    for (let i = 0; i < count; i++) {
      const fx = x + i * (s.w + 2);
      sheet.fillRect(fx, y + 10, s.w, s.h, BG);
      const f = frames.get(s.frames[i]);
      sheet.draw(f, fx, y + 10);
      // Ankerkreuz
      const ax = Math.round(fx + s.anchor[0] * s.w);
      const ay = Math.round(y + 10 + s.anchor[1] * s.h);
      sheet.fillRect(ax - 2, ay, 5, 1, [255, 60, 60, 255]);
      sheet.fillRect(ax, ay - 2, 1, 5, [255, 60, 60, 255]);
    }
    x += cellW;
  }
  y += rowH[ri];
});
const file = path.join(PREV, 'contact-sheet.png');
sheet.write(file);
sc.write(path.join(PREV, 'scene.png'));
console.log(`Kontaktbogen: ${file} (${sheet.w}×${sheet.h})`);

// ------------------------------------------------------------------ Kompaktübersicht (Items, Symbole, Gebäude)
{
  const pick = names.filter((n) => !/^(belt|ground|res)\./.test(n));
  const cell = 230;
  const cols = 8;
  const rowsN = Math.ceil(pick.length / cols);
  const img = new Img(cols * cell, rowsN * cell);
  img.fillRect(0, 0, img.w, img.h, [86, 76, 58, 255]);
  pick.forEach((n, i) => {
    const s = manifest.sprites[n];
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    img.fillRect(x + 2, y + 2, cell - 4, cell - 4, [96, 85, 66, 255]);
    drawText(img, x + 6, y + 6, n);
    const f = frames.get(s.frames[0]);
    const sc = Math.min(2, Math.floor(200 / Math.max(f.w, f.h)) || 1);
    img.draw(f, x + (cell - f.w * sc) / 2, y + 20 + (cell - 20 - f.h * sc) / 2, sc);
  });
  img.write(path.join(PREV, 'objects.png'));
}
