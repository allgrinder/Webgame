import { describe, expect, it } from 'vitest';
import type { ElectricSource } from '../../src/sim/energy';
import type { Dir } from '../../src/sim/geom';
import { type AssemblerEntity, type BoilerEntity, type ContainerEntity, type InserterEntity, type LabEntity, type SplitterEntity, insertInto, itemIndex } from '../../src/sim/machines';
import { World } from '../../src/sim/world';

/** Werte aus dem Wiki (docs/WIKI_ABGLEICH.md). */
describe('Abgleich mit dem Wiki', () => {
  function chestToChest(name: string): number {
    const w = new World(1);
    const a = w.place('iron-chest', 0, 0, 0) as ContainerEntity;
    const ins = w.place(name, 1, 0, 1) as InserterEntity;
    const b = w.place('iron-chest', 2, 0, 0) as ContainerEntity;
    insertInto(a, 'iron-plate', 500, 'player');
    if (ins.burner) insertInto(ins, 'coal', 5, 'player');
    let first = -1;
    let t = 0;
    for (; t < 3000 && b.inventory.count('iron-plate') < 21; t++) {
      if (!ins.burner) (ins.energy as ElectricSource).buffer = 1e9;
      w.step();
      if (first < 0 && b.inventory.count('iron-plate') === 1) first = t;
    }
    return (t - 1 - first) / 20; // Ticks je Zyklus über 20 Zyklen
  }

  it('Greifarme: 76 / 70 / 48 Ticks je Zyklus (Kiste zu Kiste)', () => {
    expect(chestToChest('burner-inserter')).toBe(76);
    expect(chestToChest('inserter')).toBe(70);
    expect(chestToChest('long-handed-inserter') ).toBeGreaterThan(0);
  });

  it('Langer Greifarm: 48 Ticks je Zyklus', () => {
    const w = new World(1);
    const a = w.place('iron-chest', 0, 0, 0) as ContainerEntity;
    const ins = w.place('long-handed-inserter', 2, 0, 1) as InserterEntity;
    const b = w.place('iron-chest', 4, 0, 0) as ContainerEntity;
    insertInto(a, 'iron-plate', 500, 'player');
    const times: number[] = [];
    for (let t = 0; t < 2000 && times.length < 11; t++) {
      (ins.energy as ElectricSource).buffer = 1e9;
      const before = b.inventory.count('iron-plate');
      w.step();
      if (b.inventory.count('iron-plate') > before) times.push(t);
    }
    expect((times[10] - times[0]) / 10).toBe(48);
  });

  it('Kessel: 1 Wasser ergibt 10 Dampf', () => {
    const w = new World(1);
    const boiler = w.place('boiler', 0, 0, 0) as BoilerEntity;
    insertInto(boiler, 'coal', 5, 'player');
    w.step();
    boiler.water.net!.add('water', 10_000); // 10 Einheiten Wasser
    w.run(300);
    expect(boiler.water.net!.amount).toBe(0);
    expect(boiler.steam.net!.amount).toBe(100_000); // 100 Einheiten Dampf
  });

  it('Füllgrenze: 1 Vorgang + Vorgänge in 1,166 s (mind. 2)', () => {
    const w = new World(1);
    const asm = w.place('assembling-machine-1', 0, 0, 0) as AssemblerEntity;
    asm.setRecipe('iron-gear-wheel'); // 1 s je Zahnrad → 1 + 2 = 3 Vorgänge = 6 Platten
    expect(asm.acceptAmount('iron-plate', 'inserter')).toBe(6);
    asm.setRecipe('electronic-circuit'); // 1 s → 3 Vorgänge: 9 Kabel, 3 Platten
    expect(asm.acceptAmount('copper-cable', 'inserter')).toBe(9);
    const f = w.place('stone-furnace', 5, 0, 0)!;
    expect(f.acceptAmount('iron-ore', 'inserter')).toBe(2); // 3,2 s → 2 Vorgänge
  });

  it('Labore: Greifarm reicht Pakete von Labor zu Labor weiter', () => {
    const w = new World(1);
    const a = w.place('lab', 0, 0, 0) as LabEntity;
    const ins = w.place('inserter', 3, 1, 1) as InserterEntity;
    const b = w.place('lab', 4, 0, 0) as LabEntity;
    w.research.complete('automation-science-pack');
    w.research.start('automation');
    insertInto(a, 'automation-science-pack', 10, 'player');
    for (let t = 0; t < 600; t++) {
      (ins.energy as ElectricSource).buffer = 1e9;
      w.step();
    }
    expect(b.packs.count('automation-science-pack')).toBe(2); // Füllgrenze 2 Einheiten (10 s je Einheit)
    expect(a.packs.count('automation-science-pack')).toBe(8);
    // in eine Kiste gibt das Labor nichts ab
    w.remove(b.id);
    const c = w.place('iron-chest', 4, 1, 0) as ContainerEntity;
    for (let t = 0; t < 300; t++) {
      (ins.energy as ElectricSource).buffer = 1e9;
      w.step();
    }
    expect(c.inventory.count('automation-science-pack')).toBe(0);
  });

  function laneOfDrop(beltDir: Dir, insDir: Dir, ix: number, iy: number): number {
    const w = new World(1);
    w.place('transport-belt', 0, 0, beltDir);
    const src = w.place('iron-chest', ix - (insDir === 1 ? 1 : insDir === 3 ? -1 : 0), iy - (insDir === 2 ? 1 : insDir === 0 ? -1 : 0), 0) as ContainerEntity;
    const ins = w.place('inserter', ix, iy, insDir) as InserterEntity;
    insertInto(src, 'iron-plate', 1, 'player');
    for (let t = 0; t < 40; t++) {
      (ins.energy as ElectricSource).buffer = 1e9;
      w.belts.ensure();
      w.step();
      const it = w.belts.itemsOnTile(w.belts.tileAt(0, 0)!);
      if (it.length) return it[0].lane;
    }
    return -1;
  }

  it('Ablage auf Bänder: quer die ferne Spur, längs die rechte Spur', () => {
    // Band nach Norden, Greifarm östlich legt nach Westen ab → ferne = linke Spur (0)
    expect(laneOfDrop(0, 3, 1, 0)).toBe(0);
    // Greifarm westlich legt nach Osten ab → ferne = rechte Spur (1)
    expect(laneOfDrop(0, 1, -1, 0)).toBe(1);
    // Greifarm südlich legt nach Norden auf ein Band nach Norden → rechte Spur
    expect(laneOfDrop(0, 0, 0, 1)).toBe(1);
  });

  function splitterWorld() {
    const w = new World(1);
    for (let x = 0; x < 4; x++) w.place('transport-belt', x, 0, 1);
    const sp = w.place('splitter', 4, 0, 1) as SplitterEntity;
    for (let x = 5; x < 9; x++) {
      w.place('transport-belt', x, 0, 1);
      w.place('transport-belt', x, 1, 1);
    }
    return { w, sp };
  }

  it('Splitter: Ausgangsvorrang und Filter', () => {
    const { w, sp } = splitterWorld();
    sp.state.outputPriority = 1; // rechts = zweite Hälfte (y = 1)
    const start = w.belts.tileAt(0, 0)!;
    for (let t = 0; t < 300; t++) {
      if (t % 20 === 0) w.belts.insertAtPoint(start, 0.1, 0.25, itemIndex('iron-ore'));
      w.step();
    }
    expect(w.belts.itemsOnTile(w.belts.tileAt(8, 0)!).length).toBe(0);
    expect(w.belts.itemsOnTile(w.belts.tileAt(8, 1)!).length).toBeGreaterThan(0);
    // Filter: Kohle nur nach links (Vorrangseite 0), Erz nach rechts
    const f = splitterWorld();
    f.sp.state.filter = itemIndex('coal');
    f.sp.state.outputPriority = 0;
    const s0 = f.w.belts.tileAt(0, 0)!;
    let left = new Set<number>();
    let right = new Set<number>();
    for (let t = 0; t < 600; t++) {
      if (t % 20 === 0) f.w.belts.insertAtPoint(s0, 0.1, 0.25, itemIndex(t % 40 === 0 ? 'coal' : 'iron-ore'));
      f.w.step();
      for (const it of f.w.belts.itemsOnTile(f.w.belts.tileAt(7, 0)!)) left.add(it.item);
      for (const it of f.w.belts.itemsOnTile(f.w.belts.tileAt(7, 1)!)) right.add(it.item);
    }
    expect([...left]).toEqual([itemIndex('coal')]);
    expect([...right]).toEqual([itemIndex('iron-ore')]);
    left = right = new Set();
  });

  it('Untergrundband nimmt seitlich nur auf der Band-Hälfte auf', () => {
    const w = new World(1);
    w.place('underground-belt', 2, 0, 1); // Eingang nach Osten
    w.place('underground-belt', 5, 0, 1); // Ausgang
    for (let x = 6; x < 9; x++) w.place('transport-belt', x, 0, 1);
    // Zubringer von Norden nach Süden auf den Eingang
    for (let y = -4; y < 0; y++) w.place('transport-belt', 2, y, 2);
    const feed = w.belts.tileAt(2, -4)!;
    for (let t = 0; t < 900; t++) {
      if (t % 30 === 0) {
        w.belts.insertAtPoint(feed, 0.25, 0.1, itemIndex('coal')); // linke Spur des Zubringers (Osten)
        w.belts.insertAtPoint(feed, 0.75, 0.1, itemIndex('iron-ore')); // rechte Spur (Westen)
      }
      w.step();
    }
    const out = new Set(w.belts.itemsOnTile(w.belts.tileAt(8, 0)!).map((i) => i.item));
    const end = w.belts.tileAt(8, 0)!;
    expect(w.belts.itemsOnTile(end).length).toBeGreaterThan(0);
    expect(out.size).toBe(1);
  });
});

