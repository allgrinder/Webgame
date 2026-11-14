import { describe, expect, it } from 'vitest';
import { buildFactoryWorld } from '../../src/game/factoryscene';

/**
 * Budget der Simulation in der Großfabrik (Skill performance-optimization: Budget je Teilsystem, Ergebnis in ms
 * mit Durchschnitt und p95). Bei 60 Takten/s stehen 16,7 ms je Bild zur Verfügung; die Simulation soll höchstens
 * ein Drittel davon nehmen. Die Grenze ist großzügig, damit ein belasteter Rechner den Test nicht kippt.
 */
describe('Leistung: Simulation der Großfabrik', () => {
  it('hält das Budget (p95 je Takt)', () => {
    const w = buildFactoryWorld();
    expect(w.entities.size).toBeGreaterThan(5000);
    w.run(300);
    const ts: number[] = [];
    for (let i = 0; i < 600; i++) {
      const t0 = performance.now();
      w.step();
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    const avg = ts.reduce((s, v) => s + v, 0) / ts.length;
    const p95 = ts[Math.floor(ts.length * 0.95)];
    console.log(`Großfabrik ${w.entities.size} Gebäude: Ø ${avg.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, max ${ts[ts.length - 1].toFixed(2)} ms je Takt`);
    expect(p95).toBeLessThan(8);
  }, 60_000);
});
