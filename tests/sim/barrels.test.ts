import { describe, expect, it } from 'vitest';
import { STEAM_POWER } from '../../src/data/blueprints';
import { EMPTY_ANY_BARREL, FILL_ANY_BARREL } from '../../src/data/recipes';
import { placed, settingsOf } from '../../src/sim/blueprint';
import type { AssemblerEntity } from '../../src/sim/machines';
import { insertInto } from '../../src/sim/machines';
import { World } from '../../src/sim/world';

function world(): World {
  const w = new World(1);
  for (let y = -14; y < 12; y++) for (let x = -14; x < 14; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  w.map.setWater(-10, -12, true);
  for (const p of placed(STEAM_POWER, -10, -12)) w.place(p.name, p.x, p.y, p.dir);
  insertInto([...w.entities.values()].find((e) => e.kind === 'boiler')!, 'coal', 50, 'player');
  w.place('small-electric-pole', -4, -4, 0);
  w.place('small-electric-pole', -1, -2, 0);
  w.place('small-electric-pole', 3, 3, 0);
  w.place('small-electric-pole', 9, 3, 0);
  return w;
}

describe('Fässer (Wiki „Barrel“)', () => {
  it('Montagemaschine 2 füllt Wasser in Fässer und leert sie wieder in ein Rohr', () => {
    const w = world();
    w.map.setWater(1, -3, true);
    expect(w.place('offshore-pump', 1, -3, 2)).toBeTruthy();
    w.place('pipe', 1, -1, 0);
    const fill = w.place('assembling-machine-2', 0, 0, 0) as AssemblerEntity;
    fill.setRecipe('fill-water-barrel');
    insertInto(fill, 'empty-barrel', 10, 'player');
    w.run(60 * 10);
    const barrels = fill.contents().find((c) => c.item === 'water-barrel')?.count ?? 0;
    expect(barrels).toBeGreaterThan(0);

    // Leeren: Ausgang links in die Rohrleitung, Tank sammelt das Wasser
    const empty = w.place('assembling-machine-2', 8, 0, 0) as AssemblerEntity;
    empty.setRecipe('empty-water-barrel');
    insertInto(empty, 'water-barrel', 5, 'player');
    const pipe = w.place('pipe', 7, 1, 0)!;
    w.place('pipe', 6, 1, 0);
    w.run(60 * 10);
    expect(empty.contents().find((c) => c.item === 'empty-barrel')?.count ?? 0).toBeGreaterThan(0);
    const net = (pipe as unknown as { box: { net: { fluid: string; amount: number } | null } }).box.net;
    expect(net?.fluid).toBe('water');
  });

  it('Sammelrezepte: „Fass befüllen“ erkennt die Flüssigkeit im Rohr, „Fass entleeren“ nimmt jedes Fass', () => {
    const w = world();
    w.map.setWater(1, -3, true);
    expect(w.place('offshore-pump', 1, -3, 2)).toBeTruthy();
    w.place('pipe', 1, -1, 0);
    const fill = w.place('assembling-machine-2', 0, 0, 0) as AssemblerEntity;
    fill.setRecipe(FILL_ANY_BARREL);
    expect(fill.recipeKey).toBe(FILL_ANY_BARREL);
    insertInto(fill, 'empty-barrel', 10, 'player');
    w.run(60 * 10);
    expect(fill.recipe?.id).toBe('fill-water-barrel');
    expect(fill.contents().find((c) => c.item === 'water-barrel')?.count ?? 0).toBeGreaterThan(0);
    expect(settingsOf(fill)).toEqual({ recipe: FILL_ANY_BARREL });

    const empty = w.place('assembling-machine-2', 8, 0, 0) as AssemblerEntity;
    empty.setRecipe(EMPTY_ANY_BARREL);
    // nimmt jedes gefüllte Fass, aber kein leeres
    expect(insertInto(empty, 'empty-barrel', 1, 'inserter')).toBe(0);
    expect(insertInto(empty, 'crude-oil-barrel', 3, 'player')).toBe(3);
    const pipe = w.place('pipe', 7, 1, 0)!;
    w.place('pipe', 6, 1, 0);
    w.run(60 * 5);
    expect(empty.recipe?.id).toBe('empty-crude-oil-barrel');
    expect(empty.contents().find((c) => c.item === 'empty-barrel')?.count ?? 0).toBe(2); // Ausgang hält höchstens 2 Ergebnisse
    const net = (pipe as unknown as { box: { net: { fluid: string; amount: number } | null } }).box.net;
    expect(net?.fluid).toBe('crude-oil');

    // Spielstand: Sammelrezept bleibt erhalten
    const copy = w.place('assembling-machine-2', 0, 6, 0) as AssemblerEntity;
    copy.load(JSON.parse(JSON.stringify(empty.save())));
    expect(copy.recipeKey).toBe(EMPTY_ANY_BARREL);
    expect(copy.recipe?.id).toBe('empty-crude-oil-barrel');
  });
});
