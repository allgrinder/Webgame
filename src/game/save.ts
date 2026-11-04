import { type SaveData, deserializeWorld, serializeWorld } from '../sim/serialize';
import type { World } from '../sim/world';

const DB_NAME = 'eisenwerk';
const STORE = 'saves';

interface SaveRecord {
  name: string;
  time: number;
  creative: boolean;
  data: SaveData;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveWorld(name: string, world: World, creative: boolean): Promise<void> {
  const rec: SaveRecord = { name, time: Date.now(), creative, data: serializeWorld(world) };
  await tx('readwrite', (s) => s.put(rec));
}

export async function loadWorld(name: string): Promise<{ world: World; creative: boolean } | null> {
  const rec = await tx<SaveRecord | undefined>('readonly', (s) => s.get(name));
  if (!rec) return null;
  return { world: deserializeWorld(rec.data), creative: rec.creative };
}

export async function listSaves(): Promise<{ name: string; time: number }[]> {
  const all = await tx<SaveRecord[]>('readonly', (s) => s.getAll());
  return all.map((r) => ({ name: r.name, time: r.time })).sort((a, b) => b.time - a.time);
}

export async function deleteSave(name: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(name));
}
