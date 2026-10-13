import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('capture editorial layout on desktop and mobile', async ({ page }) => {
  const folder = 'artifacts/screenshots';
  mkdirSync(folder, { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, route] of [
      ['home','/'], ['catalog','/shop'], ['product','/product/shomiz-01']
    ]) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(async () => {
        await Promise.all([...document.images].filter(i => i.getBoundingClientRect().width > 0).map(i => i.decode().catch(() => {})));
      });
      await page.screenshot({ path: folder + '/' + name + '-' + width + '.png', fullPage: true, animations: 'disabled' });
    }
  }
});
