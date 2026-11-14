/**
 * Geräusche: eigene, per Formel erzeugte Klänge (ZzFX, MIT), abgespielt über Web Audio.
 * Lautstärke nach Entfernung zur Bildmitte, Stereo nach links/rechts, Drosselung gleicher Klänge.
 * Wird erst nach der ersten Nutzeraktion gestartet (Browser-Regel für Audio).
 */
import type { GameEvent, GameEventType } from '../sim/events';
import type { World } from '../sim/world';
import { Status } from '../sim/entity';

/** ZzFX-Parameter: [Lautstärke, Zufall, Frequenz, Anschlag, Halten, Abklingen, Form, Formkurve, Gleiten, Gleiten2,
 * Tonsprung, Sprungzeit, Wiederholung, Rauschen, Modulation, Bitcrush, Echo, Haltepegel, Zerfall, Tremolo, Filter] */
type Params = (number | undefined)[];

export const SOUNDS: Record<string, Params> = {
  build: [0.7, 0.05, 180, 0.005, 0.02, 0.12, 1, 1.6, , , , , , 0.4, , , 0.03, 0.6, 0.05],
  remove: [0.5, 0.05, 330, 0.01, 0.03, 0.08, 1, 1.4, 4, , , , , 0.2, , , , 0.7, 0.03],
  mine: [0.45, 0.25, 120, 0.002, 0.01, 0.07, 4, 1, , , , , , 1.6, , 0.25, , 0.4, 0.03],
  tree: [0.6, 0.15, 90, 0.002, 0.02, 0.15, 3, 0.6, -2, , , , , 0.8, , , 0.05, 0.5, 0.06],
  craft: [0.25, 0.02, 880, 0.002, 0.01, 0.05, 0, 1, , , 220, 0.03, , , , , , 0.6],
  shot: [0.45, 0.08, 260, 0, 0.015, 0.07, 4, 2.2, -10, , , , , 1.4, , 0.35, , 0.5, 0.02],
  turret: [0.35, 0.08, 220, 0, 0.012, 0.06, 4, 2.4, -12, , , , , 1.5, , 0.4, , 0.45, 0.02],
  bite: [0.5, 0.2, 70, 0.005, 0.02, 0.1, 3, 0.4, -5, , , , , 1, , , , 0.5, 0.04],
  hit: [0.3, 0.2, 150, 0, 0.01, 0.05, 4, 1, , , , , , 1.2, , 0.2, , 0.3],
  death: [0.45, 0.3, 160, 0.005, 0.05, 0.18, 2, 0.5, -6, -0.2, , , , 0.8, 4, , , 0.5, 0.05],
  explode: [1, 0.1, 55, 0.01, 0.15, 0.6, 4, 0.5, -1, , , , , 2.5, , 0.6, 0.1, 0.4, 0.2],
  nest: [1, 0.1, 40, 0.02, 0.3, 0.9, 4, 0.4, -0.5, , , , , 2.2, 2, 0.5, 0.15, 0.4, 0.3],
  research: [0.35, 0, 523, 0.01, 0.12, 0.3, 0, 1, , , 262, 0.12, , , , , 0.08, 0.6],
  click: [0.2, 0, 1200, 0, 0.005, 0.02, 0, 1, , , , , , , , , , 0.5],
  // Maschinen (Umgebung)
  drill: [0.18, 0.2, 60, 0.01, 0.05, 0.12, 3, 0.6, , , , , 0.06, 0.6, , 0.2, , 0.4, 0.04],
  furnace: [0.12, 0.3, 40, 0.05, 0.2, 0.3, 4, 0.3, , , , , , 2.5, , , , 0.3, 0.2],
  assembler: [0.12, 0.15, 300, 0.01, 0.03, 0.06, 1, 1.5, , , , , 0.04, 0.3, , 0.1, , 0.5],
  engine: [0.14, 0.1, 50, 0.02, 0.08, 0.1, 2, 0.5, , , , , 0.1, 0.4, , , , 0.5],
  belt: [0.06, 0.4, 80, 0.05, 0.1, 0.1, 4, 0.2, , , , , , 3, , , , 0.3],
  krabbler: [0.15, 0.4, 600, 0.002, 0.005, 0.03, 4, 1, , , , , 0.02, 1.2, , 0.4, , 0.3],
  // Raketenstart: langes, tiefes Grollen (eigene Parameter)
  launch: [1, 0.05, 38, 0.4, 1.6, 2.2, 4, 0.3, 0.4, , , , , 3, , 0.3, 0.2, 0.6, 0.6],
};

