import { type Page, expect, test } from '@playwright/test';

async function openScene(page: Page, query: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/${query}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  return errors;
}

type W = { eisenwerk: { world: { tick: number; entities: Map<number, { kind: string; result?: { count(i: string): number } }> } } };

test('Startszene lädt ohne Konsolenfehler', async ({ page }) => {
  const errors = await openScene(page, '');
  await page.screenshot({ path: 'test-results/start.png' });
  const tick = await page.evaluate(() => (window as unknown as W).eisenwerk.world.tick);
  expect(tick).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('Demo-Szene zeigt die laufende Produktionskette', async ({ page }) => {
  const errors = await openScene(page, '?scene=demo&warp=2400');
  await page.mouse.move(640, 760);
  await page.keyboard.press('Alt');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/demo.png' });
  const plates = await page.evaluate(() => {
    let n = 0;
    for (const e of (window as unknown as W).eisenwerk.world.entities.values()) if (e.kind === 'furnace') n += e.result!.count('iron-plate');
    return n;
  });
  expect(errors).toEqual([]);
  // Nach 40 s: Platten in den Öfen oder bereits auf dem Ausgabeband
  const belt = await page.evaluate(() => (window as unknown as { eisenwerk: { world: { belts: { itemCount: number } } } }).eisenwerk.world.belts.itemCount);
  expect(plates + belt).toBeGreaterThan(5);
});

test('Demo: Stromteil, Forschungsfenster und Übersichtskarte', async ({ page }) => {
  const errors = await openScene(page, '?scene=demo&warp=1800');
  type R = { eisenwerk: { world: { research: { fraction(id: string): number }; renderer?: unknown } } };
  const frac = await page.evaluate(() => (window as unknown as R).eisenwerk.world.research.fraction('automation'));
  expect(frac).toBeGreaterThan(0.2);
  await page.keyboard.press('t');
  await expect(page.locator('.window.tech')).toBeVisible();
  expect(await page.locator('.tt-card').count()).toBeGreaterThan(10);
  await expect(page.locator('canvas.minimap')).toBeVisible();
  await page.screenshot({ path: 'test-results/research.png' });
  expect(errors).toEqual([]);
});

test('Gottmodus-Link: neue Runde mit Gottmodus, ohne Weiterspielen-Dialog', async ({ page }) => {
  const errors = await openScene(page, '?god');
  await expect(page.locator('.hud-info')).toContainText('GOTTMODUS');
  const god = await page.evaluate(() => (window as unknown as { eisenwerk: { world: { player: { god: boolean } } } }).eisenwerk.world.player.god);
  expect(god).toBe(true);
  expect(errors).toEqual([]);
});

test('Editor-Modus: F2 hält an, alles kostenlos bauen und entfernen, danach läuft das Spiel weiter', async ({ page }) => {
  const errors = await openScene(page, '?god');
  type G = {
    eisenwerk: {
      editor: boolean; paused: boolean;
      world: { tick: number; entities: Map<number, { name: string }>; map: { clearTrees(x: number, y: number, w: number, h: number): void; setWater(x: number, y: number, v: boolean): void };
        player: { inventory: { count(i: string): number } } };
      renderer: { screenToWorld(x: number, y: number): { x: number; y: number }; app: { screen: { width: number; height: number } } };
    };
  };
  await page.keyboard.press('F2');
  await expect(page.locator('.editor-bar')).toBeVisible();
  await expect(page.locator('.editor-palette')).toBeVisible();
  const t0 = await page.evaluate(() => (window as unknown as G).eisenwerk.world.tick);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as unknown as G).eisenwerk.world.tick)).toBe(t0);
  // Bauplatz rechts der Mitte freiräumen, dann Montagemaschine 3 (nicht erforscht, nicht im Inventar) bauen
  const spot = await page.evaluate(() => {
    const g = (window as unknown as G).eisenwerk;
    const sx = g.renderer.app.screen.width / 2 + 260;
    const sy = g.renderer.app.screen.height / 2;
    const w = g.renderer.screenToWorld(sx, sy);
    g.world.map.clearTrees(Math.floor(w.x) - 3, Math.floor(w.y) - 3, 7, 7);
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) g.world.map.setWater(Math.floor(w.x) + x, Math.floor(w.y) + y, false);
    return { sx, sy };
  });
  await page.locator('.editor-palette .hb-item[data-item="assembling-machine-3"]').click();
  await page.mouse.move(spot.sx, spot.sy);
  await page.waitForTimeout(100);
  await page.mouse.click(spot.sx, spot.sy);
  await page.waitForTimeout(200);
  const count = () => page.evaluate(() => [...(window as unknown as G).eisenwerk.world.entities.values()].filter((e) => e.name === 'assembling-machine-3').length);
  expect(await count()).toBe(1);
  expect(await page.evaluate(() => (window as unknown as G).eisenwerk.world.player.inventory.count('assembling-machine-3'))).toBe(0);
  await page.screenshot({ path: 'test-results/editor.png' });
  // Rechtsklick entfernt sofort
  await page.mouse.click(spot.sx, spot.sy, { button: 'right' });
  await page.waitForTimeout(200);
  expect(await count()).toBe(0);
  // Beenden: Spiel läuft weiter
  await page.keyboard.press('F2');
  await expect(page.locator('.editor-bar')).toBeHidden();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as unknown as G).eisenwerk.world.tick)).toBeGreaterThan(t0 + 10);
  expect(errors).toEqual([]);
});
