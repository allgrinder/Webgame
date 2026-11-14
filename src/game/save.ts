import { type SaveData, SaveTooNewError, deserializeWorld, serializeWorld, validateSave } from '../sim/serialize';
import { pack, unpack } from './packing';
import type { World } from '../sim/world';

const DB_NAME = 'eisenwerk';
const STORE = 'saves';

/** Namenszusatz der Sicherung: die vorherige Fassung eines Spielstands (Skill save-systems). */
export const BACKUP_SUFFIX = ' ~vorher';

export interface SaveRecord {
  name: string;
  time: number;
  creative: boolean;
  /** alte Spielstände: unkomprimiert */
  data?: SaveData;
  /** gzip-komprimiertes JSON (fflate) */
  z?: Uint8Array;
}

/** Ablage der Spielstände (IndexedDB im Browser, Speicher in Tests). */
export interface SaveStore {
  get(name: string): Promise<SaveRecord | undefined>;
  /** Neuen Stand schreiben und den bisherigen als Sicherung behalten – beides in einem Schritt. */
  putRotating(rec: SaveRecord): Promise<void>;
  delete(name: string): Promise<void>;
  all(): Promise<SaveRecord[]>;
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

/** IndexedDB: eine Transaktion ist atomar – scheitert ein Teil, bleibt alles beim Alten. */
class IdbStore implements SaveStore {
  private run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore, done: (v: T) => void) => void): Promise<T> {
    return openDb().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const t = db.transaction(STORE, mode);
          let result: T;
          fn(t.objectStore(STORE), (v) => (result = v));
          t.oncomplete = () => {
            db.close();
            resolve(result);
          };
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(t.error ?? new Error('Speichern abgebrochen'));
        }),
    );
  }
  get(name: string): Promise<SaveRecord | undefined> {
    return this.run('readonly', (s, done) => {
      const r = s.get(name);
      r.onsuccess = () => done(r.result as SaveRecord | undefined);
    });
  }
  putRotating(rec: SaveRecord): Promise<void> {
    return this.run('readwrite', (s, done) => {
      const r = s.get(rec.name);
      r.onsuccess = () => {
        const old = r.result as SaveRecord | undefined;
        if (old) s.put({ ...old, name: rec.name + BACKUP_SUFFIX });
        s.put(rec);
        done(undefined);
      };
    });
  }
  delete(name: string): Promise<void> {
    return this.run('readwrite', (s, done) => {
      s.delete(name);
      s.delete(name + BACKUP_SUFFIX);
      done(undefined);
    });
  }
  all(): Promise<SaveRecord[]> {
    return this.run('readonly', (s, done) => {
      const r = s.getAll();
      r.onsuccess = () => done(r.result as SaveRecord[]);
    });
  }
}

/** Für Tests: Ablage im Speicher. */
export class MemoryStore implements SaveStore {
  readonly map = new Map<string, SaveRecord>();
  async get(name: string) {
    return this.map.get(name);
  }
  async putRotating(rec: SaveRecord) {
    const old = this.map.get(rec.name);
    if (old) this.map.set(rec.name + BACKUP_SUFFIX, { ...old, name: rec.name + BACKUP_SUFFIX });
    this.map.set(rec.name, rec);
  }
  async delete(name: string) {
    this.map.delete(name);
    this.map.delete(name + BACKUP_SUFFIX);
  }
  async all() {
    return [...this.map.values()];
  }
}

let store: SaveStore | null = null;
const theStore = (): SaveStore => (store ??= new IdbStore());
/** Ablage ersetzen (Tests). */
export function setSaveStore(s: SaveStore): void {
  store = s;
}

/** Spielstand-Datensatz bauen: Aufbau vor dem Schreiben prüfen, damit nie ein kaputter Stand einen guten ersetzt. */
export function makeRecord(name: string, world: World, creative: boolean, time = Date.now()): SaveRecord {
  const data = serializeWorld(world);
  validateSave(data as unknown as Record<string, unknown>);
  return { name, time, creative, z: pack(data) };
}

export async function saveWorld(name: string, world: World, creative: boolean): Promise<void> {
  await theStore().putRotating(makeRecord(name, world, creative));
}

export interface Loaded {
  world: World;
  creative: boolean;
  /** Der Stand selbst war nicht ladbar, geladen wurde die vorherige Fassung. */
  fromBackup: boolean;
  /** Fehler des eigentlichen Stands (nur bei fromBackup). */
  error?: string;
}

function decode(rec: SaveRecord): { world: World; creative: boolean } {
  const data = rec.z ? unpack<SaveData>(rec.z) : rec.data;
  if (!data) throw new Error('Spielstand leer');
  return { world: deserializeWorld(data), creative: rec.creative };
}

/** Laden; ist der Stand beschädigt, die vorherige Fassung (Sicherung) laden und das melden. */
export async function loadWorld(name: string): Promise<Loaded | null> {
  const s = theStore();
  const main = await s.get(name);
  let err: unknown = null;
  if (main) {
    try {
      return { ...decode(main), fromBackup: false };
    } catch (e) {
      // aus einer neueren Fassung: nicht still auf eine ältere Sicherung ausweichen
      if (e instanceof SaveTooNewError) throw e;
      err = e;
    }
  }
  const bak = name.endsWith(BACKUP_SUFFIX) ? undefined : await s.get(name + BACKUP_SUFFIX);
  if (bak) {
    try {
      return { ...decode(bak), fromBackup: !!main, ...(main ? { error: err instanceof Error ? err.message : String(err) } : {}) };
    } catch (e) {
      if (!err) err = e;
    }
  }
  if (err) throw err;
  return null;
}

export interface SaveInfo {
  name: string;
  time: number;
  /** Zeit der vorherigen Fassung, falls vorhanden. */
  backupTime?: number;
}

export async function listSaves(): Promise<SaveInfo[]> {
  const all = await theStore().all();
  const bak = new Map(all.filter((r) => r.name.endsWith(BACKUP_SUFFIX)).map((r) => [r.name.slice(0, -BACKUP_SUFFIX.length), r.time]));
  return all
    .filter((r) => !r.name.endsWith(BACKUP_SUFFIX))
    .map((r) => ({ name: r.name, time: r.time, ...(bak.has(r.name) ? { backupTime: bak.get(r.name) } : {}) }))
    .sort((a, b) => b.time - a.time);
}

export async function deleteSave(name: string): Promise<void> {
  await theStore().delete(name);
}
