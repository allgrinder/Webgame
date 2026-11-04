/** Sammelt Tastatur- und Mauszustand; Ereignisse werden pro Frame abgeholt. */
export class Input {
  readonly down = new Set<string>();
  private readonly pressedQ: string[] = [];
  mouseX = 0;
  mouseY = 0;
  left = false;
  right = false;
  leftPressed = false;
  rightPressed = false;
  ctrl = false;
  shift = false;
  wheel = 0;
  /** Maus über dem Spielfeld (nicht über HUD-Elementen). */
  overCanvas = true;

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (isTextInput(e.target)) return;
      const k = keyName(e);
      if (!e.repeat) this.pressedQ.push(k);
      this.down.add(k);
      this.ctrl = e.ctrlKey || e.metaKey;
      this.shift = e.shiftKey;
      if (k === 'alt' || k === 'tab' || /^f\d+$/.test(k) && k !== 'f12' && k !== 'f5') e.preventDefault();
      if (e.ctrlKey && (k === 's' || k === 'l')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(keyName(e));
      this.ctrl = e.ctrlKey || e.metaKey;
      this.shift = e.shiftKey;
      if (keyName(e) === 'alt') e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.left = this.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      this.ctrl = e.ctrlKey || e.metaKey;
      this.shift = e.shiftKey;
      if (e.button === 0) {
        this.left = true;
        this.leftPressed = true;
      } else if (e.button === 2) {
        this.right = true;
        this.rightPressed = true;
      }
      canvas.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.left = false;
      else if (e.button === 2) this.right = false;
    });
    window.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      this.overCanvas = e.target instanceof HTMLCanvasElement;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: false },
    );
  }

  /** Tasten, die seit dem letzten Aufruf gedrückt wurden. */
  takePressed(): string[] {
    return this.pressedQ.splice(0);
  }

  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  endFrame(): void {
    this.leftPressed = false;
    this.rightPressed = false;
  }
}

function keyName(e: KeyboardEvent): string {
  if (e.code.startsWith('Key')) return e.code.slice(3).toLowerCase();
  if (e.code.startsWith('Digit')) return e.code.slice(5);
  if (e.key === 'Alt' || e.code.startsWith('Alt')) return 'alt';
  if (e.key === 'Control') return 'control';
  if (e.key === 'Shift') return 'shift';
  return e.key.toLowerCase();
}

function isTextInput(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}
