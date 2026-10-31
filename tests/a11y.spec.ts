import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// axe-core on every key route and the main overlays, at desktop and phone sizes.
// Serious/critical findings fail the test; anything else is attached for review.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const ROUTES = ['/', '/shop', '/category/manto', '/search?q=' + encodeURIComponent('شومیز'), '/search', '/product/shomiz-01',
  '/cart', '/checkout', '/wishlist', '/faq', '/size-guide', '/contact', '/about', '/shipping-and-returns', '/account',
  '/order-confirmation', '/missing-page'];

async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  if (result.violations.length) {
    test.info().annotations.push({ type: 'axe', description: label + ': ' + result.violations.map(v => v.impact + ' ' + v.id + ' ×' + v.nodes.length).join(', ') });
  }
  expect(blocking.map(v => ({ id: v.id, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })), label).toEqual([]);
}

const seed = (page: Page) => page.addInitScript(() => localStorage.setItem('kasra-demo-v1', JSON.stringify({
  cart: [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }], wishlist: ['manto-03']
})));

for (const [name, use] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(name, () => {
    test.use(use);

    test('key routes have no serious or critical axe violations', async ({ page }) => {
      test.setTimeout(120_000);
      await seed(page);
      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page.locator('main')).toBeVisible();
        await audit(page, name + ' ' + route);
      }
    });

    test('open overlays have no serious or critical axe violations', async ({ page }) => {
      await seed(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'جستجوی محصولات' }).click();
      await page.getByRole('combobox', { name: 'عبارت جستجو' }).fill('مانتو');
      await expect(page.getByRole('option').first()).toBeVisible();
      await audit(page, name + ' search');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      // One phone layout at every width, so both sizes audit the same overlays.
      {
        await page.getByRole('button', { name: 'باز کردن منو' }).click();
        await expect(page.getByRole('navigation', { name: 'منوی موبایل' })).toBeVisible();
        await audit(page, name + ' menu');
        await page.keyboard.press('Escape');
        await page.goto('/shop');
        await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
        await expect(page.getByRole('dialog', { name: 'فیلترهای محصولات' })).toBeVisible();
        await audit(page, name + ' filters');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: /^مرتب‌سازی:/ }).click();
        await expect(page.getByRole('dialog', { name: 'مرتب‌سازی' })).toBeVisible();
        await audit(page, name + ' sort');
        await page.keyboard.press('Escape');
      }
      await page.goto('/product/shomiz-01');
      await page.getByRole('button', { name: 'راهنمای سایز' }).click();
      await expect(page.getByRole('dialog', { name: 'راهنمای سایز نمونه' })).toBeVisible();
      await audit(page, name + ' size guide');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /بزرگ‌نمایی تصویر ۱/ }).click();
      await expect(page.getByRole('dialog', { name: 'نمای بزرگ محصول' })).toBeVisible();
      await audit(page, name + ' zoom');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'رنگ کرم' }).click();
      await page.getByRole('button', { name: 'سایز M' }).click();
      await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' })).toBeVisible();
      await audit(page, name + ' added to cart');
    });
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('overlays and the gallery work without animation', async ({ page }) => {
    const instant = (value: string) => value.split(',').every(part => parseFloat(part) < 0.001);
    await page.goto('/product/shomiz-01');
    const gallery = page.locator('.pdp-gallery');
    const track = page.locator('.pdp-track');
    await gallery.getByRole('button', { name: 'تصویر بعدی' }).click();
    await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
    // The track jumps straight to the next slide instead of smooth-scrolling.
    const [left, width] = await track.evaluate(node => [Math.abs(node.scrollLeft), node.clientWidth]);
    expect(Math.abs(left - width)).toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: 'راهنمای سایز' }).click();
    const guide = page.getByRole('dialog', { name: 'راهنمای سایز نمونه' });
    await expect(guide).toBeVisible();
    expect(instant(await guide.evaluate(node => getComputedStyle(node).transitionDuration))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(guide).toBeHidden();

    await page.goto('/');
    const opener = page.getByRole('button', { name: 'باز کردن منو' });
    await opener.click();
    const menu = page.getByRole('navigation', { name: 'منوی موبایل' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
