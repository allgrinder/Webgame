import { describe, expect, it } from 'vitest';
import { BELT } from '../../src/data/belt';
import { Shape } from '../../src/sim/belts';
import type { Dir } from '../../src/sim/geom';
import { itemIndex } from '../../src/sim/machines';
import { World } from '../../src/sim/world';

const ORE = itemIndex('iron-ore');

function straight(w: World, x0: number, y: number, n: number, dir: Dir = 1) {
  for (let i = 0; i < n; i++) w.place('transport-belt', x0 + i, y, dir);
}

function itemsPos(w: World) {
  w.belts.ensure();
  const out: { lane: number; d: number }[] = [];
  for (const line of w.belts.lines) {
    for (let l = 0; l < 2; l++) {
      let pos = 0;
      for (const g of line.lanes[l].gaps) {
        pos += g;
        out.push({ lane: l, d: pos });
      }
    }
  }
  return out;
}

describe('Förderband', () => {
  it('bewegt Items mit 1,875 Feldern/s', () => {
    const w = new World(1);
    straight(w, 0, 0, 20);
    const t = w.belts.tileAt(0, 0)!;
    expect(w.belts.insertAtPoint(t, 0.5, 0.25, ORE)).toBe(true);
    const before = itemsPos(w)[0].d;
    w.run(60);
    const after = itemsPos(w)[0].d;
    expect((before - after) / BELT.positionsPerTile).toBeCloseTo(1.875, 6);
  });

  it('transportiert 7,5 Items/s pro Spur und 15 Items/s gesamt', () => {
    const w = new World(1);
    straight(w, 0, 0, 10);
    const start = w.belts.tileAt(0, 0)!;
    const end = w.belts.tileAt(9, 0)!;
    let delivered = 0;
    const perLane = [0, 0];
    const measure = 600;
    for (let tick = 0; tick < 600 + measure; tick++) {
      w.belts.insertAtPoint(start, 0.02, 0.25, ORE);
      w.belts.insertAtPoint(start, 0.02, 0.75, ORE);
      w.step();
      if (tick >= 600) {
        for (const it of w.belts.itemsOnTile(end)) perLane[it.lane]++;
        while (w.belts.takeFromTile(end, () => true) >= 0) delivered++;
      } else {
        while (w.belts.takeFromTile(end, () => true) >= 0);
      }
    }
    expect(delivered / (measure / 60)).toBeCloseTo(15, 1);
    expect(perLane[0] / (measure / 60)).toBeCloseTo(7.5, 1);
  });

  it('staut sauber zurück mit Mindestabstand 64', () => {
    const w = new World(1);
    straight(w, 0, 0, 4);
    const start = w.belts.tileAt(0, 0)!;
    for (let i = 0; i < 400; i++) {
      w.belts.insertAtPoint(start, 0.02, 0.25, ORE);
      w.step();
    }
    w.belts.ensure();
    const lane = w.belts.lines[0].lanes[0];
    expect(lane.gaps[0]).toBe(0);
    for (let i = 1; i < lane.gaps.length; i++) expect(lane.gaps[i]).toBe(BELT.itemSpacing);
    // 4 Felder * 256 / 64 = 16 Items pro Spur
    expect(lane.gaps.length).toBe(16);
    expect(w.belts.lines[0].lanes[1].gaps.length).toBe(0);
  });

  it('bildet Kurven automatisch und hält die Spur', () => {
    const w = new World(1);
    straight(w, 0, 0, 3, 1); // nach Osten
    w.place('transport-belt', 3, 0, 2); // Kurve nach Süden
    w.place('transport-belt', 3, 1, 2);
    w.place('transport-belt', 3, 2, 2);
    w.belts.ensure();
    expect(w.belts.lines.length).toBe(1);
    expect(w.belts.tileAt(3, 0)!.shape).toBe(Shape.CurveRight);
    const line = w.belts.lines[0];
    // rechte Spur ist innen: 3*256 + 106 + 2*256
    expect(line.lanes[1].len).toBe(5 * 256 + BELT.curveInnerLength);
    expect(line.lanes[0].len).toBe(5 * 256 + BELT.curveOuterLength);
    const t = w.belts.tileAt(0, 0)!;
    w.belts.insertAtPoint(t, 0.1, 0.25, ORE); // links (Norden bei Ostrichtung)
    w.run(600);
    const items = w.belts.itemsOnTile(w.belts.tileAt(3, 2)!);
    expect(items.length).toBe(1);
    expect(items[0].lane).toBe(0);
  });

  it('seitliches Einspeisen belegt die nahe Spur', () => {
    const w = new World(1);
    straight(w, 0, 0, 6, 1); // Hauptband nach Osten, y = 0
    for (let y = 3; y >= 1; y--) w.place('transport-belt', 2, y, 0); // von Süden auf (2,0)
    w.belts.ensure();
    expect(w.belts.tileAt(2, 0)!.shape).toBe(Shape.Straight);
    const feeder = w.belts.tileAt(2, 3)!;
    w.belts.insertAtPoint(feeder, 0.25, 0.5, ORE);
    w.belts.insertAtPoint(feeder, 0.75, 0.5, ORE);
    w.run(600);
    const all = itemsPos(w);
    expect(all.length).toBe(2);
    // Von Süden nach Osten: rechte Spur (Süden) ist nah
    for (const it of all) expect(it.lane).toBe(1);
  });

  it('Schleife läuft endlos ohne Itemverlust', () => {
    const w = new World(1);
    // 4x4-Ring im Uhrzeigersinn
    for (let x = 0; x < 3; x++) w.place('transport-belt', x, 0, 1);
    for (let y = 0; y < 3; y++) w.place('transport-belt', 3, y, 2);
    for (let x = 3; x > 0; x--) w.place('transport-belt', x, 3, 3);
    for (let y = 3; y > 0; y--) w.place('transport-belt', 0, y, 0);
    for (let i = 0; i < 6; i++) w.belts.insertAtPoint(w.belts.tileAt(i % 3, 0)!, 0.5, i < 3 ? 0.25 : 0.75, ORE);
    const n = w.belts.itemCount;
    expect(n).toBe(6);
    w.run(3000);
    expect(w.belts.itemCount).toBe(n);
    const pos1 = JSON.stringify(itemsPos(w));
    w.run(1);
    expect(JSON.stringify(itemsPos(w))).not.toBe(pos1);
  });

  it('Drehen und Abbauen behalten bzw. liefern die Items', () => {
    const w = new World(1);
    straight(w, 0, 0, 3, 1);
    const t = w.belts.tileAt(1, 0)!;
    w.belts.insertAtPoint(t, 0.5, 0.25, ORE);
    const e = w.entityAt(1, 0)!;
    w.rotate(e.id, 2);
    expect(w.belts.itemsOnTile(w.belts.tileAt(1, 0)!).length).toBe(1);
    const items = w.remove(e.id);
    expect(items.map((i) => i.item).sort()).toEqual(['iron-ore', 'transport-belt']);
    expect(w.belts.itemCount).toBe(0);
  });
});
