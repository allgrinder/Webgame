import { describe, expect, it } from 'vitest';
import { BELT } from '../../src/data/belt';
import type { Dir } from '../../src/sim/geom';
import { type UndergroundEntity, itemIndex } from '../../src/sim/machines';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

const ORE = itemIndex('iron-ore');

function row(w: World, name: string, x0: number, y: number, n: number, dir: Dir = 1) {
  for (let i = 0; i < n; i++) expect(w.place(name, x0 + i, y, dir)).toBeTruthy();
}

/** Speist am Feld (sx,sy) beide Spuren maximal und zählt, was am Feld (ex,ey) ankommt. */
function throughput(w: World, sx: number, sy: number, ex: number, ey: number, warm = 600, measure = 600): number {
  const start = w.belts.tileAt(sx, sy)!;
  const end = w.belts.tileAt(ex, ey)!;
  let n = 0;
  for (let t = 0; t < warm + measure; t++) {
    w.belts.insertAtPoint(start, 0.02, 0.25, ORE);
    w.belts.insertAtPoint(start, 0.02, 0.75, ORE);
    w.step();
    while (w.belts.takeFromTile(end, () => true) >= 0) if (t >= warm) n++;
  }
  return n / (measure / 60);
}

function itemCount(w: World): number {
  return w.belts.itemCount;
}

