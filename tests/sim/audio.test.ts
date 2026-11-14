import { describe, expect, it } from 'vitest';
import { AUDIO_BUSES, SOUNDS, busOf, sliderGain } from '../../src/audio/sound';

describe('Tongruppen (Skill audio-design)', () => {
  it('jeder Klang gehört zu einer Gruppe; Regler quadratisch, 0 stumm', () => {
    const ids = new Set(AUDIO_BUSES.map((b) => b.id));
    for (const name of Object.keys(SOUNDS)) expect(ids.has(busOf(name))).toBe(true);
    expect(busOf('click')).toBe('ui');
    expect(busOf('drill')).toBe('ambience');
    expect(busOf('explode')).toBe('sfx');
    expect(sliderGain(0)).toBe(0);
    expect(sliderGain(0.5)).toBeCloseTo(0.25);
    expect(sliderGain(1)).toBe(1);
    expect(SOUNDS.launch).toBeDefined();
  });
});
