import { expect, test } from '@playwright/test';

/**
 * Leistung der Darstellung in der Großfabrik (Skill performance-optimization): Bildzeiten in ms, Durchschnitt und p95.
 * Im Container rendert Chromium in Software (SwiftShader) – die Zahlen sind deshalb nur relativ vergleichbar; die Grenze ist
 * großzügig und fängt grobe Rückschritte. Ergebnis steht in test-results/perf.json.
 */
test('Großfabrik: Bildzeiten messen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?scene=factory');
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60_000 });
  type G = { eisenwerk: { perf: { reset(): void; report(): Record<string, { avg: number; p95: number; max: number; n: number }> }; world: { entities: Map<number, unknown> } } };
  const views: Record<string, unknown> = {};
  for (const [name, zoom] of [['übersicht', 0.35], ['nah', 1]] as const) {
    await page.evaluate((z) => {
      const g = (window as unknown as { eisenwerk: { renderer: { camera: { zoom: number; x: number; y: number } } } }).eisenwerk;
      g.renderer.camera.zoom = z;
      g.renderer.camera.x = 0;
      g.renderer.camera.y = -40;
    }, zoom);
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window as unknown as G).eisenwerk.perf.reset());
    await page.waitForTimeout(5000);
    views[name] = await page.evaluate(() => (window as unknown as G).eisenwerk.perf.report());
  }
  const entities = await page.evaluate(() => (window as unknown as G).eisenwerk.world.entities.size);
  await page.screenshot({ path: 'test-results/perf.png' });
  const fs = await import('node:fs');
  fs.writeFileSync('test-results/perf.json', JSON.stringify({ entities, views }, null, 2));
  console.log(JSON.stringify({ entities, views }));
  expect(entities).toBeGreaterThan(5000);
  expect(errors).toEqual([]);
  const over = views['übersicht'] as Record<string, { p95: number }>;
  // Simulation je Takt (CPU) muss auch im Browser im Budget bleiben; je Bild schwankt sie mit der Bildrate
  expect(over.tick.p95).toBeLessThan(12);
});
