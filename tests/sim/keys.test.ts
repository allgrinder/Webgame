import { describe, expect, it } from 'vitest';
import { KEY_ACTIONS, KeyMap } from '../../src/game/keys';

describe('Tastenbelegung (Skill input-systems)', () => {
  it('Standard ohne Doppelbelegung, Konflikt wird getauscht, feste Tasten gesperrt', () => {
    const keys = KEY_ACTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const km = new KeyMap(false);
    expect(km.action('e')).toBe('inventory');
    expect(km.action('=')).toBe('brushUp');
    // ZQSD (AZERTY): „hoch“ auf z – z lag auf „ablegen“ und bekommt w
    const r = km.set('up', 'z');
    expect(r.swapped).toBe('drop');
    expect(km.key('up')).toBe('z');
    expect(km.key('drop')).toBe('w');
    expect(km.action('z')).toBe('up');
    expect(km.isDown(new Set(['z']), 'up')).toBe(true);
    expect(km.set('inventory', 'escape').error).toBeTruthy();
    expect(km.set('inventory', '3').error).toBeTruthy();
    km.reset();
    expect(km.key('up')).toBe('w');
    expect(km.isDown(new Set(['space']), 'shoot')).toBe(true);
  });
});
