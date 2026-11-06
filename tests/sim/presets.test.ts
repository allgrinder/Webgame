import { describe, expect, it } from 'vitest';
import { PRESETS, STEAM_POWER } from '../../src/data/blueprints';
import { type Blueprint, decode, encode, placed, rotate } from '../../src/sim/blueprint';
import type { BoilerEntity, GeneratorEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { resourceById } from '../../src/data/resources';
import { World } from '../../src/sim/world';

/** Vorlage auf freiem Land ablegen, Wasser genau hinter der Uferpumpe, Kohle in den Kessel, Lampen als Verbraucher. */
function build(bp: Blueprint): World {
  const w = new World(1);
  for (let y = -20; y < 30; y++) for (let x = -20; x < 30; x++) {
    w.map.setResource(x, y, 0, 0);
    w.map.setWater(x, y, false);
  }
  const list = placed(bp, 0, 0);
  const pump = list.find((p) => p.name === 'offshore-pump')!;
  const { back } = World.pumpTiles(pump.x, pump.y, pump.dir);
  w.map.setWater(back[0], back[1], true);
  for (const p of list) expect(w.place(p.name, p.x, p.y, p.dir), `${p.name} bei ${p.x},${p.y}`).toBeTruthy();
  const boiler = [...w.entities.values()].find((e) => e.kind === 'boiler') as BoilerEntity;
  insertInto(boiler, 'coal', 50, 'player');
  // Verbraucher: elektrische Bohrer auf Erz, über einen zweiten Mast angeschlossen
  const pole = list.find((p) => p.name === 'small-electric-pole')!;
  const iron = resourceById('iron-ore').index;
  let n = 0;
  for (const [dx, dy] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) {
    const px = pole.x + dx;
    const py = pole.y + dy;
    if (!w.place('small-electric-pole', px, py, 0)) continue;
    for (let y = py + 1; y < py + 4; y++) for (let x = px + 1; x < px + 4; x++) w.map.setResource(x, y, iron, 5000);
    if (w.place('electric-mining-drill', px + 1, py + 1, 0) && w.place('iron-chest', px + 2, py, 0)) n++;
  }
  expect(n).toBeGreaterThan(0);
  return w;
}

describe('Blaupausen-Vorlagen', () => {
  it('Text hin und zurück', () => {
    for (const p of PRESETS) expect(decode(encode(p.bp))).toEqual(p.bp);
  });

  it('Dampfkraft liefert Strom – in allen vier Drehungen', () => {
    let bp = STEAM_POWER;
    for (let r = 0; r < 4; r++) {
      const w = build(bp);
      w.run(600);
      const engines = [...w.entities.values()].filter((e) => e.kind === 'generator') as GeneratorEntity[];
      expect(engines.length).toBe(2);
      const boiler = [...w.entities.values()].find((e) => e.kind === 'boiler')!;
      expect(boiler.status, `Drehung ${r}: Kessel`).toBe(1);
      expect(w.power.nets.some((n) => n.generators.length === 2 && n.consumers.length > 0), `Drehung ${r}: Netz`).toBe(true);
      const drills = [...w.entities.values()].filter((e) => e.name === 'electric-mining-drill');
      expect(drills.length).toBeGreaterThan(0);
      expect(drills.map((d) => d.status), `Drehung ${r}: Bohrer`).toEqual(drills.map(() => 1));
      expect(engines.every((e) => e.status === 1), `Drehung ${r}: Dampfmaschinen`).toBe(true);
      bp = rotate(bp);
    }
  });

  it('ohne Strombedarf: Leerlauf statt „Ausgabe blockiert“, kaum Brennstoffverbrauch', () => {
    const w = new World(1);
    for (let y = -5; y < 20; y++) for (let x = -5; x < 10; x++) {
      w.map.setResource(x, y, 0, 0);
      w.map.setWater(x, y, false);
    }
    w.map.setWater(0, 0, true);
    for (const p of placed(STEAM_POWER, 0, 0)) w.place(p.name, p.x, p.y, p.dir);
    const boiler = [...w.entities.values()].find((e) => e.kind === 'boiler') as BoilerEntity;
    insertInto(boiler, 'coal', 10, 'player');
    w.run(60 * 60);
    for (const e of w.entities.values()) expect(e.status, e.name).not.toBe(3);
    expect(boiler.status).toBe(0);
    // nur die erste Füllung von Kessel und Maschinen kostet Brennstoff, danach ruht der Kessel
    const coal = () => boiler.contents().find((c) => c.item === 'coal')?.count ?? 0;
    const before = coal();
    expect(before).toBeGreaterThanOrEqual(4);
    w.run(5 * 60 * 60);
    expect(coal()).toBe(before);
  });
});

describe('Direkte Übergabe', () => {
  it('Montagemaschine → Greifarm → Montagemaschine, ohne Band', () => {
    const w = new World(1);
    for (let y = -12; y < 10; y++) for (let x = -12; x < 20; x++) {
      w.map.setResource(x, y, 0, 0);
      w.map.setWater(x, y, false);
    }
    w.map.setWater(-8, -9, true);
    for (const p of placed(STEAM_POWER, -8, -9)) w.place(p.name, p.x, p.y, p.dir);
    insertInto([...w.entities.values()].find((e) => e.kind === 'boiler')!, 'coal', 50, 'player');
    w.place('small-electric-pole', -2, 0, 0);
    w.place('small-electric-pole', 3, 3, 0);
    const a = w.place('assembling-machine-1', 0, 0, 0)!;
    expect(w.place('inserter', 3, 1, 1)).toBeTruthy(); // Richtung Osten: nimmt aus a, legt in b
    const b = w.place('assembling-machine-1', 4, 0, 0)!;
    if (a.kind !== 'assembler' || b.kind !== 'assembler') throw new Error('Montagemaschine erwartet');
    a.setRecipe('iron-gear-wheel');
    b.setRecipe('transport-belt');
    insertInto(a, 'iron-plate', 50, 'player');
    insertInto(b, 'iron-plate', 50, 'player');
    w.run(600);
    const made = b.contents().find((c) => c.item === 'transport-belt')?.count ?? 0;
    expect(made).toBeGreaterThan(0);
  });
});
