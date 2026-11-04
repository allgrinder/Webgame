import { Game } from './game/game';
import { type SceneName, createScene } from './game/scenes';
import { loadSprites } from './render/assets';
import { GameRenderer } from './render/renderer';

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const sceneName = (params.get('scene') ?? 'freeplay') as SceneName;
  const seed = Number(params.get('seed') ?? 12345) | 0;
  const debug = params.has('debug');
  const root = document.getElementById('app')!;
  const sprites = await loadSprites();
  const renderer = await GameRenderer.create(root, sprites);
  const scene = createScene(sceneName, seed);
  const warp = Number(params.get('warp') ?? 0);
  if (warp > 0) scene.world.run(Math.min(warp, 60 * 60 * 30));
  const game = new Game(root, renderer, sprites, scene, debug);
  document.getElementById('loading')?.remove();
  game.start();
  // Für Playwright und Debugging
  (window as unknown as { eisenwerk: Game }).eisenwerk = game;
  document.body.dataset.ready = '1';
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = `Fehler beim Start: ${String(err)}`;
});
