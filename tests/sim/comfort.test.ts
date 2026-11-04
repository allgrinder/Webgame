import { describe, expect, it } from 'vitest';
import type { ContainerEntity, FurnaceEntity, InserterEntity } from '../../src/sim/machines';
import { insertInto, itemIndex } from '../../src/sim/machines';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

describe('Eisenkiste', () => {
  it('nimmt Items vom Band über einen Greifarm auf und gibt sie wieder ab', () => {
    const w = new World(1);
    for (let x = 0; x < 4; x++) w.place('transport-belt', x, 0, 1);
    const chest = w.place('iron-chest', 1, 2, 0) as ContainerEntity;
    const ins = w.place('burner-inserter', 1, 1, 2) as InserterEntity;
    insertInto(ins, 'coal', 5, 'player');
    for (let i = 0; i < 10; i++) {
      w.belts.insertAtPoint(w.belts.tileAt(0, 0)!, 0.1, 0.25, itemIndex('iron-plate'));
      w.run(90);
    }
    w.run(600);
    expect(chest.inventory.count('iron-plate')).toBe(10);
    // zweiter Greifarm leert die Kiste in einen Ofen (nur Erz/Brennstoff) – Platten nicht
    const f = w.place('stone-furnace', 0, 4, 0) as FurnaceEntity;
    const out = w.place('burner-inserter', 1, 3, 2) as InserterEntity;
    insertInto(out, 'coal', 2, 'player');
    w.run(300);
    expect(f.source.count('iron-plate')).toBe(0);
    expect(chest.inventory.count('iron-plate')).toBe(10);
    expect(chest.def.slots).toBe(32);
  });
});

describe('Items auf dem Boden', () => {
  it('Greifarm legt ohne Ziel auf den Boden ab, ein zweiter nimmt sie wieder auf', () => {
    const w = new World(1);
    for (let x = 0; x < 4; x++) w.place('transport-belt', x, 0, 1);
    const ins = w.place('burner-inserter', 1, 1, 2) as InserterEntity;
    insertInto(ins, 'coal', 5, 'player');
    w.belts.insertAtPoint(w.belts.tileAt(0, 0)!, 0.1, 0.25, itemIndex('stone'));
    w.run(300);
    expect([...w.ground.values()].flat().map((g) => g.item)).toEqual(['stone']);
    // Stelle belegt: weiterer Stein wartet in der Hand
    w.belts.insertAtPoint(w.belts.tileAt(0, 0)!, 0.1, 0.25, itemIndex('stone'));
    w.run(300);
    expect(ins.held).toBe('stone');
    // zweiter Greifarm räumt das Feld (1,2) in eine Kiste
    const chest = w.place('iron-chest', 1, 4, 0) as ContainerEntity;
    const ins2 = w.place('burner-inserter', 1, 3, 2) as InserterEntity;
    insertInto(ins2, 'coal', 5, 'player');
    w.run(600);
    expect(chest.inventory.count('stone')).toBe(2);
    expect(w.ground.size).toBe(0);
  });

  it('Spieler legt ab und hebt auf; Bodenitems überstehen Speichern und Laden', () => {
    const w = new World(1);
    const p = new Player(0.5, 0.5);
    p.inventory.add('iron-plate', 3);
    w.player = p;
    expect(p.dropItem(w, 'iron-plate', 2.5, 0.5)).toBe(true);
    expect(p.dropItem(w, 'iron-plate', 2.5, 0.5)).toBe(false); // Stelle belegt
    expect(p.dropItem(w, 'iron-plate', 2.5, 1.5)).toBe(true);
    const json = JSON.stringify(serializeWorld(w));
    const w2 = deserializeWorld(JSON.parse(json));
    expect([...w2.ground.values()].flat().length).toBe(2);
    w2.player!.px = 2.5 * 256;
    w2.player!.py = 1.0 * 256;
    w2.player!.pickingUp = true;
    w2.run(20);
    expect(w2.player!.inventory.count('iron-plate')).toBe(3);
    expect(w2.ground.size).toBe(0);
  });
});
