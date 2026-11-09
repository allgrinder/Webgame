import { strToU8, zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { InserterEntity, UndergroundEntity } from '../../src/sim/machines';
import { importForeign, isForeignText } from '../../src/sim/foreignbp';
import { World } from '../../src/sim/world';

/** Text im Format des Vorbilds erzeugen (für Tests): „0“ + Base64(zlib(JSON)). */
function encodeForeign(obj: unknown): string {
  const z = zlibSync(strToU8(JSON.stringify(obj)), { level: 9 });
  return '0' + Buffer.from(z).toString('base64');
}

function clearWorld(): World {
  const w = new World(3);
  w.map.clearTrees(-30, -30, 80, 80);
  for (let y = -20; y < 40; y++) for (let x = -20; x < 40; x++) {
    w.map.setWater(x, y, false);
    w.map.setResource(x, y, 0, 0);
  }
  return w;
}

const V2 = 2 * 2 ** 48 + 1;
const V1 = 1 * 2 ** 48 + 1 * 2 ** 32;

describe('Blaupausen-Texte im Original-Format (Wiki „Blueprint string format“)', () => {
  it('2.0: Namen, Mitte → Ecke, 16 Richtungen, Greifarm-Richtung (Aufnahme → Ablage), Rezept, Filter, Splitter', () => {
    const text = encodeForeign({ blueprint: { item: 'blueprint', label: 'Test', version: V2, entities: [
      { entity_number: 1, name: 'assembling-machine-2', position: { x: 1.5, y: 1.5 }, recipe: 'iron-gear-wheel' },
      // Greifarm südlich der Maschine, nimmt von Süden (Richtung 8 = Süden zeigt zur Aufnahme) und legt nach Norden ab
      { entity_number: 2, name: 'inserter', position: { x: 1.5, y: 3.5 }, direction: 8 },
      { entity_number: 3, name: 'transport-belt', position: { x: 1.5, y: 4.5 }, direction: 4 },
      { entity_number: 4, name: 'fast-inserter', position: { x: 0.5, y: 3.5 }, direction: 0, filters: [{ index: 1, name: 'iron-plate' }], use_filters: true },
      { entity_number: 5, name: 'splitter', position: { x: 5, y: 1.5 }, direction: 4, input_priority: 'left', filter: { name: 'copper-plate' } },
      { entity_number: 6, name: 'small-lamp', position: { x: 4.5, y: 4.5 } },
      { entity_number: 7, name: 'rail-signal', position: { x: 8.5, y: 0.5 } },
    ], tiles: [{ name: 'concrete', position: { x: 0, y: 0 } }] } });
    expect(isForeignText(text)).toBe(true);
    const r = importForeign(text)!;
    expect(r.blueprints).toHaveLength(1);
    expect(r.report.total).toBe(7);
    expect(r.report.imported).toBe(6);
    expect(r.report.unknown.get('rail-signal')).toBe(1);
    expect(r.report.notes.join()).toContain('Bodenbeläge');
    const bp = r.blueprints[0].bp;
    const by = (n: string) => bp.entities.find((e) => e.name === n)!;
    expect(by('assembling-machine-2')).toMatchObject({ dx: 0, dy: 0, settings: { recipe: 'iron-gear-wheel' } });
    expect(by('inserter')).toMatchObject({ dx: 1, dy: 3, dir: 0 }); // legt nach Norden in die Maschine
    expect(by('transport-belt')).toMatchObject({ dx: 1, dy: 4, dir: 1 });
    expect(by('fast-inserter').settings?.if?.[0]).toBe('iron-plate');
    expect(by('fast-inserter').dir).toBe(2);
    expect(by('splitter')).toMatchObject({ dir: 1, settings: { ip: 0, op: -1, fi: 'copper-plate' } });
    expect(by('lamp')).toBeTruthy();

    // in der Welt ablegen und bauen: Greifarm füttert die Maschine von Süden
    const w = clearWorld();
    for (const e of bp.entities) {
      const ent = w.place(e.name, e.dx, e.dy, e.dir);
      expect(ent, e.name).toBeTruthy();
    }
    const ins = [...w.entities.values()].find((e) => e.name === 'inserter') as InserterEntity;
    expect(ins.dir).toBe(0);
  });

  it('1.1: 8 Richtungen; Bücher werden zu mehreren Blaupausen', () => {
    const bp = (label: string, d: number) => ({ blueprint: { item: 'blueprint', label, version: V1, entities: [
      { entity_number: 1, name: 'transport-belt', position: { x: 0.5, y: 0.5 }, direction: d },
    ] } });
    const text = encodeForeign({ blueprint_book: { item: 'blueprint-book', label: 'Buch', version: V1,
      blueprints: [{ index: 0, ...bp('Ost', 2) }, { index: 1, ...bp('West', 6) }] } });
    const r = importForeign(text)!;
    expect(r.blueprints.map((b) => b.label)).toEqual(['Ost', 'West']);
    expect(r.blueprints[0].bp.entities[0].dir).toBe(1);
    expect(r.blueprints[1].bp.entities[0].dir).toBe(3);
  });

  it('Untergrundbänder: Eingang/Ausgang aus „type“, Paare entstehen; einzelne Ausgänge (Spursperre) bleiben allein', () => {
    const text = encodeForeign({ blueprint: { item: 'blueprint', version: V1, entities: [
      { entity_number: 1, name: 'underground-belt', position: { x: 0.5, y: 0.5 }, direction: 0, type: 'output' },
      { entity_number: 2, name: 'underground-belt', position: { x: 0.5, y: 3.5 }, direction: 0, type: 'input' },
      { entity_number: 3, name: 'transport-belt', position: { x: 0.5, y: 4.5 }, direction: 0 },
      { entity_number: 4, name: 'underground-belt', position: { x: 2.5, y: 1.5 }, direction: 6, type: 'output' },
    ] } });
    const bp = importForeign(text)!.blueprints[0].bp;
    const w = clearWorld();
    for (const e of bp.entities) {
      const ent = w.place(e.name, e.dx, e.dy, e.dir, true)!;
      if (ent.kind === 'underground' && e.settings?.out !== undefined && ent.output !== e.settings.out) ent.load({ out: e.settings.out });
    }
    w.belts.ensure();
    const at = (x: number, y: number) => [...w.entities.values()].find((e) => e.x === x && e.y === y) as UndergroundEntity;
    expect(at(0, 0).output).toBe(true);
    expect(at(0, 3).output).toBe(false);
    expect(w.belts.tileAt(0, 3)!.ug!.partner).not.toBeNull();
    expect(at(2, 1).output).toBe(true);
    expect(at(2, 1).dir).toBe(3);
  });
});
