import { beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_SUFFIX, MemoryStore, deleteSave, listSaves, loadWorld, saveWorld, setSaveStore } from '../../src/game/save';
import { pack } from '../../src/game/packing';
import { SAVE_VERSION, SaveTooNewError, migrateSave, serializeWorld } from '../../src/sim/serialize';
import { World } from '../../src/sim/world';

function world(): World {
  const w = new World(7);
  w.map.clearTrees(-5, -5, 20, 20);
  for (let y = -2; y < 6; y++) for (let x = -2; x < 10; x++) w.map.setWater(x, y, false);
  w.place('iron-chest', 0, 0, 0);
  w.place('transport-belt', 2, 0, 1);
  return w;
}

describe('Spielstände absichern (Skill save-systems)', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
    setSaveStore(store);
  });

  it('Überschreiben behält die vorherige Fassung; Liste zeigt sie nur als Zusatz', async () => {
    const w = world();
    await saveWorld('a', w, false);
    w.place('iron-chest', 5, 0, 0);
    await saveWorld('a', w, false);
    expect(store.map.has('a' + BACKUP_SUFFIX)).toBe(true);
    const list = await listSaves();
    expect(list.map((s) => s.name)).toEqual(['a']);
    expect(list[0].backupTime).toBeDefined();
    const cur = await loadWorld('a');
    const prev = await loadWorld('a' + BACKUP_SUFFIX);
    expect(cur!.world.entities.size).toBe(3);
    expect(prev!.world.entities.size).toBe(2);
    await deleteSave('a');
    expect(store.map.size).toBe(0);
  });

  it('beschädigter Stand: vorherige Fassung wird geladen und gemeldet', async () => {
    const w = world();
    await saveWorld('a', w, false);
    await saveWorld('a', w, false);
    store.map.set('a', { ...store.map.get('a')!, z: new Uint8Array([31, 139, 8, 0, 1, 2, 3]) });
    const r = await loadWorld('a');
    expect(r!.fromBackup).toBe(true);
    expect(r!.error).toBeTruthy();
    expect(r!.world.entities.size).toBe(2);
  });

  it('Stand aus einer neueren Fassung: ablehnen, nicht still auf die Sicherung ausweichen', async () => {
    const w = world();
    await saveWorld('a', w, false);
    await saveWorld('a', w, false);
    const data = { ...serializeWorld(w), version: SAVE_VERSION + 1 };
    store.map.set('a', { ...store.map.get('a')!, z: pack(data) });
    await expect(loadWorld('a')).rejects.toBeInstanceOf(SaveTooNewError);
  });

  it('Umwandlungskette und Aufbauprüfung', () => {
    const d = serializeWorld(world());
    // gedachte Version 3 mit zwei Umwandlungen (1→2, 2→3)
    const migrated = migrateSave({ ...d, version: 1 }, {
      1: (x) => ({ ...x, a: 1 }),
      2: (x) => ({ ...x, b: (x.a as number) + 1 }),
    }, 3) as unknown as Record<string, unknown>;
    expect(migrated.version).toBe(3);
    expect(migrated.b).toBe(2);
    expect(() => migrateSave({ ...d, version: 1 }, {}, 2)).toThrow(/Spielstandversion 1/);
    expect(() => migrateSave({ ...d, seed: 'x' })).toThrow(/seed/);
    expect(() => migrateSave({ ...d, entities: [...d.entities, { ...d.entities[0], name: 'gibt-es-nicht' }] })).toThrow(/unbekanntes Gebäude/);
    expect(() => migrateSave({ ...d, entities: [...d.entities, { ...d.entities[0] }] })).toThrow(/doppelt/);
    expect(() => migrateSave(null)).toThrow(/unlesbar/);
    // ohne Versionsfeld gilt Version 1
    const { version: _v, ...noVersion } = d;
    expect(migrateSave(noVersion).version).toBe(SAVE_VERSION);
  });
});