/**
 * Tongruppen (Skill audio-design: Regler je Gruppe, nie je Klang): Gesamt ← Effekte, Maschinen, Oberfläche.
 * Regler 0..1 werden quadriert (gleichmäßige Lautstärkeänderung über den ganzen Weg), 0 = stumm.
 */
export type AudioBus = 'master' | 'sfx' | 'ambience' | 'ui';
export const AUDIO_BUSES: readonly { id: AudioBus; label: string }[] = [
  { id: 'master', label: 'Gesamt' },
  { id: 'sfx', label: 'Effekte (Bauen, Kampf, Explosionen)' },
  { id: 'ambience', label: 'Maschinen und Umgebung' },
  { id: 'ui', label: 'Oberfläche und Forschung' },
];
const UI_SOUNDS = new Set(['click', 'research', 'craft']);
const AMBIENT_SOUNDS = new Set(['drill', 'furnace', 'assembler', 'engine', 'belt', 'krabbler']);
/** Gruppe eines Klangs. */
export function busOf(name: string): Exclude<AudioBus, 'master'> {
  return UI_SOUNDS.has(name) ? 'ui' : AMBIENT_SOUNDS.has(name) ? 'ambience' : 'sfx';
}
/** Reglerstellung → Verstärkung. */
export function sliderGain(v: number): number {
  const x = Math.max(0, Math.min(1, v));
  return x * x;
}

/** Gebäudeart → Umgebungsklang. */
const AMBIENT: Partial<Record<string, string>> = {
  drill: 'drill', furnace: 'furnace', assembler: 'assembler', generator: 'engine', boiler: 'furnace', pumpjack: 'drill',
};

