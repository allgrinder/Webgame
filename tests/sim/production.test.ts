import { describe, expect, it } from 'vitest';
import type { AssemblerEntity, BoilerEntity, LabEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

/** Wasser → Pumpe → Kessel → Dampfmaschine → Mast (4,0); Montagemaschine (5,1), Labor (5,-3). */
function factory(): { w: World; asm: AssemblerEntity; lab: LabEntity } {
  const w = new World(1);
  for (let y = -8; y < 10; y++) for (let x = -6; x < 12; x++) {
    w.map.setResource(x, y, 0, 0);
    w.map.setWater(x, y, false);
  }
  w.map.setWater(0, 0, true);
  expect(w.place('offshore-pump', 0, 1, 2)).toBeTruthy();
  w.place('pipe', 0, 2, 0);
  w.place('pipe', 0, 3, 0);
  const boiler = w.place('boiler', 1, 2, 0) as BoilerEntity;
  insertInto(boiler, 'coal', 50, 'player');
  expect(w.place('steam-engine', 1, -3, 0)).toBeTruthy();
  expect(w.place('small-electric-pole', 4, 0, 0)).toBeTruthy();
  const asm = w.place('assembling-machine-1', 5, 1, 0) as AssemblerEntity;
  const lab = w.place('lab', 5, -3, 0) as LabEntity;
  expect(asm).toBeTruthy();
  expect(lab).toBeTruthy();
  return { w, asm, lab };
}

describe('Montagemaschine und Forschung', () => {
  it('Montagemaschine stellt Zahnräder her (1 s je Stück bei Geschwindigkeit 0,5)', () => {
    const { w, asm } = factory();
    expect(asm.energy.usagePerTick).toBe(1250);
    expect(asm.energy.drainPerTick).toBe(42);
    expect(asm.acceptAmount('iron-plate', 'player')).toBe(0); // ohne Rezept nichts
    asm.setRecipe('iron-gear-wheel');
    expect(asm.recipeTicks(asm.recipe!)).toBe(60);
    expect(asm.insert('iron-plate', 10, 'player')).toBe(10);
    expect(asm.acceptAmount('coal', 'player')).toBe(0);
    let gears = 0;
    for (let t = 0; t < 60 * 8; t++) {
      w.step();
      while (asm.take(w, () => true)) gears++;
    }
    expect(gears).toBe(5);
    expect(asm.status).toBe(4); // Keine Zutaten
  });

  it('Greifarme füllen nur begrenzt nach, Ausgabe staut bei zwei Ergebnissen', () => {
    const { w, asm } = factory();
    asm.setRecipe('iron-gear-wheel');
    const lim = asm.acceptAmount('iron-plate', 'inserter');
    expect(lim).toBeGreaterThan(2);
    expect(lim).toBeLessThan(10);
    asm.insert('iron-plate', 20, 'player');
    w.run(60 * 6);
    expect(asm.output.count('iron-gear-wheel')).toBe(2);
    expect(asm.status).toBe(3);
    // Rezeptwechsel gibt alles zurück
    const back = asm.setRecipe('copper-cable');
    const total = back.reduce((n, s) => n + (s.item === 'iron-plate' ? s.count : 0), 0);
    expect(total).toBe(20 - 4);
    expect(back.find((s) => s.item === 'iron-gear-wheel')?.count).toBe(2);
  });

  it('Forschung schaltet Rezepte frei; Labor verbraucht ein Paket je Einheit', () => {
    const { w, lab } = factory();
    const p = new Player(-3.5, 6.5);
    w.player = p;
    p.inventory.add('electronic-circuit', 3);
    p.inventory.add('iron-gear-wheel', 5);
    p.inventory.add('iron-plate', 9);
    expect(p.craftableCount('assembling-machine-1')).toBe(0);
    expect(p.craft('assembling-machine-1')).toBe(0);
    expect(w.research.start('logistics-2')).toBe(false); // Voraussetzungen fehlen
    expect(w.research.start('automation')).toBe(true);
    expect(lab.insert('automation-science-pack', 10, 'player')).toBe(10);
    w.run(60 * 50);
    expect(w.research.fraction('automation')).toBeGreaterThan(0.45);
    expect(w.research.fraction('automation')).toBeLessThan(0.55);
    w.run(60 * 52);
    expect(w.research.done.has('automation')).toBe(true);
    expect(w.research.current).toBeNull();
    expect(lab.packs.count('automation-science-pack')).toBe(0);
    expect(lab.status).toBe(6); // kein Forschungsziel
    expect(p.craftableCount('assembling-machine-1')).toBe(1);
    expect(w.research.available('logistics-2')).toBe(false);
  });

  it('Speichern und Laden mitten in Forschung und Herstellung ist deterministisch', () => {
    const { w: a, asm, lab } = factory();
    asm.setRecipe('iron-gear-wheel');
    asm.insert('iron-plate', 30, 'player');
    a.research.start('logistics');
    lab.insert('automation-science-pack', 30, 'player');
    a.run(777);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(a))));
    for (let t = 0; t < 3000; t++) {
      a.step();
      b.step();
      for (const w of [a, b]) {
        const m = [...w.entities.values()].find((e) => e.kind === 'assembler') as AssemblerEntity;
        m.take(w, () => true);
      }
    }
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(a)));
    expect(b.research.fraction('logistics')).toBeGreaterThan(0);
  });
});
