import { describe, expect, it } from 'vitest';
import { CHART } from '../../src/data/chart';
import type { ElectricSource } from '../../src/sim/energy';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-30, -30, 60, 60);
  for (let y = -20; y < 20; y++) for (let x = -20; x < 30; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}
function run(w: World, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    for (const e of w.entities.values()) {
      const en = (e as { energy?: { type?: string } | null }).energy;
      if (en?.type === 'electric') (en as ElectricSource).buffer = 1e9;
    }
    w.step();
  }
}

describe('Radar und Kartenaufdeckung (Wiki „Radar“)', () => {
  it('Startgebiet 7×7, Figur deckt 5×5 um sich auf, Rest bleibt verborgen', () => {
    const w = clearWorld();
    w.player = new Player(0.5, 0.5);
    run(w, 1);
    expect(w.chart.count).toBe((CHART.startRadius * 2 + 1) ** 2);
    expect(w.chart.isCharted(500, 0)).toBe(false);
    // Figur wird versetzt: Umgebung wird beim nächsten Sekundenpuls aufgedeckt
    w.player.px = 600 * 256;
    w.player.py = 0;
    run(w, 60);
    expect(w.chart.isCharted(600, 0)).toBe(true);
    expect(w.chart.isCharted(600 + 2 * CHART.chunk, 0)).toBe(true);
    expect(w.chart.isCharted(600 + 3 * CHART.chunk, 0)).toBe(false);
  });

  it('Radar: 7×7 ständig, alle 33,3 s ein ferner Abschnitt (zuerst Ring 4 links oben), Speichern/Laden', () => {
    const w = clearWorld();
    const r = w.place('radar', 0, 0, 0)!;
    run(w, 61);
    const nearCount = w.chart.count;
    expect(w.chart.chunkCharted(3, 3)).toBe(true);
    expect(w.chart.chunkCharted(-3, -3)).toBe(true);
    // 10 MJ bei 300 kW = 2000 Ticks
    expect(CHART.scanEnergy / (300_000 / 60)).toBe(2000);
    run(w, 2000);
    expect(w.chart.count).toBe(nearCount + 1);
    expect(w.chart.chunkCharted(-4, -4)).toBe(true);
    expect((r as { lastScan: [number, number] | null }).lastScan).toEqual([-4, -4]);
    run(w, 2000);
    expect(w.chart.chunkCharted(-3, -4)).toBe(true);
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    run(w, 2100);
    run(b, 2100);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
    expect(w.chart.chunkCharted(-2, -4)).toBe(true);
  });

  it('Radare übertragen Schaltungssignale drahtlos an alle anderen Radare', () => {
    const w = clearWorld();
    const c = w.place('constant-combinator', 0, 0, 0)!;
    const ra = w.place('radar', 2, 0, 0)!;
    const rb = w.place('radar', 20, 0, 0)!;
    const lamp = w.place('lamp', 24, 0, 0)!;
    w.circuit.settings.set(c.id, { signals: [{ signal: 'signal-A', count: 5 }] });
    expect(w.circuit.toggle(w, { id: c.id, side: 0 }, { id: ra.id, side: 0 }, 'red')).toBe('added');
    expect(w.circuit.toggle(w, { id: rb.id, side: 0 }, { id: lamp.id, side: 0 }, 'red')).toBe('added');
    run(w, 5);
    expect(w.circuit.input(lamp.id, 0).get('signal-A')).toBe(5);
  });
});
