import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('capture editorial layout on desktop and mobile', async ({ page }) => {
  const folder = 'artifacts/screenshots';
  mkdirSync(folder, { recursive: true });
  for (const width of [320, 375, 390, 430, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
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

test('capture shopping states on mobile', async ({ page }) => {
  const folder = 'artifacts/screenshots';
  mkdirSync(folder, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  await page.screenshot({path:folder+'/filters-open-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'راهنمای سایز' }).click();
  await page.screenshot({path:folder+'/size-guide-open-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', {name:'رنگ کرم'}).click();
  await page.getByRole('button', {name:'سایز M'}).click();
  await page.getByRole('button', {name:'افزودن به سبد خرید'}).click();
  await page.screenshot({path:folder+'/mini-cart-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/cart');
  await page.screenshot({path:folder+'/cart-390.png',fullPage:true,animations:'disabled'});
  await page.goto('/checkout');
  await page.screenshot({path:folder+'/checkout-390.png',fullPage:true,animations:'disabled'});
});
