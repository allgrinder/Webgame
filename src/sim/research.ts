import { LOCKED_RECIPES, RESEARCH_QUEUE_MAX, TECHS, TECH_BY_ID, type TechDef } from '../data/tech';
import { secondsToTicks } from '../data/time';

export interface ResearchData {
  cur: string | null;
  done: string[];
  /** Fortschritt je Technologie in Labor-Ticks. */
  prog: [string, number][];
  /** Hergestellte Mengen für Auslöser-Forschung. */
  made?: [string, number][];
  /** Forschungswarteschlange. */
  q?: string[];
}

/**
 * Forschung: eine aktuelle Technologie, Fortschritt in Labor-Ticks (Summe aller Labore).
 * Eine Einheit braucht time Sekunden Laborarbeit und je ein Paket jeder Sorte (bezahlt das Labor).
 * Teilfortschritt bleibt beim Wechsel erhalten.
 */
export class ResearchSystem {
  current: string | null = null;
  /** Warteschlange (ohne die laufende Forschung); wird nach Abschluss der laufenden abgearbeitet. */
  readonly queue: string[] = [];
  readonly done = new Set<string>();
  readonly progress = new Map<string, number>();
  private readonly unlocked = new Set<string>();
  /** Abgeschlossene Forschungen für Meldungen (vom Spiel geleert). */
  readonly finished: string[] = [];
  /** Hergestellte Items (nur die Auslöser-Items werden gezählt). */
  readonly made = new Map<string, number>();
  private static readonly triggerItems = new Set(TECHS.flatMap((t) => (t.trigger ? [t.trigger.item] : [])));

  static unitTicks(t: TechDef): number {
    return secondsToTicks(t.time);
  }
  static totalTicks(t: TechDef): number {
    return t.count * ResearchSystem.unitTicks(t);
  }

  available(id: string): boolean {
    const t = TECH_BY_ID[id];
    return !!t && !this.done.has(id) && t.prerequisites.every((p) => this.done.has(p));
  }

  /** Meldung einer Herstellung (Spieler, Ofen, Montagemaschine) – prüft Auslöser-Forschungen. */
  onCrafted(item: string, n: number): void {
    if (!ResearchSystem.triggerItems.has(item)) return;
    this.made.set(item, (this.made.get(item) ?? 0) + n);
    this.checkTriggers();
  }

  /** Auslöser-Forschungen abschließen, deren Bedingung und Voraussetzungen erfüllt sind. */
  checkTriggers(): void {
    let again = true;
    while (again) {
      again = false;
      for (const t of TECHS) {
        if (!t.trigger || !this.available(t.id)) continue;
        if ((this.made.get(t.trigger.item) ?? 0) >= t.trigger.count) {
          this.complete(t.id);
          again = true;
        }
      }
    }
  }

  start(id: string | null): boolean {
    if (id === null) {
      this.current = null;
      return true;
    }
    if (!this.available(id) || TECH_BY_ID[id].trigger) return false;
    this.current = id;
    const i = this.queue.indexOf(id);
    if (i >= 0) this.queue.splice(i, 1);
    return true;
  }

  /**
   * In die Warteschlange stellen; fehlende Voraussetzungen kommen davor (wie im Original).
   * Liefert false, wenn nichts hinzukam (erforscht, schon eingereiht oder Schlange voll).
   */
  enqueue(id: string): boolean {
    if (!TECH_BY_ID[id] || this.done.has(id) || this.current === id || this.queue.includes(id)) return false;
    const add: string[] = [];
    const visit = (t: string) => {
      if (this.done.has(t) || this.current === t || this.queue.includes(t) || add.includes(t)) return;
      for (const p of TECH_BY_ID[t].prerequisites) visit(p);
      add.push(t);
    };
    visit(id);
    const labs = add.filter((t) => !TECH_BY_ID[t].trigger);
    if (this.queue.length + labs.length > RESEARCH_QUEUE_MAX) return false;
    this.queue.push(...labs);
    if (!this.current) this.advance();
    return true;
  }

  /** Aus der Schlange nehmen, samt eingereihter Technologien, die darauf aufbauen. */
  dequeue(id: string): void {
    const drop = new Set([id]);
    let grown = true;
    while (grown) {
      grown = false;
      for (const t of this.queue) {
        if (!drop.has(t) && TECH_BY_ID[t].prerequisites.some((p) => drop.has(p))) {
          drop.add(t);
          grown = true;
        }
      }
    }
    for (let i = this.queue.length - 1; i >= 0; i--) if (drop.has(this.queue[i])) this.queue.splice(i, 1);
    if (this.current && drop.has(this.current)) {
      this.current = null;
      this.advance();
    }
  }

  /** Nächste erforschbare Technologie aus der Schlange starten. */
  private advance(): void {
    if (this.current) return;
    const i = this.queue.findIndex((t) => this.available(t) && !TECH_BY_ID[t].trigger);
    if (i < 0) return;
    this.current = this.queue[i];
    this.queue.splice(i, 1);
  }

  get currentTech(): TechDef | null {
    return this.current ? TECH_BY_ID[this.current] : null;
  }

  /** Anteil 0..1 der Technologie. */
  fraction(id: string): number {
    const t = TECH_BY_ID[id];
    if (!t) return 0;
    if (this.done.has(id)) return 1;
    if (t.trigger) return Math.min(1, (this.made.get(t.trigger.item) ?? 0) / t.trigger.count);
    return (this.progress.get(id) ?? 0) / ResearchSystem.totalTicks(t);
  }

  /** Laborarbeit gutschreiben (Ticks). */
  addWork(n: number): void {
    const t = this.currentTech;
    if (!t) return;
    const p = (this.progress.get(t.id) ?? 0) + n;
    if (p >= ResearchSystem.totalTicks(t)) this.complete(t.id);
    else this.progress.set(t.id, p);
  }

  complete(id: string): void {
    const t = TECH_BY_ID[id];
    if (!t || this.done.has(id)) return;
    this.done.add(id);
    this.progress.delete(id);
    for (const r of t.unlocks) this.unlocked.add(r);
    if (this.current === id) this.current = null;
    const qi = this.queue.indexOf(id);
    if (qi >= 0) this.queue.splice(qi, 1);
    this.finished.push(id);
    this.checkTriggers();
    this.advance();
  }

  recipeUnlocked(recipe: string): boolean {
    return !LOCKED_RECIPES.has(recipe) || this.unlocked.has(recipe);
  }

  serialize(): ResearchData {
    return {
      cur: this.current,
      done: TECHS.filter((t) => this.done.has(t.id)).map((t) => t.id),
      prog: [...this.progress.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      made: [...this.made.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      q: [...this.queue],
    };
  }

  load(d: ResearchData): void {
    for (const id of d.done) this.complete(id);
    this.finished.length = 0;
    for (const [id, p] of d.prog) this.progress.set(id, p);
    for (const [item, n] of d.made ?? []) this.made.set(item, n);
    this.queue.length = 0;
    this.queue.push(...(d.q ?? []));
    this.current = d.cur;
  }
}
