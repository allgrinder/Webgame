/**
 * Tastenbelegung als benannte Aktionen (Skill input-systems): Spielcode fragt Aktionen ab, nicht Buchstaben.
 * Belegung änderbar (Menü → Tastenbelegung), gespeichert in `eisenwerk.keys`; Konflikte werden getauscht.
 * Fest bleiben: Esc, 1–0 (Schnellleiste) und Strg-Kombinationen (Speichern, Kopieren, Rückgängig …).
 * Tastennamen wie in `src/game/input.ts` (`keyName`): Buchstaben nach Lage auf der Tastatur, klein geschrieben.
 */
export interface KeyAction {
  readonly id: string;
  readonly label: string;
  readonly key: string;
  readonly group: string;
}

export const KEY_ACTIONS: readonly KeyAction[] = [
  { id: 'up', label: 'Laufen nach oben', key: 'w', group: 'Bewegung' },
  { id: 'down', label: 'Laufen nach unten', key: 's', group: 'Bewegung' },
  { id: 'left', label: 'Laufen nach links', key: 'a', group: 'Bewegung' },
  { id: 'right', label: 'Laufen nach rechts', key: 'd', group: 'Bewegung' },
  { id: 'pickup', label: 'Aufheben (halten)', key: 'f', group: 'Bewegung' },
  { id: 'shoot', label: 'Schießen (halten)', key: ' ', group: 'Bewegung' },
  { id: 'rotate', label: 'Drehen', key: 'r', group: 'Bauen' },
  { id: 'railShape', label: 'Gleisform wechseln', key: 'tab', group: 'Bauen' },
  { id: 'pipette', label: 'Pipette / Hand leeren', key: 'q', group: 'Bauen' },
  { id: 'drop', label: 'Item ablegen', key: 'z', group: 'Bauen' },
  { id: 'wire', label: 'Draht rot/grün', key: 'g', group: 'Bauen' },
  { id: 'brushUp', label: 'Pinsel größer', key: '+', group: 'Bauen' },
  { id: 'brushDown', label: 'Pinsel kleiner', key: '-', group: 'Bauen' },
  { id: 'inventory', label: 'Inventar und Handwerk', key: 'e', group: 'Fenster' },
  { id: 'research', label: 'Forschung', key: 't', group: 'Fenster' },
  { id: 'map', label: 'Kartenansicht', key: 'm', group: 'Fenster' },
  { id: 'stats', label: 'Produktion', key: 'p', group: 'Fenster' },
  { id: 'power', label: 'Strom-Übersicht', key: 'o', group: 'Fenster' },
  { id: 'blueprints', label: 'Blaupausen', key: 'b', group: 'Fenster' },
  { id: 'handbook', label: 'Handbuch', key: 'j', group: 'Fenster' },
  { id: 'help', label: 'Hilfe', key: 'h', group: 'Fenster' },
  { id: 'alt', label: 'Detailansicht (Alt)', key: 'alt', group: 'Ansicht' },
  { id: 'editor', label: 'Editor-Modus', key: 'f2', group: 'Ansicht' },
  { id: 'debug', label: 'Debug-Anzeige', key: 'f3', group: 'Ansicht' },
];

/** Nicht belegbar (feste Bedeutung). */
export const RESERVED_KEYS = new Set(['escape', 'control', 'shift', 'meta', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'f5', 'f12']);

const STORE = 'eisenwerk.keys';

/** Anzeige eines Tastennamens. */
export function keyLabel(k: string): string {
  const names: Record<string, string> = { ' ': 'Leertaste', tab: 'Tab', alt: 'Alt', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', enter: 'Enter', backspace: '⌫' };
  return names[k] ?? (k.length === 1 ? k.toUpperCase() : k.toUpperCase());
}

export class KeyMap {
  private readonly map = new Map<string, string>();
  private readonly reverse = new Map<string, string>();

  constructor(private readonly persist = true) {
    let saved: Record<string, string> = {};
    if (persist) {
      try {
        saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, string>;
      } catch { /* ohne Speicher */ }
    }
    for (const a of KEY_ACTIONS) this.map.set(a.id, typeof saved[a.id] === 'string' ? saved[a.id] : a.key);
    this.rebuild();
  }

  private rebuild(): void {
    this.reverse.clear();
    for (const [id, k] of this.map) if (!this.reverse.has(k)) this.reverse.set(k, id);
    // „=“ ist auf vielen Tastaturen dieselbe Taste wie „+“
    const plus = this.map.get('brushUp');
    if (plus === '+' && !this.reverse.has('=')) this.reverse.set('=', 'brushUp');
  }

  key(id: string): string {
    return this.map.get(id) ?? '';
  }

  /** Aktion einer Taste (undefined: keine). */
  action(k: string): string | undefined {
    return this.reverse.get(k);
  }

  isDown(down: ReadonlySet<string>, id: string): boolean {
    const k = this.key(id);
    return down.has(k) || (k === ' ' && down.has('space'));
  }

  /**
   * Taste neu belegen. Liegt die Taste schon auf einer anderen Aktion, bekommt diese die bisherige Taste
   * (Tausch, damit nichts unbelegt bleibt). Rückgabe: getauschte Aktion bzw. Fehlertext.
   */
  set(id: string, k: string): { swapped?: string; error?: string } {
    if (RESERVED_KEYS.has(k)) return { error: `${keyLabel(k)} ist fest belegt` };
    const old = this.key(id);
    if (old === k) return {};
    const other = [...this.map].find(([a, kk]) => kk === k && a !== id)?.[0];
    this.map.set(id, k);
    if (other) this.map.set(other, old);
    this.rebuild();
    this.save();
    return other ? { swapped: other } : {};
  }

  reset(): void {
    for (const a of KEY_ACTIONS) this.map.set(a.id, a.key);
    this.rebuild();
    this.save();
  }

  private save(): void {
    if (!this.persist) return;
    try {
      const diff: Record<string, string> = {};
      for (const a of KEY_ACTIONS) if (this.map.get(a.id) !== a.key) diff[a.id] = this.map.get(a.id)!;
      localStorage.setItem(STORE, JSON.stringify(diff));
    } catch { /* ohne Speicher */ }
  }
}
