import type { Status } from './entity';
import type { Dir } from './geom';
import type { Inventory } from './inventory';
import { type Entity, type InserterPhase, itemId, itemIndex } from './machines';
import { type CraftJob, type MineTarget, Player } from './player';
import { World } from './world';

export const SAVE_VERSION = 1;

type InvData = ReturnType<Inventory['serialize']>;
type BurnerData = { e: number; f: InvData };

interface EntityData {
  id: number;
  name: string;
  x: number;
  y: number;
  dir: Dir;
  st: Status;
  b?: BurnerData;
  progress?: number;
  output?: string | null;
  cursor?: number;
  work?: number;
  src?: InvData;
  res?: InvData;
  recipe?: string | null;
  phase?: InserterPhase;
  held?: string | null;
}

export interface SaveData {
  version: number;
  seed: number;
  tick: number;
  nextId: number;
  entities: EntityData[];
  /** Band-ID -> [Spur, Abstand zum Feldende, Item] */
  beltItems: [number, [number, number, string][]][];
  /** [Chunk-x, Chunk-y, Index, Menge, Ressource] */
  map: [number, number, number, number, number][];
  /** geänderte Wasserfelder [x, y, 1/0] */
  water?: [number, number, number][];
  /** Feldschlüssel -> [Item, x, y] (1/256 Felder) */
  ground?: [number, [string, number, number][]][];
  player: PlayerData | null;
}

interface PlayerData {
  px: number;
  py: number;
  ppx: number;
  ppy: number;
  mx: number;
  my: number;
  facing: number;
  walking: boolean;
  pu?: boolean;
  inv: InvData;
  quickbar: (string | null)[];
  queue: CraftJob[];
  mine: MineTarget | null;
  mineProgress: number;
  mineTotal: number;
}

export function serializeWorld(w: World): SaveData {
  w.fluids.flush();
  const entities: EntityData[] = [];
  for (const e of [...w.entities.values()].sort((a, b) => a.id - b.id)) entities.push(entityData(e));
  const beltItems: SaveData['beltItems'] = [];
  const items = w.belts.serializeItems();
  for (const id of [...items.keys()].sort((a, b) => a - b)) {
    beltItems.push([id, items.get(id)!.map((i) => [i.lane, i.offset, itemId(i.item)] as [number, number, string])]);
  }
  const p = w.player;
  return {
    version: SAVE_VERSION,
    seed: w.seed,
    tick: w.tick,
    nextId: w.nextId,
    entities,
    beltItems,
    map: w.map.serializeModifications(),
    water: w.map.serializeWater(),
    ground: [...w.ground.entries()].sort((a, b) => a[0] - b[0]).map(([k, list]) => [k, list.map((g) => [g.item, g.x, g.y] as [string, number, number])]),
    player: p
      ? {
        px: p.px, py: p.py, ppx: p.prevPx, ppy: p.prevPy, mx: p.moveX, my: p.moveY,
        facing: p.facing, walking: p.walking, pu: p.pickingUp,
        inv: p.inventory.serialize(),
        quickbar: [...p.quickbar],
        queue: p.craftQueue.map((j) => ({ ...j, refund: j.refund?.map((r) => [...r] as [string, number]) })),
        mine: p.mineTarget ? { ...p.mineTarget } : null,
        mineProgress: p.mineProgress,
        mineTotal: p.mineTotal,
      }
      : null,
  };
}

function entityData(e: Entity): EntityData {
  return { id: e.id, name: e.name, x: e.x, y: e.y, dir: e.dir, st: e.status, ...e.save() } as EntityData;
}

export function deserializeWorld(d: SaveData): World {
  if (d.version !== SAVE_VERSION) throw new Error(`Spielstandversion ${d.version} wird nicht unterstützt`);
  const w = new World(d.seed);
  w.tick = d.tick;
  w.map.loadModifications(d.map);
  if (d.water) w.map.loadWater(d.water);
  for (const ed of d.entities) {
    const e = w.create(ed.id, ed.name, ed.x, ed.y, ed.dir);
    e.status = ed.st;
    e.load(ed as unknown as Record<string, unknown>);
  }
  for (const [k, list] of d.ground ?? []) w.ground.set(k, list.map(([item, x, y]) => ({ item, x, y })));
  for (const [id, list] of d.beltItems) {
    w.belts.loadTileItems(id, list.map(([lane, offset, item]) => ({ lane, offset, item: itemIndex(item) })));
  }
  w.belts.ensure();
  w.nextId = d.nextId;
  if (d.player) {
    const pd = d.player;
    const p = new Player(0, 0);
    p.px = pd.px;
    p.py = pd.py;
    p.prevPx = pd.ppx;
    p.prevPy = pd.ppy;
    p.moveX = pd.mx;
    p.moveY = pd.my;
    p.facing = pd.facing;
    p.walking = pd.walking;
    p.pickingUp = pd.pu ?? false;
    p.inventory.load(pd.inv);
    pd.quickbar.forEach((q, i) => (p.quickbar[i] = q));
    for (const j of pd.queue) p.craftQueue.push({ ...j });
    p.mineTarget = pd.mine;
    p.mineProgress = pd.mineProgress;
    p.mineTotal = pd.mineTotal;
    w.player = p;
  }
  return w;
}
