import { describe, expect, it } from 'vitest';
import { isGzip, pack, unpack } from '../../src/game/packing';
import { createScene } from '../../src/game/scenes';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';

describe('Spielstand-Komprimierung', () => {
  it('gzip-Rundweg ist verlustfrei und deutlich kleiner', () => {
    const w = createScene('demo', 12345).world;
    w.run(600);
    const data = serializeWorld(w);
    const json = JSON.stringify(data);
    const z = pack(data);
    expect(isGzip(z)).toBe(true);
    expect(z.length).toBeLessThan(json.length / 4);
    const back = deserializeWorld(unpack(z));
    expect(JSON.stringify(serializeWorld(back))).toBe(json);
  });
});
