import { describe, expect, it } from 'vitest';
import { PRESETS, drillField, mall, plasticBlock, smelterColumn, solarTile, steamBlock } from '../../src/data/blueprints';
import { resourceById } from '../../src/data/resources';
import { FLUID_UNIT } from '../../src/data/fluids';
import { type Blueprint, applySettings, placed } from '../../src/sim/blueprint';
import type { ElectricSource } from '../../src/sim/energy';
import { type Entity, itemIndex } from '../../src/sim/machines';
import { World } from '../../src/sim/world';

/** Freies Land um (0,0); Vorlage bei (0,0) aufstellen (Uferpumpe bekommt Wasser, Bohrer Erz). */
function build(bp: Blueprint, opts: { ore?: boolean } = {}): { w: World; ents: Entity[] } {
  const w = new World(1);
  w.map.clearTrees(-20, -20, bp.w + 40, bp.h + 40);
  for (let y = -10; y < bp.h + 10; y++) for (let x = -10; x < bp.w + 10; x++) {
    w.map.setResource(x, y, 0, 0);
    w.map.setWater(x, y, false);
  }
  const list = placed(bp, 0, 0);
  const iron = resourceById('iron-ore').index;
  for (const p of list) {
    if (p.name === 'offshore-pump') {
      const { back } = World.pumpTiles(p.x, p.y, p.dir);
      w.map.setWater(back[0], back[1], true);
    }
    if (opts.ore && p.name === 'electric-mining-drill') {
      for (let y = p.y - 1; y < p.y + 4; y++) for (let x = p.x - 1; x < p.x + 4; x++) w.map.setResource(x, y, iron, 1_000_000);
    }
  }
  const ents: Entity[] = [];
  for (const p of list) {
    const e = w.place(p.name, p.x, p.y, p.dir);
    expect(e, `${p.name} bei ${p.x},${p.y}`).toBeTruthy();
    applySettings(e!, p.settings);
    ents.push(e!);
  }
  return { w, ents };
}

/** Alle Stromverbraucher hängen an einem gemeinsamen Netz (Masten richtig gesetzt). */
function onePowerNet(w: World, ents: Entity[]): void {
  w.power.ensure(w);
  const nets = new Set<unknown>();
  for (const e of ents) {
    const en = (e as { energy?: { type?: string } }).energy;
    if (en?.type !== 'electric' && e.kind !== 'pole') continue;
    const net = w.power.netOf.get(e.id);
    expect(net, `${e.name} bei ${e.x},${e.y} ohne Strom`).toBeTruthy();
    nets.add(net);
  }
  expect(nets.size).toBe(1);
}

function powered(w: World): void {
  for (const e of w.entities.values()) {
    const en = (e as { energy?: { type?: string } }).energy;
    if (en?.type === 'electric') (en as ElectricSource).buffer = Math.max((en as ElectricSource).buffer, (en as ElectricSource).capacity);
  }
}

/** Band speisen (Rückseite des Felds, je Spur ein Item oder null). */
function feed(w: World, x: number, y: number, left: string | null, right: string | null): void {
  const t = w.belts.tileAt(x, y)!;
  const back: Record<number, [number, number, number, number]> = { 0: [0.25, 0.98, 0.75, 0.98], 1: [0.02, 0.25, 0.02, 0.75], 2: [0.75, 0.02, 0.25, 0.02], 3: [0.98, 0.75, 0.98, 0.25] };
  const [lx, ly, rx, ry] = back[t.dir];
  if (left) w.belts.insertAtPoint(t, lx, ly, itemIndex(left));
  if (right) w.belts.insertAtPoint(t, rx, ry, itemIndex(right));
}

