import { type EntityDef, entityDef } from '../../data/entities';
import { Status } from '../entity';
import type { Dir } from '../geom';
import type { Inventory, Stack } from '../inventory';
import type { World } from '../world';

/** Wer Items einlegt: Maschinen (Bohrer → Ofen) ohne Grenze, Greifarme mit Füllgrenzen, Spieler. */
export type InsertMode = 'machine' | 'inserter' | 'player';

/** Energiequelle eines Gebäudes (Brennstoff oder Strom). */
export interface EnergySource {
  readonly type: 'burner' | 'electric';
  consume(joules: number): boolean;
  canSupply(joules: number): boolean;
}

/** Ein Slot-Bereich für das Gebäudefenster. */
export interface GuiSlots {
  label: string;
  inv: Inventory;
}

/**
 * Gemeinsame Basis aller Gebäude. Verhalten steckt in den Unterklassen; die Welt ruft nur
 * update(), insert(), take() usw. auf. Neue Gebäudearten: Klasse anlegen und in registry.ts eintragen.
 */
export abstract class EntityBase {
  abstract readonly kind: string;
  status = Status.Idle;
  readonly def: EntityDef;

  constructor(readonly id: number, readonly name: string, readonly x: number, readonly y: number, public dir: Dir) {
    this.def = entityDef(name);
  }

  /** Mittelpunkt in Feldkoordinaten. */
  get cx(): number {
    return this.x + this.def.width / 2;
  }
  get cy(): number {
    return this.y + this.def.height / 2;
  }

  /** Ein Tick. Bänder werden zentral im Bandsystem bewegt. */
  update(_w: World): void {}

  /** Wieviele Items dieses Typs angenommen werden. */
  acceptAmount(_item: string, _mode: InsertMode): number {
    return 0;
  }

  /** Legt bis zu amount Items ein, gibt die eingelegte Menge zurück. */
  insert(item: string, amount: number, mode: InsertMode): number {
    const n = Math.min(amount, this.acceptAmount(item, mode));
    return n > 0 ? this.doInsert(item, n) : 0;
  }

  protected doInsert(_item: string, _n: number): number {
    return 0;
  }

  /** Gibt ein Item ab, das accept() erfüllt (für Greifarme). */
  take(_w: World, _accept: (item: string) => boolean): string | null {
    return null;
  }

  /** Gesamter Inhalt (beim Abbauen an den Spieler). */
  contents(): Stack[] {
    return [];
  }

  /** Slots für das Gebäudefenster. */
  guiSlots(): GuiSlots[] {
    return [];
  }

  /** Brennstoffquelle, falls vorhanden (Anzeige, Selbstversorgung). */
  get burner(): import('../burner').Burner | null {
    return null;
  }

  /** Zustand für den Spielstand (zusätzlich zu id, name, x, y, dir, status). */
  save(): Record<string, unknown> {
    return {};
  }

  load(_d: Record<string, unknown>): void {}

  /** Wird nach dem Anlegen bzw. vor dem Entfernen aufgerufen (z. B. Bandsystem). */
  onCreated(_w: World): void {}
  onRemoved(_w: World): void {}
}

/** Inventar-Inhalt als Liste zusammenfassen. */
export function invContents(...invs: Inventory[]): Stack[] {
  const out: Stack[] = [];
  for (const inv of invs) out.push(...inv.contents());
  return out;
}
