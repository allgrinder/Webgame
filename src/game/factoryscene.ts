import { drillField, mall, smelterColumn, solarTile, steamBlockDouble } from '../data/blueprints';
import { LEGACY_MAP_SETTINGS } from '../data/mapgen';
import { resourceById } from '../data/resources';
import { type Blueprint, applySettings, placed } from '../sim/blueprint';
import type { Dir } from '../sim/geom';
import { type AssemblerEntity, type Entity, type LabEntity, insertInto, itemIndex } from '../sim/machines';
import { World } from '../sim/world';
import type { Scene } from './scenes';

/**
 * Großfabrik als feste Messszene (Skill performance-optimization: „a repeatable worst-case scene, fixed seed“):
 * Strom aus zwei Dampfblöcken und Solar, 8 Bohrerfelder, 6 Ofenreihen, 2 Malls, ein Feld Zahnrad-Montagemaschinen,
 * Labore und Bandschleifen – alles aus den Bauplänen in `src/data/blueprints.ts`, mit Vorräten gefüllt.
 * Aufruf: `?scene=factory`, Messung in `tests/sim/bench.test.ts` und `e2e/perf.spec.ts`.
 */
export function factoryScene(): Scene {
  const w = buildFactoryWorld();
  return { world: w, creative: true, camera: { x: 0, y: -20, zoom: 0.35 }, title: `Großfabrik (Messszene): ${w.entities.size} Gebäude` };
}

export const FACTORY_AREA = { x0: -150, y0: -100, x1: 150, y1: 100 };

export function buildFactoryWorld(): World {
  const w = new World(777, { ...LEGACY_MAP_SETTINGS, enemies: 'aus', cliffs: 'aus' });
  const A = FACTORY_AREA;
  w.map.clearTrees(A.x0 - 4, A.y0 - 4, A.x1 - A.x0 + 8, A.y1 - A.y0 + 8);
  for (let y = A.y0; y < A.y1; y++) for (let x = A.x0; x < A.x1; x++) {
    w.map.setResource(x, y, 0, 0);
    w.map.setWater(x, y, false);
  }
  const iron = resourceById('iron-ore').index;
  const all: Entity[] = [];
  const stamp = (bp: Blueprint, x: number, y: number): Entity[] => {
    const out: Entity[] = [];
    for (const p of placed(bp, x, y)) {
      const e = w.place(p.name, p.x, p.y, p.dir);
      if (!e) continue;
      applySettings(e, p.settings);
      out.push(e);
    }
    all.push(...out);
    return out;
  };
  const P = (name: string, x: number, y: number, d: Dir = 0): Entity | null => {
    const e = w.place(name, x, y, d);
    if (e) all.push(e);
    return e;
  };
  const coal = (e: Entity, n = 50) => insertInto(e, 'coal', n, 'player');

  // Strom: zwei Dampfblöcke 1:20:40 links oben (Wasser links der Pumpe), Kohle in jeden Kessel
  for (const by of [-92, -58]) {
    const bp = steamBlockDouble(10);
    for (const p of placed(bp, -140, by)) {
      if (p.name !== 'offshore-pump') continue;
      const { back } = World.pumpTiles(p.x, p.y, p.dir);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 0; dx++) w.map.setWater(back[0] + dx, back[1] + dy, true);
    }
    for (const e of stamp(bp, -140, by)) if (e.kind === 'boiler') coal(e);
  }
  // Solar: 6 Kacheln links unten
  for (let i = 0; i < 6; i++) stamp(solarTile(), -146 + (i % 3) * 18, 20 + Math.floor(i / 3) * 18);
  // Bohrerfelder auf Eisenerz
  for (let i = 0; i < 8; i++) {
    const bp = drillField(15);
    const x = -88 + i * 9;
    for (let y = -90; y < -90 + bp.h + 1; y++) for (let dx = -1; dx < bp.w + 1; dx++) w.map.setResource(x + dx, y, iron, 50_000);
    stamp(bp, x, -90);
  }
  // Ofenreihen, Öfen mit Erz und Kohle vorgefüllt
  for (let i = 0; i < 6; i++) {
    for (const e of stamp(smelterColumn('stone-furnace', 24), -10 + i * 12, -90)) {
      if (e.kind === 'furnace') {
        coal(e);
        insertInto(e, 'iron-ore', 50, 'player');
      }
    }
  }
  // Malls
  for (let i = 0; i < 2; i++) stamp(mall(), 66 + i * 22, -90);
  // Zahnrad-Feld: Kiste → Greifarm → Montagemaschine 2 → Greifarm → Kiste
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 10; c++) {
      const x = 66 + c * 8;
      const y = -60 + r * 6;
      const src = P('iron-chest', x, y + 1);
      if (src) insertInto(src, 'iron-plate', 1600, 'player');
      P('inserter', x + 1, y + 1, 1);
      const am = P('assembling-machine-2', x + 2, y) as AssemblerEntity | null;
      am?.setRecipe('iron-gear-wheel');
      P('inserter', x + 5, y + 1, 1);
      P('iron-chest', x + 6, y + 1);
    }
  }
  // Labore mit Paketen
  for (let i = 0; i < 20; i++) {
    const lab = P('lab', 66 + (i % 10) * 4, -22 + Math.floor(i / 10) * 4) as LabEntity | null;
    if (lab) insertInto(lab, 'automation-science-pack', 200, 'player');
  }
  for (const t of ['steam-power', 'electronics', 'automation-science-pack']) w.research.complete(t);
  w.research.start('automation');
  // Bandschleifen mit Items
  const loops = 20;
  const H = 40;
  for (let k = 0; k < loops; k++) {
    const a = -10 + k * 2;
    const place = (x: number, y: number, d: Dir) => w.place('transport-belt', x, 30 + y, d, true);
    for (let y = 1; y < H; y++) place(a, y, 0);
    place(a, 0, 1);
    place(a + 1, 0, 2);
    for (let y = 1; y < H - 1; y++) place(a + 1, y, 2);
    place(a + 1, H - 1, 3);
  }
  w.belts.ensure();
  const items = [itemIndex('iron-ore'), itemIndex('coal'), itemIndex('copper-plate')];
  let n = 0;
  for (const line of w.belts.lines) {
    for (const lane of line.lanes) {
      if (lane.len < 2000) continue;
      const step = Math.floor(lane.len / 80);
      for (let i = 0; i < 80; i++) if (w.belts.insertAt(lane, i * step, items[n++ % items.length])) n++;
    }
  }
  // Umspannwerke im Raster verbinden alles zu einem Netz (versetzt suchen, wenn der Platz belegt ist)
  for (let y = A.y0 + 4; y < A.y1 - 4; y += 16) {
    for (let x = A.x0 + 4; x < A.x1 - 4; x += 16) {
      let ok = false;
      for (let r = 0; r < 6 && !ok; r++) {
        for (const [dx, dy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, -r]]) {
          if (P('substation', x + dx, y + dy)) {
            ok = true;
            break;
          }
        }
      }
    }
  }
  return w;
}
