import { describe, expect, it } from 'vitest';
import { stressScene } from '../../src/game/scenes';

describe('Lastszene', () => {
  it('hat 5.000 Bandfelder und 10.000 Items und simuliert schnell', () => {
    const { world } = stressScene();
    expect(world.belts.count).toBe(5000);
    expect(world.belts.itemCount).toBe(10000);
    world.run(60);
    const t0 = performance.now();
    world.run(600);
    const ms = (performance.now() - t0) / 600;
    // Items bleiben erhalten (geschlossene Schleifen)
    expect(world.belts.itemCount).toBe(10000);
    console.log(`Simulation: ${ms.toFixed(3)} ms/Tick`);
    expect(ms).toBeLessThan(4);
  });
});
