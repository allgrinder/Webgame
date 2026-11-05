import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import type { ContainerEntity, TrainStopEntity } from '../../src/sim/machines';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-20, -20, 60, 60);
  for (let y = -10; y < 50; y++) for (let x = -10; x < 40; x++) {
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

/** Rundkurs im Uhrzeigersinn: links hoch, oben nach Osten, rechts runter, unten nach Westen. */
function loop(w: World): void {
  const put = (name: string, x: number, y: number, dir: 0 | 1 | 2 | 3) => expect(w.place(name, x, y, dir), `${name} ${x},${y}`).toBeTruthy();
  for (let y = 4; y <= 34; y += 2) {
    put('straight-rail', 0, y, 0);
    put('straight-rail', 18, y, 0);
  }
  for (let x = 4; x <= 14; x += 2) {
    put('straight-rail', x, 0, 1);
    put('straight-rail', x, 38, 1);
  }
  put('curved-rail', 0, 0, 0);
  put('curved-rail', 16, 0, 1);
  put('curved-rail', 16, 36, 2);
  put('curved-rail', 0, 36, 3);
}

describe('Züge (Wiki „Locomotive“: Fahrphysik je Tick)', () => {
  it('Rundkurs: Fahrplan A → B, Warten, Entladen per Greifarm, Speichern/Laden', () => {
    const w = clearWorld();
    loop(w);
    const a = w.place('train-stop', 2, 20, 0) as TrainStopEntity;
    const b = w.place('train-stop', 16, 20, 2) as TrainStopEntity;
    a.stationName = 'Erz';
    b.stationName = 'Schmelze';
    const loco = w.trains.place(w, 'locomotive', 1, 30, 0, -1)!;
    expect(loco).toBeTruthy();
    const wagon = w.trains.place(w, 'cargo-wagon', 1, 36, 0, -1)!;
    const train = w.trains.trains[0];
    expect(train.vehicles.length).toBe(2);
    expect(wagon.pose.y).toBeCloseTo(loco.pose.y + 7, 1);
    loco.inv.add('coal', 20);
    wagon.inv.add('iron-plate', 10);
    w.place('inserter', 20, 12, 1);
    const chest = w.place('iron-chest', 21, 12, 0) as ContainerEntity;
    train.schedule = [{ station: 'Erz', wait: 'time', seconds: 2 }, { station: 'Schmelze', wait: 'empty', seconds: 0 }];
    train.state = 'moving';
    run(w, 60 * 20);
    // über A (oben links) nach B gefahren und entladen
    expect(chest.inventory.count('iron-plate')).toBe(10);
    expect(train.speed).toBeLessThanOrEqual(1.2);
    const b2 = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    run(w, 600);
    run(b2, 600);
    expect(JSON.stringify(serializeWorld(b2))).toBe(JSON.stringify(serializeWorld(w)));
    expect(w.trains.trains[0].current).toBe(0); // wieder unterwegs nach A
  });

  it('Höchsttempo 1,2 Felder/Tick und Beschleunigung nach Formel', () => {
    const w = clearWorld();
    loop(w);
    const a = w.place('train-stop', 2, 20, 0) as TrainStopEntity;
    a.stationName = 'A';
    w.trains.place(w, 'locomotive', 1, 30, 0, -1);
    const t = w.trains.trains[0];
    t.vehicles[0].inv.add('coal', 50);
    t.schedule = [{ station: 'A', wait: 'time', seconds: 1 }];
    t.state = 'moving';
    // erster Tick: v = (0 − 0,5/2000 → 0) + 10/2000, dann Luftwiderstand
    run(w, 1);
    expect(t.speed).toBeCloseTo((10 / 2000) * (1 - 0.0075 / 2), 9);
  });
});
