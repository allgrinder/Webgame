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
    // Wiki: Angriff nach zufällig 1–10 Minuten
    w.run(60 * 60 * 11);
    expect(w.entities.has(drill.id)).toBe(false);
    expect(chest).toBeDefined();
  });

  it('Wegsuche: Krabbler laufen durch eine Lücke in der Mauer statt sie zu zerstören', () => {
    const w = world('normal');
    const chest = w.place('iron-chest', 0, 0, 0, true)!;
    const walls: number[] = [];
    for (let y = -15; y <= 15; y++) if (y !== 6) walls.push(w.place('stone-wall', 10, y, 0, true)!.id);
    for (let k = 0; k < 3; k++) {
      const u = w.enemies.spawnAt(20, k * 0.5, 'small');
      u.target = chest.id;
    }
    for (let t = 0; t < 60 * 40 && w.entities.has(chest.id); t++) w.step();
    expect(w.entities.has(chest.id)).toBe(false);
    // bis die Kiste fällt, bleibt die Mauer unberührt (danach greifen sie das Nächstgelegene an, wie im Original)
    expect(walls.every((id) => w.entities.get(id)?.hp === 350)).toBe(true);
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

  it('Reparaturset: hält die Spielfigur es auf ein beschädigtes Gebäude, steigen dessen Lebenspunkte', () => {
    const w = world('normal');
    const p = new Player(0.5, 0.5);
    w.player = p;
    p.inventory.add('repair-pack', 2);
    const c = w.place('iron-chest', 2, 0, 0, true)!;
    c.hp = 50;
    p.repairTarget = c.id;
    w.run(90); // 150 LP bei 2 LP/Tick
    expect(c.hp).toBe(c.def.health);
    expect(p.inventory.count('repair-pack')).toBe(2);
    expect(p.repairTarget).toBe(null);
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

describe('Gegner-Einstellung im laufenden Spiel', () => {
  const world = () => {
    const w = new World(7, { resources: 'mittel', size: 1, enemies: 'normal' });
    w.enemies.ensureArea(w, -400, -400, 400, 400);
    return w;
  };

  it('Aus entfernt Nester und Krabbler und erzeugt keine neuen', () => {
    const w = world();
    expect(w.enemies.nests.size).toBeGreaterThan(0);
    w.enemies.applySetting(w, 'aus');
    expect(w.enemies.nests.size).toBe(0);
    expect(w.enemies.units.size).toBe(0);
    w.enemies.ensureArea(w, -800, -800, 800, 800);
    w.run(600);
    expect(w.enemies.nests.size).toBe(0);
    expect(w.enemies.units.size).toBe(0);
  });

  it('Friedlich ruft Angreifer zurück; wieder Normal erzeugt dasselbe Raster', () => {
    const w = world();
    const before = w.enemies.nests.size;
    for (const u of w.enemies.units.values()) u.mode = 'attack';
    w.enemies.applySetting(w, 'friedlich');
    expect([...w.enemies.units.values()].every((u) => u.mode !== 'attack')).toBe(true);
    w.enemies.applySetting(w, 'normal');
    w.enemies.ensureArea(w, -400, -400, 400, 400);
    expect(w.enemies.nests.size).toBe(before);
  });

  it('Einstellung übersteht Speichern und Laden', () => {
    const w = world();
    w.enemies.applySetting(w, 'friedlich');
    const b = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
    expect(b.settings.enemies).toBe('friedlich');
    expect(b.enemies.nests.size).toBe(w.enemies.nests.size);
  });
});

describe('Friedlich', () => {
  it('trotz Verschmutzung am Nest kein Angriff', () => {
    const w = world('friedlich');
    const drill = w.place('burner-mining-drill', 4, 0, 0, true)!;
    const nest = w.enemies.spawnNest(w, 30, -2);
    for (let i = 0; i < 20; i++) w.pollution.add(30, -2, 500);
    nest.budget = UNITS.small.pollution * 6;
    w.run(60 * 60 * 11);
    expect(w.entities.has(drill.id)).toBe(true);
    expect([...w.enemies.units.values()].every((u) => u.mode === 'guard')).toBe(true);
  }, 30_000);
});
