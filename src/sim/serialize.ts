import { RECIPES } from '../data/recipes';
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
  inv: InvData;
  quickbar: (string | null)[];
  queue: CraftJob[];
  mine: MineTarget | null;
  mineProgress: number;
  mineTotal: number;
}

export function serializeWorld(w: World): SaveData {
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
    player: p
      ? {
        px: p.px, py: p.py, ppx: p.prevPx, ppy: p.prevPy, mx: p.moveX, my: p.moveY,
        facing: p.facing, walking: p.walking,
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
  const base: EntityData = { id: e.id, name: e.name, x: e.x, y: e.y, dir: e.dir, st: e.status };
  switch (e.kind) {
    case 'belt':
      return base;
    case 'drill':
      return { ...base, b: e.burner.serialize(), progress: e.progress, output: e.output, cursor: e.cursor, work: e.workTicks };
    case 'furnace':
      return {
        ...base, b: e.burner.serialize(), src: e.source.serialize(), res: e.result.serialize(),
        recipe: e.recipe?.id ?? null, progress: e.progress, work: e.workTicks,
      };
    case 'inserter':
      return { ...base, b: e.burner.serialize(), phase: e.phase, progress: e.progress, held: e.held };
  }
}

export function deserializeWorld(d: SaveData): World {
  if (d.version !== SAVE_VERSION) throw new Error(`Spielstandversion ${d.version} wird nicht unterstützt`);
  const w = new World(d.seed);
  w.tick = d.tick;
  w.map.loadModifications(d.map);
  for (const ed of d.entities) {
    const e = w.create(ed.id, ed.name, ed.x, ed.y, ed.dir);
    e.status = ed.st;
    switch (e.kind) {
      case 'drill':
        e.burner.load(ed.b!);
        e.progress = ed.progress!;
        e.output = ed.output ?? null;
        e.cursor = ed.cursor!;
        e.workTicks = ed.work ?? 0;
        break;
      case 'furnace':
        e.burner.load(ed.b!);
        e.source.load(ed.src!);
        e.result.load(ed.res!);
        e.recipe = ed.recipe ? RECIPES[ed.recipe] : null;
        e.progress = ed.progress!;
        e.workTicks = ed.work ?? 0;
        break;
      case 'inserter':
        e.burner.load(ed.b!);
        e.phase = ed.phase!;
        e.progress = ed.progress!;
        e.held = ed.held ?? null;
        break;
      case 'belt':
        break;
    }
  }
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
