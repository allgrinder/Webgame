import { type SplitterDef, type UndergroundDef, entityDef } from '../../data/entities';
import { ITEM_IDS } from '../../data/items';
import { type BeltSystem, SplitterState } from '../belts';
import { DX, DY, type Dir, opposite } from '../geom';
import type { World } from '../world';
import { EntityBase } from './base';

/**
 * Untergrundband: Eingang oder Ausgang. Beim Bauen wird es zum Ausgang, wenn hinter ihm in Reichweite
 * ein freier Eingang gleicher Richtung liegt. Drehen schaltet zwischen Eingang und Ausgang um.
 */
export class UndergroundEntity extends EntityBase {
  readonly kind = 'underground' as const;
  declare readonly def: UndergroundDef;
  output = false;
  private belts: BeltSystem | null = null;

  override onCreated(w: World): void {
    this.belts = w.belts;
    this.output = UndergroundEntity.wouldBeOutput(w, this.name, this.x, this.y, this.dir);
    w.belts.add(this.id, this.x, this.y, this.dir, {
      speed: this.def.speed, underground: { output: this.output, maxDist: this.def.maxDistance },
    });
  }

  /** Liegt hinter (x,y) in Reichweite ein Eingang gleicher Richtung ohne Ausgang dazwischen? */
  static wouldBeOutput(w: World, name: string, x: number, y: number, dir: Dir): boolean {
    const back = opposite(dir);
    const max = (entityDef(name) as UndergroundDef).maxDistance;
    for (let k = 1; k <= max; k++) {
      const e = w.entityAt(x + DX[back] * k, y + DY[back] * k);
      if (e?.kind !== 'underground' || e.name !== name) continue;
      if (e.dir !== dir && e.dir !== back) continue;
      return e.dir === dir && !e.output;
    }
    return false;
  }

  /** Eingang ↔ Ausgang, Laufrichtung kehrt sich um (Haube bleibt auf derselben Seite). */
  flip(): void {
    this.output = !this.output;
    this.dir = opposite(this.dir);
    this.belts?.setUnderground(this.id, this.output, this.dir);
  }

  override save() {
    return { out: this.output };
  }
  override load(d: Record<string, unknown>): void {
    const out = !!d.out;
    if (out !== this.output) {
      this.output = out;
      this.belts?.setUnderground(this.id, out, this.dir);
    }
  }
}

/**
 * Splitter: zwei Bandhälften quer zur Laufrichtung. Items beider Eingänge werden je Spur abwechselnd
 * auf die beiden Ausgänge verteilt.
 */
export class SplitterEntity extends EntityBase {
  readonly kind = 'splitter' as const;
  declare readonly def: SplitterDef;
  readonly state = new SplitterState();

  /** IDs der beiden Bandhälften im Bandsystem (eigener Nummernkreis, negativ). */
  get halfIds(): [number, number] {
    return [-(this.id * 2) - 1, -(this.id * 2) - 2];
  }

  /** Felder der Hälften: links, rechts (in Laufrichtung). */
  halfTiles(): [[number, number], [number, number]] {
    const { x, y, dir } = this;
    switch (dir) {
      case 0: return [[x, y], [x + 1, y]];
      case 1: return [[x, y], [x, y + 1]];
      case 2: return [[x + 1, y], [x, y]];
      default: return [[x, y + 1], [x, y]];
    }
  }

  override onCreated(w: World): void {
    const ids = this.halfIds;
    this.halfTiles().forEach(([tx, ty], k) => {
      w.belts.add(ids[k], tx, ty, this.dir, { speed: this.def.speed, splitter: this.state });
    });
  }

  override save() {
    const st = this.state;
    return { tg: [...st.toggle], ip: st.inputPriority, op: st.outputPriority, fi: st.filter >= 0 ? ITEM_IDS[st.filter] : null };
  }
  override load(d: Record<string, unknown>): void {
    const st = this.state;
    const tg = d.tg as [number, number] | undefined;
    if (tg) st.toggle = [tg[0], tg[1]];
    st.inputPriority = (d.ip as number) ?? -1;
    st.outputPriority = (d.op as number) ?? -1;
    st.filter = d.fi ? ITEM_IDS.indexOf(d.fi as string) : -1;
  }
}
