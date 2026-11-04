// Erzeugt einfache Platzhaltergrafik im selben manifest.json-Format wie die Blender-Pipeline.
// Aufruf: npm run assets:placeholder
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAtlases } from './lib/atlas.mjs';
import { Img, h01 } from './lib/image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/assets');
const T = 64;
const BELT_FRAMES = 16;

const sprites = [];
const add = (name, group, frames, anchor = [0.5, 0.5], fps) => sprites.push({ name, group, frames, anchor, fps });

function rot(x, y, d) {
  switch (d) {
    case 0: return [x, y];
    case 1: return [-y, x];
    case 2: return [-x, -y];
    default: return [y, -x];
  }
}

// Boden
for (let v = 0; v < 8; v++) {
  const img = new Img(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const n = h01(v, x >> 2, y >> 2) * 0.5 + h01(v, x, y) * 0.5;
      const b = 70 + n * 18;
      img.set(x, y, [b + 10, b + 4, b - 12, 255]);
    }
  add(`ground.${v}`, 'terrain', [img]);
}

// Ressourcen
const RES = { 'iron-ore': [92, 112, 134], coal: [28, 28, 30], stone: [170, 150, 118] };
for (const [res, col] of Object.entries(RES)) {
  for (let v = 0; v < 4; v++)
    for (let d = 0; d < 4; d++) {
      const img = new Img(T, T);
      const count = 3 + d * 3;
      for (let k = 0; k < count; k++) {
        const x = 6 + h01(v, d, k, 1) * 52;
        const y = 6 + h01(v, d, k, 2) * 52;
        const r = 3 + h01(v, d, k, 3) * 4;
        img.fillCircle(x + 1, y + 2, r, [0, 0, 0, 90]);
        img.fillCircle(x, y, r, [...col, 255]);
        img.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4, [Math.min(255, col[0] + 50), Math.min(255, col[1] + 50), Math.min(255, col[2] + 50), 200]);
      }
      add(`res.${res}.${v}.${d}`, 'terrain', [img]);
    }
}

// Bänder: Form s(gerade), l(Linkskurve), r(Rechtskurve) × Richtung × Frames
for (const shape of ['s', 'l', 'r']) {
  for (let dir = 0; dir < 4; dir++) {
    const frames = [];
    for (let f = 0; f < BELT_FRAMES; f++) {
      const img = new Img(T, T);
      for (let py = 0; py < T; py++)
        for (let px = 0; px < T; px++) {
          const [cx, cy] = rot((px + 0.5) / T - 0.5, (py + 0.5) / T - 0.5, (4 - dir) % 4);
          const u = cx + 0.5;
          const v = cy + 0.5;
          let across;
          let along;
          if (shape === 's') {
            across = u;
            along = 1 - v;
          } else if (shape === 'l') {
            const r = Math.hypot(u, v);
            if (r > 1) continue;
            across = r;
            along = (Math.atan2(u, v) / (Math.PI / 2)) * (Math.PI / 4) * 1.0;
          } else {
            const r = Math.hypot(1 - u, v);
            if (r > 1) continue;
            across = 1 - r;
            along = (Math.atan2(1 - u, v) / (Math.PI / 2)) * (Math.PI / 4);
          }
          if (across < 0.06 || across > 0.94) {
            img.set(px, py, [58, 54, 48, 255]);
            continue;
          }
          if (across < 0.1 || across > 0.9) {
            img.set(px, py, [96, 88, 70, 255]);
            continue;
          }
          const phase = (((along * T - f * 2) % 32) + 32) % 32;
          const rib = phase < 4;
          const b = rib ? 74 : 46;
          img.set(px, py, [b, b - 2, b - 6, 255]);
        }
      frames.push(img);
    }
    add(`belt.${shape}.${dir}`, 'belts', frames, [0.5, 0.5], 60);
  }
}

// Bohrer 2×2
for (let dir = 0; dir < 4; dir++) {
  const frames = [];
  for (let f = 0; f < 8; f++) {
    const img = new Img(2 * T, 2 * T);
    img.fillRect(6, 6, 116, 116, [88, 74, 58, 255]);
    img.fillRect(14, 14, 100, 100, [112, 96, 72, 255]);
    const a = (f / 8) * Math.PI * 2;
    img.line(64, 64, 64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34, 8, [60, 60, 62, 255]);
    img.fillCircle(64, 64, 12, [140, 130, 110, 255]);
    const [ox, oy] = rot(-0.35, -1.3, dir);
    img.fillCircle(64 + ox * 40, 64 + oy * 40, 7, [210, 160, 40, 255]);
    frames.push(img);
  }
  add(`drill.${dir}`, 'entities', frames, [0.5, 0.5], 15);
  const sh = new Img(2 * T + 24, 2 * T + 24);
  sh.fillRect(16, 16, 120, 120, [0, 0, 0, 90]);
  add(`drill.${dir}.shadow`, 'entities', [sh], [0.4, 0.4]);
}

