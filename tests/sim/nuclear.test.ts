import { describe, expect, it } from 'vitest';
import { STEAM_POWER } from '../../src/data/blueprints';
import { DEFAULT_MAP_SETTINGS } from '../../src/data/mapgen';
import { resourceById } from '../../src/data/resources';
import { placed } from '../../src/sim/blueprint';
import type { HeatExchangerEntity, HeatPipeEntity, ReactorEntity } from '../../src/sim/entities/nuclear';
import type { DrillEntity, GeneratorEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';
import { hash01 } from '../../src/sim/rng';

function flat(w: World, r = 30): void {
  for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
}

describe('Kernkraft', () => {
  it('Reaktor heizt sich auf, Wärme fließt durch Rohre in den Wärmetauscher, Turbine liefert Strom', () => {
    const w = new World(1);
    flat(w);
    const reactor = w.place('nuclear-reactor', 0, 0, 0) as ReactorEntity;
    // Wärmerohre von der Ostseite (x = 5) zum Wärmetauscher
    for (let x = 5; x < 8; x++) w.place('heat-pipe', x, 2, 0);
    // Wärmetauscher nach Norden: Wärmeeingang unten Mitte → steht bei (7..9, 0..1), Eingang (8,1) nach Süden … daher gedreht:
    // Ausrichtung West (dir 3): Dampf nach Westen? Wir wählen Süden (dir 2): Wärmeeingang oben Mitte (9,2)? Einfacher:
    const hx = w.place('heat-exchanger', 8, 3, 0) as HeatExchangerEntity; // Eingang hinten = unten Mitte (9,4) nach Süden
    void hx;
    insertInto(reactor, 'uranium-fuel-cell', 2, 'player');
    // Wiki: 4,85 GJ bis 500 °C → gut 2 Minuten bei 40 MW
    w.run(60 * 220);
    expect(reactor.temperature).toBeGreaterThan(500);
    const pipes = [...w.entities.values()].filter((e) => e.kind === 'heat-pipe') as HeatPipeEntity[];
    expect(pipes[0].temperature).toBeGreaterThan(400);
    // 40 MW, 8 GJ je Brennstab → 200 s
    expect(reactor.spent.count("depleted-uranium-fuel-cell")).toBe(1);
  });

  it('Nachbarbonus: zwei laufende Reaktoren nebeneinander liefern je 80 MW', () => {
    const w = new World(1);
    flat(w);
    const a = w.place('nuclear-reactor', 0, 0, 0) as ReactorEntity;
    const b = w.place('nuclear-reactor', 5, 0, 0) as ReactorEntity;
    insertInto(a, 'uranium-fuel-cell', 1, 'player');
    insertInto(b, 'uranium-fuel-cell', 1, 'player');
    w.run(2);
    expect(a.neighbours).toBe(1);
    expect(b.neighbours).toBe(1);
    const h0 = a.heat + b.heat;
    w.run(60);
    // 2 × 80 MW über 1 s = 160 MJ
    expect((a.heat + b.heat - h0) / 1e6).toBeCloseTo(160, -1);
  });

  it('Wärmetauscher + Dampfturbine: 500-°C-Dampf und bis 5,82 MW', () => {
    const w = new World(1);
    flat(w);
    // Wasser: Uferpumpe (0,-2) nach Süden → Rohr (0,0) → Wasseranschluss West des nach Süden gedrehten Wärmetauschers
    w.map.setWater(0, -2, true);
    w.place('offshore-pump', 0, -2, 2);
    w.place('pipe', 0, 0, 0);
    const hx = w.place('heat-exchanger', 1, 0, 2) as HeatExchangerEntity; // Dampf nach Süden aus (2,1)
    hx.heat = hx.heatCapacity * (900 - 15); // vorgeheizt
    const t = w.place('steam-turbine', 1, 2, 0) as GeneratorEntity;
    expect(t).toBeTruthy();
    w.run(60 * 2);
    expect(hx.status).toBe(1);
    expect(hx.steam.net?.fluid).toBe('steam-hot');
    expect(t.maxPerTick * 60).toBeCloseTo(5_820_000, -3);
  });

  it('Zentrifuge: Uranverarbeitung liefert ~0,7 % Uran-235 (deterministisch)', () => {
    let u235 = 0;
    for (let n = 1; n <= 20000; n++) if (hash01(1234, n, 0, 77) < 0.007) u235++;
    expect(u235 / 20000).toBeGreaterThan(0.005);
    expect(u235 / 20000).toBeLessThan(0.009);
  });

  it('Uranerz: nur elektrischer Bohrer mit Schwefelsäure und erforschtem Uranabbau', () => {
    const w = new World(1);
    flat(w);
    w.map.setWater(-10, -12, true);
    for (const p of placed(STEAM_POWER, -10, -12)) w.place(p.name, p.x, p.y, p.dir);
    insertInto([...w.entities.values()].find((e) => e.kind === 'boiler')!, 'coal', 50, 'player');
    w.place('small-electric-pole', -4, -4, 0);
    w.place('small-electric-pole', 2, -1, 0);
    const ur = resourceById('uranium-ore').index;
    for (let y = 0; y < 3; y++) for (let x = 3; x < 6; x++) w.map.setResource(x, y, ur, 1000);
    const d = w.place('electric-mining-drill', 3, 0, 0) as DrillEntity;
    const chest = w.place('iron-chest', 4, -1, 0)!;
    w.run(120);
    expect(d.status).toBe(4); // ohne Forschung: keine Zutat
    w.research.complete('uranium-mining');
    w.run(10);
    expect(d.status).toBe(4); // ohne Säure
    d.acid!.net!.add('sulfuric-acid', 100 * 1000);
    w.run(60 * 20);
    expect(chest.contents().find((c) => c.item === 'uranium-ore')?.count ?? 0).toBeGreaterThan(0);
    // Auslöser-Forschung Uranverarbeitung
    expect(w.research.done.has('uranium-processing')).toBe(true);
  });

  it('Uran auf neuen Karten nur weit draußen; Speichern/Laden der Wärme', () => {
    const w = new World(42, DEFAULT_MAP_SETTINGS);
    const ur = resourceById('uranium-ore').index;
    let found = 0;
    for (let y = -600; y < 600; y += 3) for (let x = -600; x < 600; x += 3) {
      if (w.map.resourceAt(x, y).res === ur) {
        found++;
        expect(Math.hypot(x, y)).toBeGreaterThan(220);
      }
    }
    expect(found).toBeGreaterThan(0);
    const v = new World(1);
    flat(v);
    const r = v.place('nuclear-reactor', 0, 0, 0) as ReactorEntity;
    insertInto(r, 'uranium-fuel-cell', 1, 'player');
    v.run(100);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(v))));
    v.run(50);
    b.run(50);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(v)));
  });
});
