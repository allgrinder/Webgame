import type { Dir } from '../sim/geom';
import { resourceById } from '../data/resources';
import { type Entity, insertInto, itemIndex } from '../sim/machines';
import { Player } from '../sim/player';
import { World } from '../sim/world';

export interface Scene {
  world: World;
  /** Bauen ohne Itemverbrauch, Debug-Tasten aktiv. */
  creative: boolean;
  camera: { x: number; y: number; zoom: number };
  title: string;
}

export type SceneName = 'freeplay' | 'sandbox' | 'stress' | 'demo';

export function createScene(name: SceneName, seed = 12345): Scene {
  switch (name) {
    case 'stress': return stressScene();
    case 'demo': return demoScene(seed);
    case 'sandbox': return sandboxScene(seed);
    default: return freeplayScene(seed);
  }
}

export function freeplayScene(seed: number): Scene {
  const world = new World(seed);
  const p = new Player(0.5, 0.5);
  p.giveStart();
  world.player = p;
  return { world, creative: false, camera: { x: 0.5, y: 0.5, zoom: 1 }, title: 'Freies Spiel' };
}

function sandboxScene(seed: number): Scene {
  const world = new World(seed);
  return { world, creative: true, camera: { x: 0, y: 0, zoom: 1 }, title: 'Sandkasten' };
}

/**
 * Lastszene: 50 Schleifen aus je 2×50 Bandfeldern = 5.000 Felder,
 * je Spur 100 Items = 10.000 Items in Bewegung.
 */
export function stressScene(): Scene {
  const world = new World(1);
  const H = 50;
  const LOOPS = 50;
  const x0 = -LOOPS;
  const y0 = -H / 2;
  for (let k = 0; k < LOOPS; k++) {
    const a = x0 + k * 2;
    const place = (x: number, y: number, d: Dir) => world.place('transport-belt', x, y0 + y, d, true);
    for (let y = 1; y < H; y++) place(a, y, 0);
    place(a, 0, 1);
    place(a + 1, 0, 2);
    for (let y = 1; y < H - 1; y++) place(a + 1, y, 2);
    place(a + 1, H - 1, 3);
  }
  world.belts.ensure();
  const items = [itemIndex('iron-ore'), itemIndex('coal'), itemIndex('stone'), itemIndex('iron-plate')];
  let n = 0;
  for (const line of world.belts.lines) {
    for (let l = 0; l < 2; l++) {
      const lane = line.lanes[l];
      const count = 100;
      const step = Math.floor(lane.len / count);
      for (let i = 0; i < count; i++) {
        if (world.belts.insertAt(lane, i * step, items[(n + l) % items.length])) n++;
      }
    }
  }
  return { world, creative: true, camera: { x: 0, y: 0, zoom: 0.25 }, title: `Last: ${world.belts.count} Felder, ${n} Items` };
}

/**
 * Demo: fertige Kette. Eisenerz- und Kohlebohrer speisen ein gemeinsames Band
 * (Erz links, Kohle rechts), Greifarme beladen zwei Steinöfen mit Erz und Kohle,
 * weitere Greifarme legen die Platten auf ein Ausgabeband.
 */
export function demoScene(seed: number): Scene {
  const world = buildDemoWorld(seed);
  return { world, creative: true, camera: { x: 0.5, y: 1.5, zoom: 1 }, title: 'Demo: Produktionskette' };
}

export function buildDemoWorld(seed: number): World {
  const world = new World(seed);
  const iron = resourceById('iron-ore').index;
  const coal = resourceById('coal').index;
  // Vorhandene Ressourcen im Demobereich entfernen, dann eigene Felder anlegen
  for (let y = -6; y <= 8; y++) for (let x = -10; x <= 12; x++) world.map.setResource(x, y, 0, 0);
  for (let y = -3; y <= -1; y++) for (let x = -7; x <= -2; x++) world.map.setResource(x, y, iron, 4000);
  for (let y = 1; y <= 3; y++) for (let x = -7; x <= -4; x++) world.map.setResource(x, y, coal, 4000);
  const P = (name: string, x: number, y: number, d: Dir) => {
    const e = world.place(name, x, y, d);
    if (!e) throw new Error(`Demo: ${name} bei ${x},${y} nicht platzierbar`);
    return e;
  };
  for (let x = -6; x <= 7; x++) P('transport-belt', x, 0, 1);
  for (let x = 1; x <= 10; x++) P('transport-belt', x, 5, 1);
  const fuel = (e: Entity, n: number) => insertInto(e, 'coal', n, 'player');
  fuel(P('burner-mining-drill', -6, -2, 2), 20);
  fuel(P('burner-mining-drill', -4, -2, 2), 20);
  fuel(P('burner-mining-drill', -6, 1, 0), 20);
  P('stone-furnace', 2, 2, 0);
  P('stone-furnace', 5, 2, 0);
  P('burner-inserter', 2, 1, 2);
  P('burner-inserter', 5, 1, 2);
  fuel(P('burner-inserter', 3, 4, 2), 2);
  fuel(P('burner-inserter', 6, 4, 2), 2);
  return world;
}