const VOL_KEY = 'eisenwerk.volume';

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private build: ((...p: Params) => number[]) | null = null;
  private sampleRate = 44100;
  private last = new Map<string, number>();
  private ambientAt = 0;
  private readonly busGain = new Map<AudioBus, GainNode>();
  /** Reglerstellungen 0..1 je Gruppe. */
  readonly levels: Record<AudioBus, number> = { master: 0.8, sfx: 1, ambience: 0.8, ui: 0.8 };

  constructor() {
    try {
      const old = localStorage.getItem(VOL_KEY); // frühere einzelne Lautstärke (linear) → Gesamtregler
      const saved = JSON.parse(localStorage.getItem(VOL_KEY + 's') ?? 'null') as Partial<Record<AudioBus, number>> | null;
      if (saved) for (const b of AUDIO_BUSES) if (typeof saved[b.id] === 'number') this.levels[b.id] = Math.max(0, Math.min(1, saved[b.id]!));
      else if (old !== null) this.levels.master = Math.sqrt(Math.max(0, Math.min(1, Number(old))));
    } catch { /* privat */ }
    const start = () => {
      void this.init();
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  private async init(): Promise<void> {
    if (this.ctx) return;
    try {
      const { ZZFX } = await import('zzfx');
      this.ctx = ZZFX.audioContext as AudioContext;
      this.sampleRate = ZZFX.sampleRate;
      this.build = (...p: Params) => ZZFX.buildSamples(...p);
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.busGain.set('master', this.master);
      for (const b of AUDIO_BUSES) {
        if (b.id === 'master') continue;
        const g = this.ctx.createGain();
        g.connect(this.master);
        this.busGain.set(b.id, g);
      }
      this.applyLevels();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** Gesamtlautstärke als Verstärkung (0 = stumm). */
  get volume(): number {
    return sliderGain(this.levels.master);
  }

  private applyLevels(): void {
    for (const [id, g] of this.busGain) g.gain.value = sliderGain(this.levels[id]);
  }

  /** Regler einer Gruppe setzen (0..1) und merken. */
  setLevel(bus: AudioBus, v: number): void {
    this.levels[bus] = Math.max(0, Math.min(1, v));
    this.applyLevels();
    try {
      localStorage.setItem(VOL_KEY + 's', JSON.stringify(this.levels));
    } catch { /* privat */ }
  }

  /** Alte Schnittstelle: Gesamtregler. */
  setVolume(v: number): void {
    this.setLevel('master', v);
  }

  private buffer(name: string): AudioBuffer | null {
    if (!this.ctx || !this.build) return null;
    let b = this.buffers.get(name);
    if (!b) {
      const samples = this.build(...SOUNDS[name]);
      b = this.ctx.createBuffer(1, samples.length, this.sampleRate);
      b.getChannelData(0).set(samples);
      this.buffers.set(name, b);
    }
    return b;
  }

  /** Klang abspielen: Lautstärke 0..1, Panorama −1..1, kleine Tonhöhen-Schwankung. Gleiche Klänge höchstens alle minGap ms. */
  play(name: string, vol = 1, pan = 0, minGap = 40): void {
    const bus = busOf(name);
    if (!this.ctx || !this.master || this.levels.master <= 0 || this.levels[bus] <= 0 || vol <= 0.01) return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? 0) < minGap) return;
    this.last.set(name, now);
    const b = this.buffer(name);
    if (!b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g).connect(p).connect(this.busGain.get(bus) ?? this.master);
    src.start();
  }

  /** Ereignisse der Simulation hörbar machen (Entfernung zur Bildmitte, Zoom). */
  update(world: World, events: readonly GameEvent[], cam: { x: number; y: number; zoom: number }, viewW: number): void {
    if (!this.ctx) return;
    const halfW = viewW / 2 / (64 * cam.zoom);
    const hear = Math.max(12, halfW * 1.3);
    const atten = (x: number, y: number) => {
      const d = Math.hypot(x - cam.x, y - cam.y);
      return d > hear ? 0 : 1 - d / hear;
    };
    const gap: Partial<Record<GameEventType, number>> = { turret: 70, shot: 60, hit: 80, bite: 90, mine: 120, death: 50 };
    for (const ev of events) {
      const a = atten(ev.x, ev.y);
      if (a <= 0) continue;
      this.play(ev.type, a, (ev.x - cam.x) / Math.max(1, halfW), gap[ev.type] ?? 40);
    }
    // Umgebung: alle 0,35 s die nächsten arbeitenden Maschinen und Krabbler
    const now = performance.now();
    if (now - this.ambientAt < 350) return;
    this.ambientAt = now;
    const near: { name: string; a: number; x: number }[] = [];
    for (const e of world.entities.values()) {
      const s = AMBIENT[e.kind];
      if (!s || e.status !== Status.Working) continue;
      const a = atten(e.cx, e.cy);
      if (a > 0) near.push({ name: s, a, x: e.cx });
    }
    let krabbler = 0;
    for (const u of world.enemies.units.values()) {
      const a = atten(u.x, u.y);
      if (a > 0.2 && u.mode !== 'guard') krabbler = Math.max(krabbler, a);
    }
    near.sort((p, q) => q.a - p.a);
    const used = new Set<string>();
    for (const n of near) {
      if (used.has(n.name) || used.size >= 3) continue;
      used.add(n.name);
      const count = near.filter((m) => m.name === n.name).length;
      this.play(n.name, n.a * Math.min(1.6, 0.6 + count * 0.08), (n.x - cam.x) / Math.max(1, halfW), 300);
    }
    if (krabbler > 0) this.play('krabbler', krabbler, 0, 300);
  }
}