describe('Logistik', () => {
  it('schnelles Band: 3,75 Felder/s und 30 Items/s', () => {
    const w = new World(1);
    row(w, 'fast-transport-belt', 0, 0, 20);
    const t = w.belts.tileAt(0, 0)!;
    w.belts.insertAtPoint(t, 0.5, 0.25, ORE);
    w.belts.ensure();
    const d0 = w.belts.lines[0].lanes[0].gaps[0];
    w.run(60);
    const d1 = w.belts.lines[0].lanes[0].gaps[0];
    expect((d0 - d1) / BELT.positionsPerTile).toBeCloseTo(3.75, 6);
    const w2 = new World(1);
    row(w2, 'fast-transport-belt', 0, 0, 10);
    expect(throughput(w2, 0, 0, 9, 0)).toBeCloseTo(30, 0);
  });

  it('Übergang gelb → schnell → gelb verliert nichts und begrenzt auf 15 Items/s', () => {
    const w = new World(1);
    row(w, 'transport-belt', 0, 0, 4);
    row(w, 'fast-transport-belt', 4, 0, 4);
    row(w, 'transport-belt', 8, 0, 4);
    w.belts.ensure();
    expect(w.belts.lines.length).toBe(3);
    expect(throughput(w, 0, 0, 11, 0)).toBeCloseTo(15, 0);
    // schnell → gelb: Stau ohne Verlust
    const v = new World(1);
    row(v, 'fast-transport-belt', 0, 0, 4);
    row(v, 'transport-belt', 4, 0, 4);
    const s = v.belts.tileAt(0, 0)!;
    let fed = 0;
    let got = 0;
    for (let t = 0; t < 1200; t++) {
      if (v.belts.insertAtPoint(s, 0.02, 0.25, ORE)) fed++;
      if (v.belts.insertAtPoint(s, 0.02, 0.75, ORE)) fed++;
      v.step();
      while (v.belts.takeFromTile(v.belts.tileAt(7, 0)!, () => true) >= 0) got++;
    }
    expect(fed).toBe(got + itemCount(v));
    expect(got / 20).toBeLessThanOrEqual(15.2);
  });

  it('Untergrundband paart sich, unterquert ein Querband und hält 15 Items/s', () => {
    const w = new World(1);
    row(w, 'transport-belt', 0, 0, 2);
    const a = w.place('underground-belt', 2, 0, 1) as UndergroundEntity;
    const b = w.place('underground-belt', 6, 0, 1) as UndergroundEntity;
    expect(a.output).toBe(false);
    expect(b.output).toBe(true);
    row(w, 'transport-belt', 7, 0, 3);
    // Querband über dem Tunnel
    for (let y = -2; y <= 2; y++) if (y !== 0) w.place('transport-belt', 4, y, 2);
    w.place('transport-belt', 4, 0, 2);
    w.belts.ensure();
    const ta = w.belts.tileAt(2, 0)!;
    expect(ta.ug?.partner?.x).toBe(6);
    expect(ta.line).toBe(w.belts.tileAt(9, 0)!.line);
    expect(throughput(w, 0, 0, 9, 0)).toBeCloseTo(15, 0);
    // Querband bleibt unberührt
    expect(w.belts.tileAt(4, 0)!.line).not.toBe(ta.line);
  });

  it('Untergrundband über die volle Länge (10 Felder, Wunsch) hält 15 Items/s', () => {
    const w = new World(1);
    row(w, 'transport-belt', 0, 0, 2);
    const a = w.place('underground-belt', 2, 0, 1) as UndergroundEntity;
    const b = w.place('underground-belt', 12, 0, 1) as UndergroundEntity;
    expect(a.output).toBe(false);
    expect(b.output).toBe(true);
    row(w, 'transport-belt', 13, 0, 3);
    w.belts.ensure();
    expect(w.belts.tileAt(2, 0)!.line).toBe(w.belts.tileAt(15, 0)!.line);
    expect(throughput(w, 0, 0, 15, 0)).toBeCloseTo(15, 0);
  });

  it('Untergrundband: zu weit = keine Paarung; Drehen tauscht Ein- und Ausgang', () => {
    const w = new World(1);
    const a = w.place('underground-belt', 0, 0, 1) as UndergroundEntity;
    const b = w.place('underground-belt', 11, 0, 1) as UndergroundEntity;
    expect(b.output).toBe(false); // Abstand 11 > 10
    w.belts.ensure();
    expect(w.belts.tileAt(0, 0)!.ug!.partner).toBeNull();
    w.remove(b.id);
    const c = w.place('underground-belt', 10, 0, 1) as UndergroundEntity;
    expect(c.output).toBe(true);
    w.rotate(a.id, 0);
    expect(a.output).toBe(true);
    expect(a.dir).toBe(3);
    w.belts.ensure();
    expect(w.belts.tileAt(10, 0)!.ug!.partner).toBeNull();
  });

  it('Splitter verteilt abwechselnd und weicht bei Stau auf den freien Ausgang aus', () => {
    const w = new World(1);
    row(w, 'transport-belt', 0, 0, 5);
    expect(w.place('splitter', 5, 0, 1)).toBeTruthy();
    row(w, 'transport-belt', 6, 0, 4);
    row(w, 'transport-belt', 6, 1, 4);
    const start = w.belts.tileAt(0, 0)!;
    const counts = [0, 0];
    for (let t = 0; t < 1800; t++) {
      w.belts.insertAtPoint(start, 0.02, 0.25, ORE);
      w.belts.insertAtPoint(start, 0.02, 0.75, ORE);
      w.step();
      for (let k = 0; k < 2; k++) while (w.belts.takeFromTile(w.belts.tileAt(9, k)!, () => true) >= 0) if (t >= 600) counts[k]++;
    }
    expect(Math.abs(counts[0] - counts[1])).toBeLessThanOrEqual(2);
    expect((counts[0] + counts[1]) / 20).toBeCloseTo(15, 0);
    // unterer Ausgang staut: alles geht nach oben
    const c2 = [0, 0];
    for (let t = 0; t < 1800; t++) {
      w.belts.insertAtPoint(start, 0.02, 0.25, ORE);
      w.belts.insertAtPoint(start, 0.02, 0.75, ORE);
      w.step();
      while (w.belts.takeFromTile(w.belts.tileAt(9, 0)!, () => true) >= 0) if (t >= 900) c2[0]++;
    }
    expect(c2[0] / 15).toBeCloseTo(15, 0);
  });

  it('Speichern/Laden mit Splitter, Untergrund und schnellem Band ist deterministisch', () => {
    const w = new World(1);
    row(w, 'transport-belt', 0, 0, 3);
    w.place('underground-belt', 3, 0, 1);
    w.place('underground-belt', 6, 0, 1);
    row(w, 'fast-transport-belt', 7, 0, 3);
    w.place('splitter', 10, 0, 1);
    row(w, 'transport-belt', 11, 0, 5);
    row(w, 'transport-belt', 11, 1, 5);
    const start = w.belts.tileAt(0, 0)!;
    for (let t = 0; t < 500; t++) {
      w.belts.insertAtPoint(start, 0.02, 0.25, ORE);
      w.step();
    }
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(b.belts.itemCount).toBe(w.belts.itemCount);
    for (const x of [w, b]) x.run(700);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
    // Abbauen gibt Items des Splitters zurück
    const sp = [...w.entities.values()].find((e) => e.kind === 'splitter')!;
    const back = w.remove(sp.id);
    expect(back[0]).toEqual({ item: 'splitter', count: 1 });
  });

  it('Logistik-Rezepte sind bis zur Forschung gesperrt', () => {
    const w = new World(1);
    const p = new Player(0.5, 0.5);
    w.player = p;
    p.inventory.add('iron-plate', 50);
    p.inventory.add('transport-belt', 20);
    p.inventory.add('electronic-circuit', 10);
    expect(p.craftableCount('underground-belt')).toBe(0);
    expect(p.craftableCount('splitter')).toBe(0);
    w.research.complete('logistics');
    expect(p.craftableCount('underground-belt')).toBeGreaterThan(0);
    expect(p.craftableCount('splitter')).toBe(2);
    expect(p.craftableCount('fast-transport-belt')).toBe(0);
  });
});
