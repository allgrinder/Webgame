import { describe, expect, it } from 'vitest';
import { Player } from '../../src/sim/player';
import { World } from '../../src/sim/world';

/** Figur läuft 6 Felder nach Osten; liefert die erreichte x-Lage. */
function walkEast(blocker: string | null): number {
  const w = new World(5);
  const p = new Player(0.5, 0.5);
  w.player = p;
  w.map.clearTrees(-10, -10, 30, 30);
  for (let y = -5; y < 5; y++) for (let x = -5; x < 15; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  if (blocker) expect(w.place(blocker, 3, 0, 0), blocker).toBeTruthy();
  p.moveX = 1;
  for (let i = 0; i < 240 && p.x < 6.5; i++) w.step();
  return p.x;
}

describe('Masten und Lampen begehbar (Wunsch 09.11.2026)', () => {
  it('Figur läuft durch kleine/mittlere Masten und Lampen, aber nicht durch Kisten', () => {
    for (const name of ['small-electric-pole', 'medium-electric-pole', 'lamp']) expect(walkEast(name), name).toBeGreaterThan(6);
    expect(walkEast('iron-chest')).toBeLessThan(3);
  });
});
