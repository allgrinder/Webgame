import { describe, expect, it } from 'vitest';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function setup(): { w: World; p: Player } {
  const w = new World(3);
  w.map.clearTrees(-40, -40, 80, 80);
  for (let y = -30; y < 30; y++) for (let x = -30; x < 30; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  const p = new Player(0.5, 0.5);
  w.player = p;
  return { w, p };
}

function equip(w: World, p: Player): void {
  for (const it of ['modular-armor', 'personal-roboport-equipment', 'solar-panel-equipment', 'battery-equipment', 'battery-equipment']) p.inventory.add(it, 1);
  expect(p.equipArmor(w, 'modular-armor')).toBeNull();
  expect(p.insertEquipment('personal-roboport-equipment')).toBeNull();
  expect(p.insertEquipment('solar-panel-equipment')).toBeNull();
  expect(p.insertEquipment('battery-equipment')).toBeNull();
  expect(p.insertEquipment('battery-equipment')).toBeNull();
  p.grid!.energy = p.grid!.capacity;
}

describe('Rüstung und persönlicher Roboterhangar (Wiki „Modular armor“, „Personal roboport“)', () => {
  it('Modulare Rüstung: +10 Plätze, Raster 5×5, Widerstand; Ablegen gibt alles zurück', () => {
    const { w, p } = setup();
    const before = p.inventory.size;
    equip(w, p);
    expect(p.inventory.size).toBe(before + 10);
    expect(p.grid!.capacity).toBe(35e6 + 2 * 20e6);
    expect(p.grid!.robotLimit).toBe(10);
    expect(p.grid!.constructionRadius).toBe(15);
    const hp = p.hp;
    p.damage(w, 20);
    expect(hp - p.hp).toBeCloseTo((20 - 6) * 0.7, 6);
    expect(p.unequipArmor(w)).toBeNull();
    expect(p.inventory.size).toBe(before);
    expect(p.inventory.count('modular-armor')).toBe(1);
    expect(p.inventory.count('battery-equipment')).toBe(2);
  });

  it('Persönliche Roboter bauen Geister mit Items aus dem Inventar und kehren zurück', () => {
    const { w, p } = setup();
    equip(w, p);
    p.inventory.add('construction-robot', 5);
    p.inventory.add('iron-chest', 3);
    for (let i = 0; i < 3; i++) expect(w.ghosts.add(w, 'iron-chest', 4 + i * 2, -6, 0)).toBeTruthy();
    // außerhalb der Baufläche (15): bleibt Geist
    expect(w.ghosts.add(w, 'iron-chest', 40, 0, 0)).toBeTruthy();
    w.run(60 * 12);
    const chests = [...w.entities.values()].filter((e) => e.name === 'iron-chest');
    expect(chests).toHaveLength(3);
    expect(w.ghosts.all.size).toBe(1);
    expect(p.inventory.count('iron-chest')).toBe(0);
    expect(p.inventory.count('construction-robot')).toBe(5);
    expect(w.robots.robots).toHaveLength(0);
  });

  it('Abriss (Gebäude ins Inventar), Bäume fällen (Holz), Reparieren mit Reparatursets; Speichern/Laden', () => {
    const { w, p } = setup();
    equip(w, p);
    p.inventory.add('construction-robot', 10);
    p.inventory.add('repair-pack', 5);
    const chest = w.place('wooden-chest', 6, 3, 0)!;
    w.robots.marked.add(chest.id);
    const wall = w.place('stone-wall', -5, 4, 0)!;
    wall.hp = wall.def.health - 200;
    // Bäume: eigene Welt ohne Rodung, Figur neben einen echten Baum stellen
    const tw = new World(3);
    let tree = null;
    for (let r = 5; r < 200 && !tree; r += 3) for (let k = -r; k <= r && !tree; k++) tree = tw.map.trees.treeAt(k, r) ?? null;
    expect(tree).toBeTruthy();
    const w2 = new World(3);
    const p2 = new Player(tree!.x + 3, tree!.y);
    w2.player = p2;
    equip(w2, p2);
    p2.inventory.add('construction-robot', 2);
    const t2 = w2.map.trees.treeAt(tree!.tx, tree!.ty)!;
    w2.robots.markedTrees.set(`${t2.cx},${t2.cy},${t2.i}`, { cx: t2.cx, cy: t2.cy, i: t2.i, x: t2.x, y: t2.y });
    w.run(90);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    w.run(60 * 10);
    b.run(60 * 10);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
    expect(w.entities.has(chest.id)).toBe(false);
    expect(p.inventory.count('wooden-chest')).toBe(1);
    expect(wall.hp).toBe(wall.def.health);
    expect(p.inventory.count('repair-pack')).toBe(4);
    w2.run(60 * 10);
    expect(w2.map.trees.treeAt(t2.tx, t2.ty)).toBeUndefined();
    expect(p2.inventory.count('wood')).toBeGreaterThan(0);
    expect(w2.robots.markedTrees.size).toBe(0);
  });

  it('Ohne Ladung (unter 20 %) starten keine Roboter; Ablegen verweigert, solange Roboter unterwegs sind', () => {
    const { w, p } = setup();
    equip(w, p);
    p.inventory.add('construction-robot', 1);
    p.inventory.add('iron-chest', 1);
    w.ghosts.add(w, 'iron-chest', 5, 0, 0);
    p.grid!.energy = 0;
    // Nacht erzwingen, damit das Solarmodul nicht lädt
    w.tick = 12600;
    w.run(120);
    expect(w.robots.robots).toHaveLength(0);
    p.grid!.energy = p.grid!.capacity;
    w.run(20);
    expect(w.robots.robots.filter((r) => r.personal)).toHaveLength(1);
    expect(p.unequipArmor(w)).toContain('unterwegs');
  });
});
