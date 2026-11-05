import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import { type AssemblerEntity, type ContainerEntity, type RoboportEntity, insertInto } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-40, -40, 40, 40);
  for (let y = -40; y < 40; y++) for (let x = -40; x < 40; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

function run(w: World, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    for (const e of w.entities.values()) {
      const en = (e as { energy?: { type?: string } }).energy;
      if (en?.type === 'electric') (en as ElectricSource).buffer = Math.max((en as ElectricSource).buffer, (en as ElectricSource).capacity);
    }
    w.step();
  }
}

describe('Roboter (Wiki „Roboport“, „Logistic robot“, „Construction robot“)', () => {
  it('Bauroboter bauen Geister mit Rezept aus der Lagerkiste und fliegen heim', () => {
    const w = clearWorld();
    const port = w.place('roboport', 0, 0, 0) as RoboportEntity;
    insertInto(port, 'construction-robot', 5, 'player');
    const store = w.place('storage-chest', 6, 0, 0) as ContainerEntity;
    store.inventory.add('assembling-machine-1', 2);
    w.ghosts.add(w, 'assembling-machine-1', 20, 0, 0, { recipe: 'iron-gear-wheel' });
    w.ghosts.add(w, 'assembling-machine-1', 20, 5, 0);
    run(w, 30);
    expect(w.robots.robots.length).toBe(2);
    expect(port.robots.count('construction-robot')).toBe(3);
    run(w, 60 * 20);
    const am = w.entityAt(21, 1) as AssemblerEntity;
    expect(am?.name).toBe('assembling-machine-1');
    expect(am.recipe?.id).toBe('iron-gear-wheel');
    expect(w.ghosts.all.size).toBe(0);
    expect(store.inventory.count('assembling-machine-1')).toBe(0);
    expect(w.robots.robots.length).toBe(0);
    expect(port.robots.count('construction-robot')).toBe(5);
  });

  it('Logistikroboter füllen Anforderungskisten aus Anbieterkisten (Vorrang aktiv > Lager > passiv)', () => {
    const w = clearWorld();
    const port = w.place('roboport', 0, 0, 0) as RoboportEntity;
    insertInto(port, 'logistic-robot', 10, 'player');
    const passive = w.place('passive-provider-chest', 10, 0, 0) as ContainerEntity;
    passive.inventory.add('iron-plate', 50);
    const storage = w.place('storage-chest', 12, 0, 0) as ContainerEntity;
    storage.inventory.add('iron-plate', 3);
    const req = w.place('requester-chest', -10, 0, 0) as ContainerEntity;
    req.requests.push({ item: 'iron-plate', count: 12 });
    run(w, 60 * 30);
    expect(req.inventory.count('iron-plate')).toBe(12);
    expect(storage.inventory.count('iron-plate')).toBe(0);
    expect(passive.inventory.count('iron-plate')).toBe(41);
    // Speichern mitten im Flug
    req.requests[0].count = 20;
    run(w, 40);
    expect(w.robots.robots.length).toBeGreaterThan(0);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    run(w, 60 * 20);
    run(b, 60 * 20);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
    expect(req.inventory.count('iron-plate')).toBe(20);
  });

  it('Abriss: markiertes Gebäude kommt samt Inhalt in die Lagerkiste', () => {
    const w = clearWorld();
    const port = w.place('roboport', 0, 0, 0) as RoboportEntity;
    insertInto(port, 'construction-robot', 1, 'player');
    const store = w.place('storage-chest', 5, 0, 0) as ContainerEntity;
    const chest = w.place('iron-chest', 15, 3, 0) as ContainerEntity;
    chest.inventory.add('coal', 7);
    w.robots.marked.add(chest.id);
    run(w, 60 * 15);
    expect(w.entities.has(chest.id)).toBe(false);
    expect(store.inventory.count('iron-chest')).toBe(1);
    expect(store.inventory.count('coal')).toBe(7);
  });
});
