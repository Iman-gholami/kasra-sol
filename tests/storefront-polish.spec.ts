import { expect, test, type Locator, type Page } from '@playwright/test';

// Storefront polish: layout alignment, touch-safe hover, compact product cards, sheet header, phone gallery,
// search wording and cart lines. Each test pins one visible behaviour so a regression shows up by name.

const seed = (page: Page) => page.addInitScript(() => localStorage.setItem('kasra-demo-v1', JSON.stringify({
  cart: [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }], wishlist: []
})));

/** Overlays scale or slide in; measure their geometry only once the enter transition has finished. */
const settled = (overlay: Locator) => overlay.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));

const box = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('header, sections and editorial rows share one page width on common laptop screens', async ({ page }) => {
    for (const width of [1440, 1512]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const header = await box(page.locator('.header-inner'));
      for (const selector of ['.hero', '.category-section', '.editorial-band', '.footer-grid']) {
        const section = await box(page.locator(selector));
        expect(Math.abs(section.x - header.x), selector + ' start at ' + width).toBeLessThanOrEqual(1);
        expect(Math.abs(section.x + section.width - header.x - header.width), selector + ' end at ' + width).toBeLessThanOrEqual(1);
      }
    }
  });

  test('primary buttons still darken on mouse hover', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: 'کالکشن رو ببین' });
    await expect.poll(() => cta.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(34, 34, 34)');
    await cta.hover();
    await expect.poll(() => cta.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(70, 61, 56)');
  });

  test('cart line keeps quantity and actions beside the photo', async ({ page }) => {
    await seed(page);
    await page.goto('/cart');
    // A real line, not the loading skeleton that shares the class until the browser cart hydrates.
    const line = page.locator('.cart-item[data-line]').first();
    await expect(line).toBeVisible();
    const photo = await box(line.locator('.cart-img'));
    const controls = await box(line.locator('.cart-item-controls'));
    // The controls start beside the photo; a taller info column (e.g. a stock note) may push them past its edge.
    expect(controls.y).toBeLessThan(photo.y + photo.height);
    expect((await box(line)).height).toBeLessThan(photo.height + controls.height + 32);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap leaves no hover tint on the pay button that replaces "continue" under the finger', async ({ page }) => {
    await seed(page);
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
    await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
    await expect(page.getByRole('heading', { name: 'بازبینی و پرداخت' })).toBeVisible();
    const pay = page.getByRole('button', { name: /^پرداخت/ });
    await expect.poll(() => pay.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(34, 34, 34)');
  });

  test('filter sheet title keeps one line with the drag handle on its own row', async ({ page }) => {
    await page.goto('/shop');
    await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
    const sheet = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
    await expect(sheet).toBeVisible();
    await settled(sheet);
    const title = await box(sheet.locator('.sheet-title'));
    const handle = await box(sheet.locator('.sheet-handle'));
    const lineHeight = await sheet.locator('.sheet-title').evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
    expect(title.height).toBeLessThan(lineHeight * 1.5);
    expect(handle.y + handle.height).toBeLessThanOrEqual(title.y + 1);
  });

  test('product cards keep the price under the title and a discounted price on one line', async ({ page }) => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/shop');
      const card = page.locator('.product-card', { hasText: 'شومیز لینن آوید' }).first();
      const title = await box(card.locator('.product-title'));
      const price = await box(card.locator('.price-line'));
      expect(price.y - title.y - title.height, 'title to price gap at ' + width).toBeLessThanOrEqual(8);
      const strong = await box(card.locator('.price-line strong'));
      const was = await box(card.locator('.price-line del'));
      expect(Math.abs(was.y + was.height / 2 - strong.y - strong.height / 2), 'one price row at ' + width).toBeLessThan(8);
      // The struck price drops its visible currency but still names it for screen readers.
      await expect(card.locator('.price-line del')).toContainText('تومان');
      await expect(card.locator('.price-line del .currency')).toHaveCount(0);
      const heart = await box(card.getByRole('button', { name: /علاقه‌مندی‌ها/ }));
      expect(Math.min(heart.width, heart.height)).toBeGreaterThanOrEqual(44);
    }
  });

  test('product gallery runs edge to edge without letterbox bands and stays compact', async ({ page }) => {
    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/product/shomiz-01');
      const slide = await box(page.locator('.pdp-slide').first());
      expect(Math.round(slide.x)).toBe(0);
      expect(Math.round(slide.width)).toBe(width);
      expect(slide.height).toBeLessThan(520);
      const photo = page.locator('.pdp-slide img').first();
      await expect(photo).toHaveCSS('object-fit', 'cover');
      const img = await box(photo);
      expect(Math.round(img.width)).toBe(width);
    }
  });

  test('search wording keeps quotes around the query instead of spreading it across flex gaps', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'جستجوی محصولات' }).first().click();
    const field = page.getByRole('combobox', { name: 'عبارت جستجو' });
    await field.fill('مانتو');
    const all = page.getByRole('link', { name: 'نمایش نتایج «مانتو»' });
    await expect(all).toBeVisible();
    await expect(all.locator(':scope > span')).toHaveCount(1);
    await expect(all.locator(':scope > span')).toHaveText('نمایش نتایج «مانتو»');
    await field.fill('zzqq');
    const message = page.locator('.search-message');
    await expect(message).toBeVisible();
    await expect(message.locator(':scope > span')).toHaveCount(1);
    await expect(message.locator(':scope > span')).toContainText('پیشنهادی برای «zzqq» پیدا نشد.');
    const lineHeight = await message.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
    const quoted = await box(message.locator('[dir="auto"]'));
    const sentence = await box(message.locator(':scope > span'));
    // The query sits inside the sentence's first line, not on a line or column of its own.
    expect(quoted.y - sentence.y).toBeLessThan(lineHeight / 2);
  });
});
