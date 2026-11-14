import { describe, expect, it } from 'vitest';
import { RECIPE_LIST } from '../../src/data/recipes';
import { TECHS } from '../../src/data/tech';
import { compassDe, nearestChartedResource } from '../../src/sim/chart';
import { allProducts, progression } from '../../src/sim/progression';
import { resourceById } from '../../src/data/resources';
import { World } from '../../src/sim/world';
import { Player } from '../../src/sim/player';

describe('Fortschritt (Skill survival-crafting)', () => {
  it('jedes Item, jede Flüssigkeit, jedes Rezept und jede Forschung ist vom Spielstart aus erreichbar', () => {
    const p = progression();
    expect(allProducts().filter((i) => !p.items.has(i))).toEqual([]);
    expect(RECIPE_LIST.filter((r) => !p.recipes.has(r.id)).map((r) => r.id)).toEqual([]);
    expect(TECHS.filter((t) => !p.techs.has(t.id)).map((t) => t.id)).toEqual([]);
    // grobe Reihenfolge stimmt: Rakete kommt nach Stahl, Stahl nach Eisen
    expect(p.items.get('iron-plate')!).toBeLessThan(p.items.get('steel-plate')!);
    expect(p.items.get('steel-plate')!).toBeLessThan(p.items.get('rocket-part')!);
  });

  it('Handwerk mit vollem Inventar verliert nichts (Rest fällt auf den Boden)', () => {
    const w = new World(3);
    const pl = new Player(0, 0);
    w.player = pl;
    pl.inventory.add('iron-plate', 2);
    pl.inventory.add('stone', 50 * 200); // Inventar voll
    expect(pl.craft('iron-gear-wheel', 1)).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) w.step();
    const onGround = [...w.ground.values()].flat().filter((g) => g.item === 'iron-gear-wheel').length;
    expect(pl.inventory.count('iron-gear-wheel') + onGround).toBe(1);
  });

  it('nächster bekannter Fundort: nur aufgedeckte Abschnitte, mit Himmelsrichtung', () => {
    const w = new World(5);
    const oil = resourceById('crude-oil').index;
    for (let y = -100; y < 4; y++) for (let x = 60; x < 164; x++) w.map.setResource(x, y, 0, 0);
    w.map.setResource(100, -40, oil, 100_000);
    expect(nearestChartedResource(w, oil, 0, 0)).toBeNull();
    w.chart.chartAround(100, -40, 1, 0);
    const f = nearestChartedResource(w, oil, 0, 0)!;
    expect(f).not.toBeNull();
    expect(Math.round(f.dist)).toBeGreaterThan(100);
    expect(compassDe(0, 0, f.x, f.y)).toBe('Osten');
    expect(compassDe(0, 0, 0, -10)).toBe('Norden');
    expect(compassDe(0, 0, -10, 10)).toBe('Südwesten');
  });
});

describe('Schmelzrezepte nachschlagen', () => {
  it('über das Ergebnis (Tooltip) und über die Zutat (Ofen) sind verschieden', async () => {
    const { smeltingRecipeFor, smeltingRecipeProducing } = await import('../../src/data/recipes');
    expect(smeltingRecipeProducing('iron-plate')?.ingredients[0].item).toBe('iron-ore');
    expect(smeltingRecipeProducing('steel-plate')?.ingredients[0].item).toBe('iron-plate');
    expect(smeltingRecipeFor('iron-plate')?.results[0].item).toBe('steel-plate');
    expect(smeltingRecipeProducing('iron-ore')).toBeUndefined();
  });
});
