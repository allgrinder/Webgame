import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import { Status } from '../../src/sim/entity';
import type { ContainerEntity } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-30, -30, 30, 30);
  for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}
function run(w: World, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    for (const e of w.entities.values()) {
      const en = (e as { energy?: { type?: string } | null }).energy;
      if (en?.type === 'electric') (en as ElectricSource).buffer = 1e9;
    }
    w.step();
  }
}

describe('Schaltungsnetz (Wiki „Circuit network“)', () => {
  it('Kiste meldet Inhalt, Greifarm stoppt bei Bedingung, rot + grün addieren sich', () => {
    const w = clearWorld();
    const src = w.place('iron-chest', 0, 0, 0) as ContainerEntity;
    const ins = w.place('inserter', 1, 0, 1)!;
    const dst = w.place('iron-chest', 2, 0, 0) as ContainerEntity;
    src.inventory.add('iron-plate', 50);
    expect(w.circuit.toggle(w, { id: dst.id, side: 0 }, { id: ins.id, side: 0 }, 'red')).toBe('added');
    w.circuit.conditions.set(ins.id, { first: 'iron-plate', op: '<', constant: 5, second: null });
    run(w, 60 * 20);
    expect(dst.inventory.count('iron-plate')).toBe(5);
    expect(ins.status).toBe(Status.Disabled);
    // gleiche Verbindung noch einmal: entfernt
    expect(w.circuit.toggle(w, { id: dst.id, side: 0 }, { id: ins.id, side: 0 }, 'red')).toBe('removed');
    run(w, 60 * 5);
    expect(dst.inventory.count('iron-plate')).toBeGreaterThan(5);
    // zu weit
    const far = w.place('iron-chest', 15, 0, 0)!;
    expect(w.circuit.toggle(w, { id: src.id, side: 0 }, { id: far.id, side: 0 }, 'green')).toBe('far');
  });

  it('Kombinatoren rechnen mit einem Tick Verzögerung; Speichern/Laden', () => {
    const w = clearWorld();
    const c = w.place('constant-combinator', 0, 0, 0)!;
    const a = w.place('arithmetic-combinator', 2, 0, 1)!; // nach Osten: Eingang (2,0), Ausgang (3,0)
    const d = w.place('decider-combinator', 5, 0, 1)!;
    w.circuit.settings.set(c.id, { signals: [{ signal: 'signal-A', count: 7 }] });
    w.circuit.settings.set(a.id, { arith: { first: 'signal-A', op: '*', constant: 6, second: null, output: 'signal-B' } });
    w.circuit.settings.set(d.id, { decide: { first: 'signal-B', op: '=', constant: 42, second: null, output: 'signal-C', copyCount: false } });
    expect(w.circuit.toggle(w, { id: c.id, side: 0 }, { id: a.id, side: 0 }, 'red')).toBe('added');
    expect(w.circuit.toggle(w, { id: a.id, side: 1 }, { id: d.id, side: 0 }, 'green')).toBe('added');
    run(w, 10);
    expect(w.circuit.input(d.id, 0).get('signal-B')).toBe(42);
    expect(w.circuit.network(d.id, 1, 'red')).toBeNull();
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    run(w, 5);
    run(b, 5);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
    // Ausgang des Entscheiders an eine Lampe: C = 1
    const lamp = w.place('lamp', 7, 0, 0)!;
    w.circuit.toggle(w, { id: d.id, side: 1 }, { id: lamp.id, side: 0 }, 'red');
    run(w, 4);
    expect(w.circuit.input(lamp.id).get('signal-C')).toBe(1);
  });
});
