import { expect, test } from '@playwright/test';

async function openScene(page: import('@playwright/test').Page, query: string) {
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

test('Startszene lädt ohne Konsolenfehler', async ({ page }) => {
  const errors = await openScene(page, '');
  await page.screenshot({ path: 'test-results/start.png' });
  const tick = await page.evaluate(() => (window as unknown as { eisenwerk: { world: { tick: number } } }).eisenwerk.world.tick);
  expect(tick).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});
