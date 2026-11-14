import { SHAKE } from '../data/fx';

/** Bildschirmwackeln: Trauma 0..1, Abbau in Echtzeit, Ausschlag aus summierten Sinuskurven (Skill game-feel). */
export class ScreenShake {
  trauma = 0;
  private t = 0;
  /** Stärke aus den Einstellungen (0 = aus). */
  strength = shakeSetting();
  readonly offset = { x: 0, y: 0 };

  add(amount: number): void {
    if (this.strength <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** dt in Sekunden (Echtzeit). */
  update(dt: number): { x: number; y: number } {
    if (this.trauma <= 0) {
      this.offset.x = 0;
      this.offset.y = 0;
      return this.offset;
    }
    this.trauma = Math.max(0, this.trauma - SHAKE.decay * dt);
    this.t += dt * 30;
    const k = this.trauma * this.trauma * this.strength;
    this.offset.x = SHAKE.maxOffset[0] * k * Math.sin(this.t * 1.7);
    this.offset.y = SHAKE.maxOffset[1] * k * Math.sin(this.t * 2.3);
    if (this.trauma === 0) {
      this.offset.x = 0;
      this.offset.y = 0;
    }
    return this.offset;
  }
}

/** Einstellung Bildschirmwackeln: 1, 0,5 oder 0 (Menü, `eisenwerk.shake`). */
export const SHAKE_STEPS = [1, 0.5, 0] as const;
export function shakeSetting(): number {
  try {
    const v = Number(localStorage.getItem('eisenwerk.shake') ?? '1');
    return (SHAKE_STEPS as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
}
export function setShakeSetting(v: number): void {
  try {
    localStorage.setItem('eisenwerk.shake', String(v));
  } catch { /* privat */ }
}

/** „Weniger Blitzen“: Funken und Leuchtwolken gedämpft (Skill game-feel, Fotosensibilität). */
export function reduceFlash(): boolean {
  try {
    return localStorage.getItem('eisenwerk.flash') === '1';
  } catch {
    return false;
  }
}
export function setReduceFlash(on: boolean): void {
  try {
    localStorage.setItem('eisenwerk.flash', on ? '1' : '0');
  } catch { /* privat */ }
}
