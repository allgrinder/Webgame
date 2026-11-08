import { describe, expect, it } from 'vitest';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function world(): World {
  const w = new World(1);
  for (let y = -4; y < 4; y++) for (let x = -4; x < 16; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

describe('Band im Schaltungsnetz', () => {
  it('Bedingung hält ein einzelnes Band an, davor staut es sich; erfüllt läuft es weiter', () => {
    const w = world();
    const ids: number[] = [];
    for (let x = 0; x < 10; x++) ids.push(w.place('transport-belt', x, 0, 1)!.id);
    const chest = w.place('iron-chest', 10, 0, 0)!; // Ende: Greifarm-frei, Items bleiben am Bandende liegen
    void chest;
    const c = w.place('constant-combinator', 5, 2, 0)!;
    w.circuit.settings.set(c.id, { signals: [{ signal: 'signal-A', count: 1 }] });
    expect(w.circuit.toggle(w, { id: c.id, side: 0 }, { id: ids[6], side: 0 }, 'red')).toBe('added');
    w.circuit.conditions.set(ids[6], { first: 'signal-A', op: '>', constant: 5, second: null });
    for (let k = 0; k < 40; k++) {
      w.deliverAt(0.5, 0.5, 'iron-plate', 'inserter', false);
      w.run(8);
    }
    const before = (x: number) => w.belts.itemsOnTile(w.belts.tileById(ids[x])!).length;
    // hinter dem angehaltenen Band (7, 8, 9) ist nichts angekommen
    expect(before(7) + before(8) + before(9)).toBe(0);
    expect(before(5)).toBeGreaterThan(0);
    // Inhalt lesen: zweites Band verdrahtet, liefert Anzahl auf dem Feld
    expect(w.circuit.toggle(w, { id: ids[5], side: 0 }, { id: c.id, side: 0 }, 'green')).toBe('added');
    w.run(2);
    // Schaltungswerte kommen einen Tick verzögert an (Wiki), daher ± 1
    expect(Math.abs((w.circuit.input(c.id).get('iron-plate') ?? 0) - before(5))).toBeLessThanOrEqual(1);
    expect(w.circuit.input(c.id).get('iron-plate')).toBeGreaterThan(0);
    // Bedingung erfüllt → läuft weiter
    w.circuit.settings.set(c.id, { signals: [{ signal: 'signal-A', count: 9 }] });
    w.run(120);
    expect(before(9)).toBeGreaterThan(0);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    w.run(30);
    b.run(30);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
  });
});
