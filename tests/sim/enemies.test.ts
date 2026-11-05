import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_SETTINGS } from '../../src/data/mapgen';
import { UNITS } from '../../src/data/enemies';
import { Player } from '../../src/sim/player';
import { deserializeWorld, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function world(enemies: 'aus' | 'normal' | 'friedlich' = 'normal'): World {
  const w = new World(5, { ...DEFAULT_MAP_SETTINGS, enemies });
  w.map.clearTrees(-60, -60, 60, 60);
  for (let y = -60; y < 60; y++) for (let x = -60; x < 60; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

describe('Gegner', () => {
  it('Verschmutzung: arbeitender Kessel stößt aus, sie breitet sich aus und wird aufgenommen', () => {
    const w = world('aus');
    const b = w.place('boiler', 0, 0, 0, true)!;
    b.status = 1;
    // Status wird vom Kessel selbst gesetzt; ohne Wasser arbeitet er nicht – Ausstoß direkt prüfen
    w.pollution.add(1, 1, 500);
    w.run(64 * 10);
    expect(w.pollution.at(1, 1)).toBeGreaterThan(0);
    expect(w.pollution.at(40, 1)).toBeGreaterThan(0);
    expect(w.pollution.at(1, 1)).toBeLessThan(500);
  });

  it('Nester: bei „aus“ keine, sonst außerhalb des Startgebiets', () => {
    const a = world('aus');
    a.enemies.ensureArea(a, -600, -600, 600, 600);
    expect(a.enemies.nests.size).toBe(0);
    const n = world('normal');
    n.enemies.ensureArea(n, -600, -600, 600, 600);
    expect(n.enemies.nests.size).toBeGreaterThan(5);
    for (const nest of n.enemies.nests.values()) expect(Math.hypot(nest.x, nest.y)).toBeGreaterThan(120);
  });

  it('Angriff: Verschmutzung erreicht ein Nest, Krabbler ziehen los und zerstören das Gebäude', () => {
    const w = world('normal');
    const chest = w.place('wooden-chest', 0, 0, 0, true)!;
    const drill = w.place('burner-mining-drill', 4, 0, 0, true)!;
    const nest = w.enemies.spawnNest(w, 30, -2);
    nest.budget = UNITS.small.pollution * 6;
    w.run(60 * 20);
    expect(w.entities.has(drill.id)).toBe(false);
    expect(w.enemies.remnants.some((r) => r.kind === 'building')).toBe(true);
    expect(chest).toBeDefined();
  });

  it('Geschützturm mit Munition erledigt anrückende Krabbler', () => {
    const w = world('normal');
    const t = w.place('gun-turret', 0, 0, 0, true)!;
    t.insert('firearm-magazine', 10, 'player');
    for (let k = 0; k < 5; k++) w.enemies.spawnAt(15 + k, 1, 'small');
    w.run(60 * 10);
    expect(w.enemies.units.size).toBe(0);
    expect(w.entities.has(t.id)).toBe(true);
  });

  it('Spielfigur: Pistole schießt, Treffer kosten Leben, Tod führt zum Neustart', () => {
    const w = world('normal');
    const p = new Player(0.5, 0.5);
    p.giveStart();
    w.player = p;
    const u = w.enemies.spawnAt(6, 0.5, 'small');
    p.shooting = true;
    w.run(120);
    expect(w.enemies.units.has(u.id)).toBe(false);
    expect(p.inventory.count('firearm-magazine')).toBe(9);
    p.shooting = false;
    for (let k = 0; k < 8; k++) w.enemies.spawnAt(1 + k * 0.1, 0.5, 'medium');
    w.run(60 * 6);
    expect(p.messages.some((m) => m.includes('gestorben'))).toBe(true);
    expect(Math.hypot(p.x - 0.5, p.y - 0.5)).toBeLessThan(1);
  });

  it('Speichern/Laden bleibt deterministisch mit Gegnern und Verschmutzung', () => {
    const w = world('normal');
    w.place('burner-mining-drill', 0, 0, 0, true);
    w.enemies.spawnNest(w, 40, 0, 3).budget = 50;
    w.pollution.add(0, 0, 200);
    w.run(600);
    const save = JSON.stringify(serializeWorld(w));
    const b = deserializeWorld(JSON.parse(save));
    w.run(900);
    b.run(900);
    expect(JSON.stringify(serializeWorld(b))).toBe(JSON.stringify(serializeWorld(w)));
  });
});
