import { expect, test, type Page } from '@playwright/test';

// The storefront has one design, the phone's. Wider screens show it as a centred column (like digikalajet.com or
// behtarino.com), so there is no separate desktop layout to build or keep working. See docs/MOBILE-ONLY.md.
const COLUMN = 480;

/** Width of the page's reserved scrollbar gutter (0 with overlay scrollbars): the body fills a window narrower than the
 * column, apart from the gutter. Headless Chromium reserves it without reporting it in clientWidth. */
async function gutter(page: Page) {
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 400, height: viewport.height });
  const width = await page.locator('body').evaluate(el => el.getBoundingClientRect().width);
  await page.setViewportSize(viewport);
  return 400 - width;
}

/** Geometry of the main parts of a page, relative to the storefront column. */
async function layout(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; });
  return page.evaluate(() => {
    const body = document.body.getBoundingClientRect();
    const parts = ['.site-header', '.hero', '.product-grid', '.product-card', '.catalog-toolbar', '.pdp-gallery', '.detail-copy h1',
      '.purchase-panel', '.footer', '.bottom-nav', '.pdp-sticky-bar', 'main p', 'main h1'];
    return Object.fromEntries([['body font', getComputedStyle(document.body).fontSize], ...parts.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return [selector, null];
      const box = element.getBoundingClientRect();
      return [selector, box.width ? [Math.round(box.left - body.left), Math.round(box.width), Math.round(box.height)] : 'hidden'];
    })]);
  });
}

test('wide screens show the storefront as a centred phone-width column on the backdrop', async ({ page }) => {
  for (const width of [768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const free = width - await gutter(page);
    const body = await page.locator('body').evaluate(el => { const box = el.getBoundingClientRect(); return { left: box.left, width: box.width }; });
    expect(body.width, String(width)).toBe(COLUMN);
    // Centred in the window, beside the scrollbar gutter.
    expect(body.left, String(width)).toBeCloseTo((free - COLUMN) / 2, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scrolling').toBeLessThanOrEqual(width);
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(234, 236, 240)');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    // The phone's navigation, not a desktop one.
    await expect(page.getByRole('button', { name: 'باز کردن منو' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'دسته‌بندی‌های اصلی' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'ناوبری پایین صفحه' })).toBeVisible();
  }
});

test('phones are unchanged: the column is the whole screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.locator('body').evaluate(el => el.getBoundingClientRect().width)).toBe(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});

for (const path of ['/', '/shop', '/product/shomiz-01', '/faq']) {
  test('the column on a 1440 screen lays out ' + path + ' exactly like a phone of the same width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const wide = await layout(page, path);
    // A window as wide as the column (plus the scrollbar gutter, which the column sits beside).
    await page.setViewportSize({ width: COLUMN + await gutter(page), height: 900 });
    const phone = await layout(page, path);
    expect(Object.values(wide).filter(Boolean).length).toBeGreaterThan(4);
    expect(wide).toEqual(phone);
  });
}

test('bars and sheets stay inside the column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const left = (1440 - await (async () => { await page.goto('/shop'); return gutter(page); })() - COLUMN) / 2;
  const inColumn = async (selector: string, bottom?: boolean) => {
    const box = (await page.locator(selector).first().boundingBox())!;
    expect(Math.round(box.x), selector).toBe(Math.round(left));
    expect(Math.round(box.width), selector).toBe(COLUMN);
    if (bottom) expect(Math.round(box.y + box.height), selector).toBe(900);
  };
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await inColumn('.bottom-nav', true);

  const settled = (selector: string) => page.locator(selector).evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  await page.getByRole('button', { name: 'فیلتر محصولات' }).first().click();
  await settled('dialog[open]');
  await inColumn('dialog[open]', true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await settled('dialog[open]');
  await inColumn('dialog[open]');
  await page.keyboard.press('Escape');

  await page.goto('/product/shomiz-01');
  await expect(page.locator('.pdp-sticky-bar')).toHaveClass(/is-visible/);
  await inColumn('.pdp-sticky-bar', true);
  await page.getByRole('button', { name: 'راهنمای سایز' }).click();
  await settled('dialog[open]');
  await inColumn('dialog[open]', true);
});

test('the back office keeps the full width of the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  const free = 1440 - await gutter(page);
  expect(await page.locator('body').evaluate(el => el.getBoundingClientRect().width)).toBe(free);
});
