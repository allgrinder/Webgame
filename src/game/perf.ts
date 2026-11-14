/**
 * Bildzeit-Messung (Skill performance-optimization: in Millisekunden messen, nicht in FPS; Durchschnitt und p95).
 * Ringpuffer je Messgröße über die letzten n Bilder.
 */
export class FrameTimes {
  private readonly buf: Float64Array;
  private i = 0;
  private n = 0;
  constructor(size = 300) {
    this.buf = new Float64Array(size);
  }
  add(ms: number): void {
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    this.n = Math.min(this.n + 1, this.buf.length);
  }
  /** Durchschnitt, p95 und Höchstwert der gespeicherten Bilder. */
  summary(): { avg: number; p95: number; max: number; n: number } {
    if (!this.n) return { avg: 0, p95: 0, max: 0, n: 0 };
    const a = Array.from(this.buf.subarray(0, this.n)).sort((x, y) => x - y);
    return { avg: a.reduce((s, v) => s + v, 0) / a.length, p95: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))], max: a[a.length - 1], n: a.length };
  }
  reset(): void {
    this.i = 0;
    this.n = 0;
  }
}

/** Messgrößen eines Bilds: Simulation (alle Takte des Bilds), Zeichnen, Oberfläche, gesamt. */
export class PerfMonitor {
  readonly sim = new FrameTimes();
  /** Simulation je Takt (ein Bild kann bei niedriger Bildrate mehrere Takte rechnen). */
  readonly tick = new FrameTimes();
  readonly render = new FrameTimes();
  readonly hud = new FrameTimes();
  readonly frame = new FrameTimes();
  report(): Record<'sim' | 'tick' | 'render' | 'hud' | 'frame', { avg: number; p95: number; max: number; n: number }> {
    return { sim: this.sim.summary(), tick: this.tick.summary(), render: this.render.summary(), hud: this.hud.summary(), frame: this.frame.summary() };
  }
  reset(): void {
    this.sim.reset();
    this.tick.reset();
    this.render.reset();
    this.hud.reset();
    this.frame.reset();
  }
}
