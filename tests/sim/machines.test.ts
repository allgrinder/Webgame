import { describe, expect, it } from 'vitest';
import { resourceById } from '../../src/data/resources';
import { buildDemoWorld } from '../../src/game/scenes';
import type { BeltTile } from '../../src/sim/belts';
import { DrillEntity, FurnaceEntity, InserterEntity, insertInto, itemId } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function ironField(w: World, x0: number, y0: number, wdt: number, h: number, amount = 10000) {
  const iron = resourceById('iron-ore').index;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + wdt; x++) w.map.setResource(x, y, iron, amount);
}

/** Leert ein Bandfeld und zählt die Items. */
function drain(w: World, t: BeltTile, counts: Map<string, number>) {
  let idx: number;
  while ((idx = w.belts.takeFromTile(t, () => true)) >= 0) {
    const id = itemId(idx);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
}

describe('Brennstoff-Bohrer', () => {
  it('fördert 0,25 Erz/s und etwa 6,67 Erz pro Kohle', () => {
    const w = new World(1);
    for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) w.map.setResource(x, y, 0, 0);
    ironField(w, 0, 0, 2, 2);
    const drill = w.place('burner-mining-drill', 0, 0, 2) as DrillEntity;
    // Ausgabe nach Süden auf ein Band
    w.place('transport-belt', 1, 2, 1);
    w.place('transport-belt', 2, 2, 1);
    const sink = w.belts.tileAt(1, 2)!;
    expect(insertInto(drill, 'coal', 3, 'player')).toBe(3);
    const counts = new Map<string, number>();
    // 60 s: Rate messen
    for (let t = 0; t < 60 * 60; t++) {
      w.step();
      drain(w, sink, counts);
    }
    expect(counts.get('iron-ore')).toBe(15); // 0,25/s × 60 s
    // bis Brennstoff aus ist
    for (let t = 0; t < 60 * 60; t++) {
      w.step();
      drain(w, sink, counts);
    }
    // 3 Kohle × 4 MJ / 600 kJ = 20 Erz
    expect(counts.get('iron-ore')).toBe(20);
    expect(drill.burner.fuel.isEmpty()).toBe(true);
    // Abbaufortschritt der Restenergie: 12 MJ − 20 × 600 kJ = 0
    expect(drill.burner.energy).toBe(0);
  });

  it('ist nur auf Ressourcen platzierbar und gibt nicht auf freien Boden aus', () => {
    const w = new World(1);
    for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) w.map.setResource(x, y, 0, 0);
    expect(w.canPlace('burner-mining-drill', 0, 0, 0).ok).toBe(false);
    ironField(w, 1, 1, 1, 1);
    const d = w.place('burner-mining-drill', 0, 0, 0) as DrillEntity;
    expect(d).toBeTruthy();
    insertInto(d, 'coal', 1, 'player');
    w.run(400);
    expect(d.output).toBe('iron-ore'); // abgebaut, aber kein Ziel
    expect(d.status).toBe(3); // OutputBlocked
  });

  it('baut alle Felder gleichmäßig ab und stoppt bei Erschöpfung', () => {
    const w = new World(1);
    for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) w.map.setResource(x, y, 0, 0);
    ironField(w, 0, 0, 2, 2, 3);
    const d = w.place('burner-mining-drill', 0, 0, 2) as DrillEntity;
    w.place('transport-belt', 1, 2, 1);
    const counts = new Map<string, number>();
    insertInto(d, 'coal', 5, 'player');
    for (let t = 0; t < 240 * 6; t++) {
      w.step();
      drain(w, w.belts.tileAt(1, 2)!, counts);
    }
    // nach 6 Erz: jedes der 4 Felder 1–2 abgebaut
    const left = [w.map.resourceAt(0, 0), w.map.resourceAt(1, 0), w.map.resourceAt(0, 1), w.map.resourceAt(1, 1)].map((r) => r.amount);
    expect(Math.max(...left) - Math.min(...left)).toBeLessThanOrEqual(1);
    for (let t = 0; t < 240 * 10; t++) {
      w.step();
      drain(w, w.belts.tileAt(1, 2)!, counts);
    }
    expect(counts.get('iron-ore')).toBe(12);
    expect(d.status).toBe(5); // Depleted
  });
});

describe('Steinofen', () => {
  it('braucht 3,2 s pro Platte und 0,0225 Kohle/s', () => {
    const w = new World(1);
    const f = w.place('stone-furnace', 0, 0, 0) as FurnaceEntity;
    insertInto(f, 'iron-ore', 50, 'player');
    insertInto(f, 'coal', 5, 'player');
    const fuelJ = () => f.burner.energy + f.burner.fuel.count('coal') * 4_000_000;
    const before = fuelJ();
    w.run(192 * 10);
    expect(f.result.count('iron-plate')).toBe(10);
    const used = before - fuelJ();
    expect(used / 4_000_000 / (192 * 10 / 60)).toBeCloseTo(0.0225, 6);
  });

  it('verbraucht im Leerlauf nichts und stoppt bei vollem Ausgabeslot', () => {
    const w = new World(1);
    const f = w.place('stone-furnace', 0, 0, 0) as FurnaceEntity;
    insertInto(f, 'coal', 50, 'player');
    w.run(600);
    expect(f.burner.fuel.count('coal')).toBe(50);
    f.result.add('iron-plate', 100);
    insertInto(f, 'iron-ore', 5, 'player');
    w.run(600);
    expect(f.source.count('iron-ore')).toBe(5);
    expect(f.status).toBe(3);
  });
});

