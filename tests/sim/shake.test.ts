import { describe, expect, it } from 'vitest';
import { SHAKE } from '../../src/data/fx';
import { ScreenShake } from '../../src/render/shake';

describe('Bildschirmwackeln (Skill game-feel)', () => {
  it('Trauma addiert sich bis 1, klingt in 1/Abbau Sekunden ab und endet genau in Ruhe', () => {
    const s = new ScreenShake();
    s.strength = 1;
    s.add(0.6);
    s.add(0.6);
    expect(s.trauma).toBe(1);
    let moved = false;
    for (let t = 0; t < 1 / SHAKE.decay + 0.05; t += 1 / 60) {
      const o = s.update(1 / 60);
      if (Math.abs(o.x) > 0.5 || Math.abs(o.y) > 0.5) moved = true;
      expect(Math.abs(o.x)).toBeLessThanOrEqual(SHAKE.maxOffset[0]);
    }
    expect(moved).toBe(true);
    expect(s.trauma).toBe(0);
    expect(s.update(1 / 60)).toEqual({ x: 0, y: 0 });
  });

  it('Stärke 0 schaltet ab', () => {
    const s = new ScreenShake();
    s.strength = 0;
    s.add(1);
    expect(s.trauma).toBe(0);
    expect(s.update(0.016)).toEqual({ x: 0, y: 0 });
  });
});