// Ofen
for (const state of ['off', 'on']) {
  const img = new Img(2 * T, 2 * T);
  img.fillRect(8, 8, 112, 112, [120, 104, 88, 255]);
  img.fillRect(16, 16, 96, 96, [140, 122, 100, 255]);
  img.fillRect(40, 60, 48, 40, state === 'on' ? [255, 150, 40, 255] : [30, 26, 24, 255]);
  add(`furnace.${state}`, 'entities', [img]);
}
{
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const img = new Img(2 * T, 2 * T);
    img.fillCircle(64, 80, 30 + f * 2, [255, 140, 40, 60 + f * 15]);
    frames.push(img);
  }
  add('furnace.glow', 'entities', frames, [0.5, 0.5], 12);
  const sh = new Img(2 * T + 24, 2 * T + 24);
  sh.fillRect(16, 16, 116, 116, [0, 0, 0, 90]);
  add('furnace.shadow', 'entities', [sh], [0.4, 0.4]);
}

// Greifarm
{
  const base = new Img(T, T);
  base.fillCircle(32, 32, 20, [70, 66, 60, 255]);
  base.fillCircle(32, 32, 12, [150, 110, 40, 255]);
  add('inserter.base', 'entities', [base]);
  const arm = new Img(24, 80);
  arm.fillRect(8, 6, 8, 70, [180, 140, 50, 255]);
  arm.fillRect(4, 0, 16, 10, [90, 90, 90, 255]);
  // Drehpunkt unten (Sockelmitte), Arm zeigt nach oben
  add('inserter.arm', 'entities', [arm], [0.5, 0.9]);
  const sh = new Img(T, T);
  sh.fillCircle(36, 36, 20, [0, 0, 0, 80]);
  add('inserter.shadow', 'entities', [sh], [0.5, 0.5]);
}

// Spieler: 4 Richtungen × 8 Frames
for (let dir = 0; dir < 4; dir++) {
  const frames = [];
  for (let f = 0; f < 8; f++) {
    const img = new Img(48, 64);
    const bob = Math.sin((f / 8) * Math.PI * 2) * 2;
    img.fillCircle(24, 56, 10, [0, 0, 0, 60]);
    img.fillRect(14, 22 + bob, 20, 28, [200, 120, 40, 255]);
    img.fillCircle(24, 16 + bob, 9, [220, 190, 150, 255]);
    const [fx, fy] = rot(0, -1, dir);
    img.fillCircle(24 + fx * 5, 16 + bob + fy * 3, 3, [40, 40, 40, 255]);
    frames.push(img);
  }
  add(`player.${dir}`, 'entities', frames, [0.5, 0.85], 12);
}

// Items
function icon(drawFn) {
  const img = new Img(T, T);
  drawFn(img);
  return [img];
}
add('item.iron-ore', 'items', icon((i) => { for (let k = 0; k < 4; k++) i.fillCircle(20 + (k % 2) * 22, 22 + (k >> 1) * 20, 13, [92, 112, 134, 255]); }));
add('item.coal', 'items', icon((i) => { for (let k = 0; k < 4; k++) i.fillCircle(20 + (k % 2) * 22, 22 + (k >> 1) * 20, 13, [30, 30, 32, 255]); }));
add('item.stone', 'items', icon((i) => { for (let k = 0; k < 3; k++) i.fillCircle(20 + k * 12, 30 + (k % 2) * 8, 14, [170, 150, 118, 255]); }));
add('item.iron-plate', 'items', icon((i) => { i.fillRect(10, 14, 44, 36, [120, 124, 132, 255]); i.fillRect(14, 18, 36, 28, [170, 176, 186, 255]); }));
add('item.iron-gear-wheel', 'items', icon((i) => {
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; i.fillCircle(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22, 6, [140, 144, 150, 255]); }
  i.fillCircle(32, 32, 22, [140, 144, 150, 255]); i.fillCircle(32, 32, 8, [0, 0, 0, 0]);
}));
add('item.transport-belt', 'items', icon((i) => { i.fillRect(10, 20, 44, 24, [60, 58, 52, 255]); for (let k = 0; k < 5; k++) i.fillRect(12 + k * 9, 22, 3, 20, [210, 170, 40, 255]); }));
add('item.burner-inserter', 'items', icon((i) => { i.fillCircle(32, 46, 12, [80, 76, 70, 255]); i.line(32, 46, 32, 12, 7, [180, 140, 50, 255]); }));
add('item.burner-mining-drill', 'items', icon((i) => { i.fillRect(10, 10, 44, 44, [112, 96, 72, 255]); i.fillCircle(32, 32, 10, [60, 60, 62, 255]); }));
add('item.stone-furnace', 'items', icon((i) => { i.fillRect(10, 10, 44, 44, [140, 122, 100, 255]); i.fillRect(22, 30, 20, 16, [30, 26, 24, 255]); }));

// Statussymbole
add('icon.nofuel', 'items', icon((i) => {
  i.fillPoly([[32, 6], [60, 56], [4, 56]], [230, 60, 40, 255]);
  i.fillPoly([[32, 14], [53, 51], [11, 51]], [250, 200, 50, 255]);
  i.fillRect(29, 24, 6, 16, [30, 20, 10, 255]);
  i.fillRect(29, 43, 6, 5, [30, 20, 10, 255]);
}));
add('icon.blocked', 'items', icon((i) => {
  i.fillCircle(32, 32, 26, [230, 60, 40, 255]);
  i.fillCircle(32, 32, 20, [250, 200, 50, 255]);
  i.fillRect(16, 28, 32, 8, [30, 20, 10, 255]);
}));

const m = writeAtlases(OUT, sprites, { generator: 'placeholder' });
console.log(`Platzhalter: ${Object.keys(m.sprites).length} Sprites, ${m.atlases.length} Atlanten -> ${OUT}`);
