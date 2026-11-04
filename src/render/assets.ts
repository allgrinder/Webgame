import { Assets, type Spritesheet, Texture } from 'pixi.js';

export interface SpriteInfo {
  group: string;
  frames: string[];
  w: number;
  h: number;
  anchor: [number, number];
  fps?: number;
  meta?: { reach?: number; pivotLift?: number; blend?: string };
}

export interface Manifest {
  version: number;
  tileSize: number;
  generator: string;
  atlases: { group: string; file: string }[];
  sprites: Record<string, SpriteInfo>;
}

/** Zugriff auf alle Sprites aus public/assets/manifest.json. */
export class SpriteLib {
  private readonly tex = new Map<string, Texture[]>();
  constructor(readonly manifest: Manifest, sheets: Spritesheet[]) {
    const all: Record<string, Texture> = {};
    for (const s of sheets) Object.assign(all, s.textures);
    for (const [name, info] of Object.entries(manifest.sprites)) {
      this.tex.set(name, info.frames.map((f) => all[f] ?? Texture.WHITE));
    }
  }

  has(name: string): boolean {
    return this.tex.has(name);
  }

  frames(name: string): Texture[] {
    return this.tex.get(name) ?? [Texture.WHITE];
  }

  frame(name: string, i = 0): Texture {
    const f = this.frames(name);
    return f[((i % f.length) + f.length) % f.length];
  }

  info(name: string): SpriteInfo | undefined {
    return this.manifest.sprites[name];
  }

  /** Anzahl Varianten mit Präfix, z. B. "ground." -> 8 */
  countPrefix(prefix: string): number {
    let n = 0;
    while (this.tex.has(`${prefix}${n}`)) n++;
    return n;
  }

  /** Data-URL eines Frames für das DOM-HUD (Icons). */
  iconUrl(name: string): string {
    return this.iconCache.get(name) ?? '';
  }
  readonly iconCache = new Map<string, string>();
}

export async function loadSprites(base = './assets/'): Promise<SpriteLib> {
  const res = await fetch(`${base}manifest.json`);
  const manifest = (await res.json()) as Manifest;
  const sheets = await Promise.all(manifest.atlases.map((a) => Assets.load<Spritesheet>(`${base}${a.file}`)));
  const lib = new SpriteLib(manifest, sheets);
  await buildIconUrls(lib, base, manifest);
  return lib;
}

/** Item- und Statussymbole als Data-URLs für das DOM ausschneiden. */
async function buildIconUrls(lib: SpriteLib, base: string, manifest: Manifest): Promise<void> {
  const groups = new Set(['items']);
  for (const a of manifest.atlases) {
    if (!groups.has(a.group)) continue;
    const json = await (await fetch(`${base}${a.file}`)).json();
    const img = new Image();
    img.src = `${base}${json.meta.image}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    for (const [name, info] of Object.entries(manifest.sprites)) {
      const fr = json.frames[info.frames[0]];
      if (!fr) continue;
      canvas.width = fr.frame.w;
      canvas.height = fr.frame.h;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, fr.frame.x, fr.frame.y, fr.frame.w, fr.frame.h, 0, 0, fr.frame.w, fr.frame.h);
      lib.iconCache.set(name, canvas.toDataURL());
    }
  }
}