describe('Abgestimmte Baupläne (Vorlagen)', () => {
  it('alle Vorlagen lassen sich auf freiem Land aufstellen', () => {
    for (const p of PRESETS) build(p.bp, { ore: true });
  });

  it('Ofenreihe 48 Steinöfen: ein volles Band Eisenplatten (15/s)', () => {
    const bp = smelterColumn('stone-furnace', 24);
    const { w, ents } = build(bp);
    onePowerNet(w, ents);
    const out = w.belts.tileAt(5, 0)!;
    let n = 0;
    const warm = 60 * 150;
    const measure = 60 * 30;
    for (let t = 0; t < warm + measure; t++) {
      feed(w, 0, 49, 'iron-ore', 'coal');
      feed(w, 10, 49, 'iron-ore', 'coal');
      powered(w);
      w.step();
      while (w.belts.takeFromTile(out, () => true) >= 0) if (t >= warm) n++;
    }
    expect(n / 30).toBeGreaterThan(14.9);
  }, 60_000);

  it('Bohrerfeld 30 Bohrer: ein volles Band Erz (15/s)', () => {
    const bp = drillField(15);
    const { w, ents } = build(bp, { ore: true });
    onePowerNet(w, ents);
    const top = placed(bp, 0, 0).filter((p) => p.name === 'transport-belt').reduce((a, b) => (b.y < a.y ? b : a));
    const out = w.belts.tileAt(top.x, top.y)!;
    let n = 0;
    for (let t = 0; t < 60 * 60; t++) {
      powered(w);
      w.step();
      while (w.belts.takeFromTile(out, () => true) >= 0) if (t >= 60 * 30) n++;
    }
    expect(n / 30).toBeGreaterThan(14.5);
  }, 60_000);

  it('Dampfkraft 1:10:20: 18 MW bereit, alle Kessel befeuert', () => {
    const bp = steamBlock(10);
    const { w } = build(bp);
    const belt = placed(bp, 0, 0).filter((p) => p.name === 'transport-belt').reduce((a, b) => (b.x > a.x ? b : a));
    for (let t = 0; t < 60 * 60; t++) {
      feed(w, belt.x, belt.y, 'coal', 'coal');
      w.step();
    }
    const gens = [...w.entities.values()].filter((e) => e.kind === 'generator');
    expect(gens).toHaveLength(20);
    const nets = new Set(gens.map((g) => w.power.netOf.get(g.id)));
    expect(nets.size).toBe(1);
    const net = [...nets][0]!;
    expect(net.potential * 60).toBeGreaterThan(17.9e6);
    const boilers = [...w.entities.values()].filter((e) => e.kind === 'boiler');
    for (const b of boilers) expect(b.burner!.fuel.count('coal'), `Kessel bei ${b.x}`).toBeGreaterThan(0);
  }, 60_000);

  it('Solarfeld 25:21: 0,9 MW Last ohne Ausfall (zweiter Tag, Akkus einmal voll geladen)', () => {
    const bp = solarTile();
    expect(bp.entities.filter((e) => e.name === 'solar-panel')).toHaveLength(25);
    expect(bp.entities.filter((e) => e.name === 'accumulator')).toHaveLength(21);
    const { w } = build(bp);
    for (const y of [0, 4, 8]) expect(w.place('radar', 18, y, 0)).toBeTruthy();
    const radars = [...w.entities.values()].filter((e) => e.kind === 'radar');
    let off = 0;
    // gebaut mittags: der erste Tag lädt die Akkus nur teilweise; gemessen wird der zweite volle Tag
    for (let t = 0; t < 25_200 * 2; t++) {
      w.step();
      if (t >= 25_200) for (const r of radars) if (r.status !== 1) off++;
    }
    expect(off).toBe(0);
  }, 120_000);

  it('Mall: jede Maschine füllt ihre Kiste', () => {
    const bp = mall();
    const { w, ents } = build(bp);
    onePowerNet(w, ents);
    const starts = placed(bp, 0, 0).filter((p) => p.name === 'transport-belt' && p.x === 0).sort((a, b) => a.y - b.y);
    for (let t = 0; t < 60 * 180; t++) {
      feed(w, 0, starts[0].y, 'iron-plate', 'iron-gear-wheel');
      feed(w, 0, starts[1].y, 'electronic-circuit', null);
      powered(w);
      w.step();
    }
    const chests = [...w.entities.values()].filter((e) => e.name === 'iron-chest' && e.kind === 'container');
    const got = new Set<string>();
    for (const c of chests) for (const st of (c as { inventory: { slots: ({ item: string } | null)[] } }).inventory.slots) if (st) got.add(st.item);
    for (const it of ['underground-belt', 'transport-belt', 'splitter', 'pipe', 'pipe-to-ground', 'inserter', 'long-handed-inserter', 'electric-mining-drill', 'assembling-machine-1', 'iron-chest']) {
      expect(got.has(it), it).toBe(true);
    }
  }, 60_000);

  it('Plastik: 2 Raffinerien → 1 Chemiefabrik, ≈1,8 Plastik/s', () => {
    const bp = plasticBlock();
    const { w, ents } = build(bp);
    onePowerNet(w, ents);
    const tank = ents.find((e) => e.kind === 'tank') as Entity & { box: { net: { add: (f: string, n: number) => number } | null } };
    const coalChest = ents.find((e) => e.name === 'iron-chest' && e.x === 4 && e.y === 2) as Entity & { inventory: { add: (i: string, n: number) => number } };
    expect(coalChest).toBeTruthy();
    coalChest.inventory.add('coal', 400);
    let before = 0;
    const out = ents.find((e) => e.name === 'iron-chest' && e.y === 0) as Entity & { inventory: { count: (i: string) => number } };
    for (let t = 0; t < 60 * 150; t++) {
      w.fluids.ensure(w);
      tank.box.net?.add('crude-oil', Math.round((40 / 60) * FLUID_UNIT));
      powered(w);
      w.step();
      if (t === 60 * 90) before = out.inventory.count('plastic-bar');
    }
    const rate = (out.inventory.count('plastic-bar') - before) / 60;
    expect(rate).toBeGreaterThan(1.6);
    expect(rate).toBeLessThan(2.01);
  }, 60_000);
});
