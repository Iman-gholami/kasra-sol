import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('cart and checkout fit the audit viewport matrix with populated shopping state', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync('artifacts/screenshots', { recursive: true });
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' })).toBeVisible();
  for (const width of [360, 390, 430, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    for (const route of ['cart', 'checkout']) {
      await page.goto('/' + route);
      await expect(page.locator(route === 'cart' ? '.cart-item' : '.checkout-card').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        route + ' at ' + width).toBe(true);
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: `artifacts/screenshots/${route}-audit-${width}.png`,
          fullPage: true, animations: 'disabled' });
      }
    }
  }
});
