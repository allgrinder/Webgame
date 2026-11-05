import { describe, expect, it } from 'vitest';
import { resourceById } from '../../src/data/resources';
import type { BoilerEntity, ContainerEntity, DrillEntity, GeneratorEntity, PumpEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

/** Wasser (0,0) → Pumpe (0,1)↓ → Rohre (0,2),(0,3) → Kessel (1,2) → Dampfmaschine (1,-3) → Mast (4,0) → Bohrer (5,1) → Kiste (6,0) */
function powerWorld(): World {
  const w = new World(1);
  for (let y = -8; y < 10; y++) for (let x = -6; x < 12; x++) {
    w.map.setResource(x, y, 0, 0);
    w.map.setWater(x, y, false);
  }
  w.map.setWater(0, 0, true);
  const iron = resourceById('iron-ore').index;
  for (let y = 0; y < 5; y++) for (let x = 4; x < 9; x++) w.map.setResource(x, y, iron, 5000);
  expect(w.place('offshore-pump', 0, 0, 2)).toBeTruthy();
  w.place('pipe', 0, 2, 0);
  w.place('pipe', 0, 3, 0);
  const boiler = w.place('boiler', 1, 2, 0) as BoilerEntity;
  expect(boiler).toBeTruthy();
  insertInto(boiler, 'coal', 20, 'player');
  expect(w.place('steam-engine', 1, -3, 0)).toBeTruthy();
  expect(w.place('small-electric-pole', 4, 0, 0)).toBeTruthy();
  expect(w.place('electric-mining-drill', 5, 1, 0)).toBeTruthy();
  expect(w.place('iron-chest', 6, 0, 0)).toBeTruthy();
  return w;
}

describe('Flüssigkeiten und Strom', () => {
  it('Uferpumpe nur mit dem Rücken zum Wasser', () => {
    const w = new World(1);
    for (let y = -3; y < 3; y++) for (let x = -3; x < 3; x++) w.map.setWater(x, y, false);
    w.map.setWater(0, 0, true);
    expect(w.canPlace('offshore-pump', 0, 1, 0).ok).toBe(false); // hinteres Feld (0,2) an Land
    expect(w.canPlace('offshore-pump', 0, 1, 2).ok).toBe(false); // hinteres Feld (0,1) an Land
    expect(w.canPlace('offshore-pump', 0, 0, 2).ok).toBe(true); // hinten (0,0) Wasser, vorn (0,1) Land
    expect(w.canPlace('offshore-pump', 0, -1, 0).ok).toBe(true); // hinten (0,0) Wasser, vorn (0,-1) Land
  });

  it('Kessel und Dampfmaschine versorgen einen elektrischen Bohrer (0,5 Erz/s)', () => {
    const w = powerWorld();
    const pump = [...w.entities.values()].find((e) => e.kind === 'offshore-pump') as PumpEntity;
    const boiler = [...w.entities.values()].find((e) => e.kind === 'boiler') as BoilerEntity;
    const engine = [...w.entities.values()].find((e) => e.kind === 'generator') as GeneratorEntity;
    const drill = [...w.entities.values()].find((e) => e.name === 'electric-mining-drill') as DrillEntity;
    const chest = [...w.entities.values()].find((e) => e.kind === 'container') as ContainerEntity;
    expect(boiler.steamPerTick).toBe(1000); // 60 Einheiten Dampf pro Sekunde
    expect(engine.maxPerTick).toBe(15000); // 900 kW
    w.run(60);
    expect(pump.status).not.toBe(4);
    w.run(60 * 60);
    expect(drill.status).toBe(1);
    // 60 s bei 0,5 Erz/s, abzüglich Anlauf
    const ore = chest.inventory.count('iron-ore');
    expect(ore).toBeGreaterThanOrEqual(28);
    expect(ore).toBeLessThanOrEqual(31);
    const net = w.power.nets[0];
    expect(net.consumers.length).toBe(1);
    expect(net.generators.length).toBe(1);
  });

  it('ohne Mast kein Strom, Speichern und Laden ändert nichts', () => {
    const a = powerWorld();
    a.run(1234);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(a))));
    a.run(2000);
    b.run(2000);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(a)));
    const pole = [...a.entities.values()].find((e) => e.kind === 'pole')!;
    a.remove(pole.id);
    a.run(300);
    const drill = [...a.entities.values()].find((e) => e.name === 'electric-mining-drill') as DrillEntity;
    expect(drill.status).toBe(7);
  });
});
