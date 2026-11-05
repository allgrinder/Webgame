/**
 * Elektrische Energiequelle: kleiner Puffer, den das Stromnetz jeden Tick auffüllt.
 * Reicht der Strom nicht, wird der Puffer nur teilweise gefüllt und die Maschine arbeitet
 * entsprechend seltener (anteilige Verlangsamung).
 */
export class ElectricSource {
  readonly type = 'electric' as const;
  /** Energie im Puffer (J). */
  buffer = 0;
  /** Vom Stromnetz gesetzt: an ein Netz angeschlossen. */
  connected = false;

  /** Nennverbrauch im Betrieb (J/Tick), mit Modulfaktor. */
  usagePerTick: number;
  /** Puffergröße (J). */
  capacity: number;
  private readonly baseUsage: number;
  private readonly baseCapacity: number;
  /** Höchste Nachladung je Tick (J), z. B. Roboterhangar 2,1 MW. */
  maxInput = Infinity;

  constructor(
    usagePerTick: number,
    /** Grundlast, solange angeschlossen (J/Tick). */
    readonly drainPerTick: number,
    capacity: number,
  ) {
    this.usagePerTick = this.baseUsage = usagePerTick;
    this.capacity = this.baseCapacity = capacity;
  }

  /** Verbrauchsfaktor durch Module (1 = Grundwert); der Puffer wächst mit. */
  setFactor(f: number): void {
    this.usagePerTick = Math.round(this.baseUsage * f);
    this.capacity = Math.max(this.baseCapacity, this.usagePerTick * 2);
  }

  /** Wieviel das Netz in diesem Tick nachfüllen soll (inkl. Grundlast). */
  request(): number {
    return Math.min(this.maxInput, Math.max(0, this.capacity - this.buffer)) + this.drainPerTick;
  }

  /** Vom Netz geliefert; die Grundlast wird sofort verbraucht. */
  supply(joules: number): void {
    const afterDrain = joules - this.drainPerTick;
    if (afterDrain >= 0) this.buffer = Math.min(this.capacity, this.buffer + afterDrain);
    else this.buffer = Math.max(0, this.buffer + afterDrain);
  }

  consume(joules: number): boolean {
    if (this.buffer < joules) return false;
    this.buffer -= joules;
    return true;
  }

  canSupply(joules: number): boolean {
    return this.buffer >= joules;
  }

  serialize(): { eb: number } {
    return { eb: this.buffer };
  }

  load(d: { eb: number }): void {
    this.buffer = d.eb ?? 0;
  }
}
