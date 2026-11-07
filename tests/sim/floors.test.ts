import { describe, expect, it } from 'vitest';
import { LEGACY_MAP_SETTINGS } from '../../src/data/mapgen';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function world(): World {
  const w = new World(3, LEGACY_MAP_SETTINGS);
  w.map.clearTrees(-20, -20, 20, 20);
  for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

describe('Bodenbeläge', () => {
  it('legen, ersetzen, nicht auf Wasser; unter Gebäuden erlaubt', () => {
    const w = world();
    expect(w.placeFloor('stone-brick', 0, 0)).toBe('');
    expect(w.placeFloor('stone-brick', 0, 0)).toBeNull();
    expect(w.placeFloor('concrete', 0, 0)).toBe('stone-brick');
    w.map.setWater(5, 5, true);
    expect(w.placeFloor('concrete', 5, 5)).toBeNull();
    w.place('wooden-chest', 2, 2, 0);
    expect(w.placeFloor('refined-concrete', 2, 2)).toBe('');
    expect(w.placeFloor('iron-plate', 3, 3)).toBeNull();
  });

  it('Laufgeschwindigkeit: Steinpflaster 130 %, veredelter Beton 150 %', () => {
    const dist = (item: string | null) => {
      const w = world();
      if (item) for (let x = -2; x < 20; x++) for (let y = -2; y < 3; y++) w.placeFloor(item, x, y);
      const p = new Player(0.5, 0.5);
      w.player = p;
      p.moveX = 1;
      w.run(60);
      return p.x - 0.5;
    };
    const base = dist(null);
    expect(dist('stone-brick') / base).toBeCloseTo(1.3, 1);
    expect(dist('refined-concrete') / base).toBeCloseTo(1.5, 1);
  });

  it('Abbauen gibt den Belag zurück; Speichern und Laden behält Beläge', () => {
    const w = world();
    const p = new Player(0.5, 0.5);
    w.player = p;
    w.placeFloor('hazard-concrete', 1, 1);
    w.placeFloor('stone-brick', 2, 1);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(b.map.floorAt(1, 1)).toBe(3);
    expect(b.map.floorAt(2, 1)).toBe(1);
    p.setMineTarget({ kind: 'floor', x: 1, y: 1 });
    w.run(30);
    expect(w.map.floorAt(1, 1)).toBe(0);
    expect(p.inventory.count('hazard-concrete')).toBe(1);
  });
});