describe('Auslöser-Forschung (2.0)', () => {
  it('10 Kupferplatten → Elektronik, 50 Eisenplatten → Dampfkraft, Labor → Automatisierungs-Wissenschaft', async () => {
    const { Player } = await import('../../src/sim/player');
    const w = new World(1);
    const p = new Player(0.5, 0.5);
    w.player = p;
    expect(p.recipeUnlocked('copper-cable')).toBe(false);
    expect(w.research.start('electronics')).toBe(false); // nicht per Labor erforschbar
    w.research.onCrafted('copper-plate', 9);
    expect(w.research.done.has('electronics')).toBe(false);
    w.research.onCrafted('copper-plate', 1);
    expect(w.research.done.has('electronics')).toBe(true);
    expect(p.recipeUnlocked('copper-cable')).toBe(true);
    // Labor herstellen, bevor Dampfkraft erforscht ist: zählt, schließt aber erst danach ab
    w.research.onCrafted('lab', 1);
    expect(w.research.done.has('automation-science-pack')).toBe(false);
    w.research.onCrafted('iron-plate', 50);
    expect(w.research.done.has('steam-power')).toBe(true);
    expect(w.research.done.has('automation-science-pack')).toBe(true);
    // Ofen meldet geschmolzene Platten
    const v = new World(2);
    const f = v.place('stone-furnace', 0, 0, 0)!;
    insertInto(f, 'coal', 5, 'player');
    insertInto(f, 'copper-ore', 10, 'player');
    v.run(60 * 40);
    expect(v.research.done.has('electronics')).toBe(true);
  });
});
