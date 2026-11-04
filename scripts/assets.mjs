// Asset-Pipeline: rendert geänderte Blender-Modelle neu und packt alles in Atlanten.
// Aufruf: npm run assets [-- --force] [-- --only belt,ground]
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAtlases } from './lib/atlas.mjs';
import { Img } from './lib/image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BL = path.join(root, 'assets/blender');
const CACHE = path.join(root, 'assets/.cache/renders');
const OUT = path.join(root, 'public/assets');
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;

function blenderVersion() {
  try {
    return execFileSync('blender', ['--version'], { encoding: 'utf8' }).split('\n')[0].trim();
  } catch {
    return null;
  }
}

function sha(...parts) {
  const h = crypto.createHash('sha1');
  for (const p of parts) h.update(p);
  return h.digest('hex').slice(0, 16);
}

const libFiles = [path.join(BL, 'render.py'), ...fs.readdirSync(path.join(BL, 'lib')).filter((f) => f.endsWith('.py')).sort().map((f) => path.join(BL, 'lib', f))];
const libHash = sha(...libFiles.map((f) => fs.readFileSync(f)));
const models = fs.readdirSync(path.join(BL, 'models')).filter((f) => f.endsWith('.py')).map((f) => f.slice(0, -3)).sort();

const oldManifest = fs.existsSync(path.join(OUT, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')) : null;
const version = blenderVersion();

/** Frames eines Sprites aus den bestehenden Atlanten ausschneiden. */
const atlasCache = new Map();
function framesFromAtlas(name) {
  const info = oldManifest.sprites[name];
  const out = [];
  for (const f of info.frames) {
    let found = null;
    for (const a of oldManifest.atlases) {
      if (!atlasCache.has(a.file)) {
        const json = JSON.parse(fs.readFileSync(path.join(OUT, a.file), 'utf8'));
        atlasCache.set(a.file, { json, img: Img.read(path.join(OUT, json.meta.image)) });
      }
      const { json, img } = atlasCache.get(a.file);
      const fr = json.frames[f];
      if (fr) {
        found = img.crop(fr.frame.x, fr.frame.y, fr.frame.w, fr.frame.h);
        break;
      }
    }
    if (!found) throw new Error(`Frame ${f} nicht im Atlas`);
    out.push(found);
  }
  return out;
}

const sprites = [];
const modelInfo = {};
let rendered = 0;
for (const m of models) {
  const hash = sha(libHash, fs.readFileSync(path.join(BL, 'models', `${m}.py`)));
  const dir = path.join(CACHE, m);
  const cached = fs.existsSync(path.join(dir, 'hash.txt')) && fs.readFileSync(path.join(dir, 'hash.txt'), 'utf8') === hash;
  const inAtlas = oldManifest?.models?.[m]?.hash === hash;
  const wanted = only ? only.has(m) : true;
  let source;
  if (!force && cached) source = 'cache';
  else if (!force && inAtlas && !(only && wanted)) source = 'atlas';
  else if (!wanted && inAtlas) source = 'atlas';
  else source = 'render';
  if (source === 'render') {
    if (!version) {
      console.error(`Blender fehlt – Modell "${m}" kann nicht gerendert werden. Installation z. B.: sudo apt-get install blender`);
      if (inAtlas) source = 'atlas';
      else process.exit(1);
    }
  }
  if (source === 'render') {
    console.log(`> Rendere ${m} …`);
    fs.rmSync(dir, { recursive: true, force: true });
    const r = spawnSync('blender', ['-b', '--factory-startup', '-noaudio', '-P', path.join(BL, 'render.py'), '--', '--model', m, '--out', dir], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const log = (r.stdout ?? '') + (r.stderr ?? '');
    const done = log.split('\n').find((l) => l.startsWith('[eisenwerk]'));
    if (r.status !== 0 || !done) {
      console.error(log.split('\n').filter((l) => /Error|Traceback|File "|^\s+\w/.test(l)).slice(-30).join('\n'));
      throw new Error(`Blender-Render für ${m} fehlgeschlagen`);
    }
    console.log(`  ${done}`);
    fs.writeFileSync(path.join(dir, 'hash.txt'), hash);
    rendered++;
    source = 'cache';
  }
  const names = [];
  if (source === 'cache') {
    const list = JSON.parse(fs.readFileSync(path.join(dir, 'sprites.json'), 'utf8'));
    for (const s of list) {
      if (s.sheet) {
        // großes Bild in Einzelsprites schneiden
        const img = Img.read(path.join(dir, s.sheet));
        const cw = img.w / s.cols;
        const ch = img.h / s.rows;
        for (let y = 0; y < s.rows; y++)
          for (let x = 0; x < s.cols; x++) {
            const name = s.nameFmt.replace('{x}', String(x)).replace('{y}', String(y));
            sprites.push({ name, group: s.group, anchor: s.anchor, frames: [img.crop(x * cw, y * ch, cw, ch)] });
            names.push(name);
          }
        continue;
      }
      sprites.push({ name: s.name, group: s.group, anchor: s.anchor, fps: s.fps, meta: s.meta, frames: s.frames.map((f) => Img.read(path.join(dir, f))) });
      names.push(s.name);
    }
  } else {
    for (const name of oldManifest.models[m].sprites) {
      const info = oldManifest.sprites[name];
      sprites.push({ name, group: info.group, anchor: info.anchor, fps: info.fps, meta: info.meta, frames: framesFromAtlas(name) });
      names.push(name);
    }
  }
  modelInfo[m] = { hash, sprites: names };
}

// Sprites, die noch kein Blender-Modell liefert, aus dem bisherigen Atlas übernehmen (Platzhalter)
const provided = new Set(sprites.map((s) => s.name));
const keep = [];
if (oldManifest) {
  const fromModels = new Set(Object.values(oldManifest.models ?? {}).flatMap((x) => x.sprites));
  for (const name of Object.keys(oldManifest.sprites)) {
    if (provided.has(name) || fromModels.has(name)) continue;
    const info = oldManifest.sprites[name];
    sprites.push({ name, group: info.group, anchor: info.anchor, fps: info.fps, meta: info.meta, frames: framesFromAtlas(name) });
    keep.push(name);
  }
}
if (keep.length) console.log(`  ${keep.length} Platzhalter-Sprites ohne Blender-Modell übernommen`);

const manifest = writeAtlases(OUT, sprites, { generator: 'blender', blender: version ?? oldManifest?.blender ?? null, models: modelInfo, placeholders: keep });
console.log(`Fertig: ${rendered} Modell(e) neu gerendert, ${Object.keys(manifest.sprites).length} Sprites, ${manifest.atlases.length} Atlanten.`);