describe('Brennstoff-Greifarm', () => {
  it('schafft etwa 0,78 Items/s und verbraucht 69,4 kJ pro Transfer', () => {
    const w = new World(1);
    const src = w.place('stone-furnace', 0, 0, 0) as FurnaceEntity;
    src.result.add('iron-plate', 100);
    const ins = w.place('burner-inserter', 0, 2, 2) as InserterEntity; // nimmt aus (0,1) = Ofen, legt auf (0,3)
    insertInto(ins, 'coal', 1, 'player');
    w.place('transport-belt', 0, 3, 1);
    w.place('transport-belt', 1, 3, 1);
    const counts = new Map<string, number>();
    const t0 = 600;
    for (let t = 0; t < t0; t++) { w.step(); drain(w, w.belts.tileAt(0, 3)!, counts); drain(w, w.belts.tileAt(1, 3)!, counts); }
    const before = counts.get('iron-plate') ?? 0;
    const e0 = ins.burner!.energy + ins.burner!.fuel.count('coal') * 4e6;
    for (let t = 0; t < 3600; t++) { w.step(); drain(w, w.belts.tileAt(0, 3)!, counts); drain(w, w.belts.tileAt(1, 3)!, counts); }
    const n = (counts.get('iron-plate') ?? 0) - before;
    const rate = n / 60;
    expect(rate).toBeGreaterThan(0.75);
    expect(rate).toBeLessThan(0.8);
    const used = e0 - (ins.burner!.energy + ins.burner!.fuel.count('coal') * 4e6);
    expect(used / n).toBeGreaterThan(65_000);
    expect(used / n).toBeLessThan(74_000);
  });

  it('versorgt sich selbst mit Brennstoff vom Band', () => {
    const w = new World(1);
    for (let x = 0; x < 6; x++) w.place('transport-belt', x, 0, 1);
    const f = w.place('stone-furnace', 3, 2, 0) as FurnaceEntity;
    const ins = w.place('burner-inserter', 4, 1, 2) as InserterEntity;
    expect(ins.burner!.fuel.isEmpty()).toBe(true);
    const start = w.belts.tileAt(0, 0)!;
    // 300 s lang Erz und Kohle aufs Band legen
    for (let t = 0; t < 300 * 60; t++) {
      if (t % 30 === 0) w.belts.insertAtPoint(start, 0.1, 0.25, 0);
      if (t % 90 === 0) w.belts.insertAtPoint(start, 0.1, 0.75, 1);
      w.step();
    }
    // Startpuffer reicht nur für 7 Transfers; ohne Selbstversorgung käme kaum etwas an
    const plates = f.result.count('iron-plate') + (f.recipe ? 1 : 0);
    expect(plates).toBeGreaterThan(40);
    expect(ins.status).not.toBe(2);
    // Füllgrenzen: nur kleiner Vorrat im Ofen
    expect(f.source.count('iron-ore')).toBeLessThanOrEqual(2);
    expect(f.burner.fuel.count('coal')).toBeLessThanOrEqual(5);
  });

  it('nimmt nur Items vom Feld direkt hinter sich', () => {
    const w = new World(1);
    for (let x = 0; x < 3; x++) w.place('transport-belt', x, 0, 1);
    const f = w.place('stone-furnace', 0, 2, 0) as FurnaceEntity;
    const ins = w.place('burner-inserter', 0, 1, 2) as InserterEntity;
    // Item auf Feld (2,0) – nicht hinter dem Greifarm
    w.belts.insertAtPoint(w.belts.tileAt(2, 0)!, 0.1, 0.25, 0);
    w.step();
    expect(ins.held).toBeNull();
    expect(f.source.count('iron-ore')).toBe(0);
  });
});

function countPlates(w: World): number {
  let n = 0;
  for (const e of w.entities.values()) {
    if (e.kind === 'furnace') n += e.result.count('iron-plate');
    if (e.kind === 'inserter' && e.held === 'iron-plate') n++;
  }
  for (const it of w.belts.serializeItems().values()) for (const i of it) if (itemId(i.item) === 'iron-plate') n++;
  return n;
}

describe('Gesamtkette (Demo)', () => {
  it('liefert die erwartete Plattenzahl und ist deterministisch', () => {
    const ticks = 60 * 180;
    const a = buildDemoWorld(7);
    a.run(ticks);
    const b = buildDemoWorld(7);
    b.run(ticks);
    const pa = countPlates(a);
    expect(pa).toBe(countPlates(b));
    expect(JSON.stringify(serializeWorld(a))).toBe(JSON.stringify(serializeWorld(b)));
    // 2 Erzbohrer à 0,25/s → max. 90 Erz in 180 s; abzüglich Anlauf (erstes Erz nach 4 s,
    // Bandweg, Greifarm, 3,2 s Schmelzzeit) bleiben etwa 80 Platten.
    expect(pa).toBeGreaterThanOrEqual(75);
    expect(pa).toBeLessThanOrEqual(88);
    expect(pa).toBe(EXPECTED_DEMO_PLATES);
  });
});

/** Ergebnis der Referenzsimulation (deterministisch, bei Änderungen der Spieldaten anpassen). */
const EXPECTED_DEMO_PLATES = 82;

describe('Speichern und Laden', () => {
  it('verändert den weiteren Simulationsverlauf nicht', () => {
    const a = buildDemoWorld(3);
    a.run(2345);
    const json = JSON.stringify(serializeWorld(a));
    const b = deserializeWorld(JSON.parse(json));
    expect(JSON.stringify(serializeWorld(b))).toBe(json);
    a.run(3000);
    b.run(3000);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(a)));
  });
});
