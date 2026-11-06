/** Ereignisse für Ton und Effekte (nur Darstellung, nicht gespeichert). Höchstens MAX, älteste fallen weg. */
export type GameEventType = 'build' | 'remove' | 'mine' | 'tree' | 'craft' | 'shot' | 'turret' | 'bite' | 'hit' | 'death' | 'explode' | 'nest' | 'research';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
}

const MAX = 96;

export class EventQueue {
  private readonly list: GameEvent[] = [];
  push(type: GameEventType, x: number, y: number): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ type, x, y });
  }
  /** Alle Ereignisse seit dem letzten Abholen. */
  drain(): GameEvent[] {
    return this.list.splice(0, this.list.length);
  }
}
