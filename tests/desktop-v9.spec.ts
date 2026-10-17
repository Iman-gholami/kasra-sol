import { expect, test, type Locator } from '@playwright/test';

// V9 desktop critical paths at 1440×900 (and 1280×720 where the fold matters).
test.use({ viewport: { width: 1440, height: 900 } });

/** Overlays scale or slide in; measure their geometry only once the enter transition has finished. */
const settled = (overlay: Locator) => overlay.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));

test('skip link is the first stop and moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'رفتن به محتوای اصلی' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('shop disclosure panel works with keyboard and hover, and marks the current section', async ({ page }) => {
  await page.goto('/category/manto');
  const nav = page.getByRole('navigation', { name: 'دسته‌بندی‌های اصلی' });
  await expect(nav.getByRole('link', { name: 'مانتو' })).toHaveAttribute('aria-current', 'page');
  const toggle = nav.getByRole('button', { name: 'نمایش راهنمای فروشگاه' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const panelLinks = nav.locator('.nav-panel a');
  await expect(panelLinks.first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(panelLinks.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(panelLinks.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  // Colors in the panel are the six real catalog color families and keep the URL contract.
  await toggle.click();
  await nav.getByRole('link', { name: 'مشکی' }).click();
  await expect(page).toHaveURL(/\/shop\?color=black/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // Hover intent: opens after a short delay, closes after the pointer leaves.
  await nav.getByRole('link', { name: 'همه محصولات' }).hover();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(700, 700);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('search: "/" shortcut, arrow-key suggestions with aria-activedescendant, Escape and recent searches', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'جستجو در محصولات کسری' });
  // The document-level shortcut listener attaches on hydration (keys are not replayed like clicks),
  // so retry the key until the client is interactive — pressing only while the overlay is closed.
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.keyboard.press('/');
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  const input = dialog.getByRole('combobox', { name: 'عبارت جستجو' });
  await expect(input).toBeFocused();
  // Anchored under the header rather than floating mid-page.
  await settled(dialog);
  const header = (await page.locator('.site-header').boundingBox())!;
  const panel = (await dialog.boundingBox())!;
  expect(panel.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(panel.y).toBeLessThan(header.y + header.height + 24);
  await input.fill('مانتو');
  await expect(dialog.getByRole('option').first()).toBeVisible();
  const options = dialog.getByRole('option');
  const count = await options.count();
  await input.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await expect(input).toHaveAttribute('aria-activedescendant', (await options.first().getAttribute('id'))!);
  await input.press('ArrowUp');
  await expect(options.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
  // First Escape clears the query, the second closes and returns focus to the trigger.
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'جستجوی محصولات' })).toBeFocused();
  // Submitting stores a recent search (browser only) that the next session offers.
  await page.getByRole('button', { name: 'جستجوی محصولات' }).click();
  await input.fill('لینن');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=/);
  await page.getByRole('button', { name: 'جستجوی محصولات' }).click();
  await expect(dialog.getByRole('heading', { name: 'جستجوهای اخیر' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'لینن' })).toBeVisible();
});

test('desktop filters apply instantly, Back undoes a filter and clear-all resets', async ({ page }) => {
  await page.goto('/shop');
  const sidebar = page.getByRole('complementary', { name: 'فیلتر محصولات' });
  await sidebar.getByRole('radio', { name: 'مشکی' }).check();
  await expect(page).toHaveURL(/color=black/);
  await expect(page.locator('.active-filter-chip', { hasText: 'مشکی' })).toBeVisible();
  await sidebar.getByRole('radio', { name: 'M', exact: true }).check();
  await expect(page).toHaveURL(/size=M/);
  await expect(page).toHaveURL(/color=black/);
  await expect(page.locator('.catalog-count')).not.toContainText('۳۶');
  await page.goBack();
  await expect(page).not.toHaveURL(/size=M/);
  await expect(page).toHaveURL(/color=black/);
  await expect(sidebar.getByRole('radio', { name: 'مشکی' })).toBeChecked();
  await page.getByRole('link', { name: 'پاک کردن همه' }).first().click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(sidebar.getByRole('radio', { name: 'همه' }).last()).toBeChecked();
  await expect(page.locator('.product-card')).toHaveCount(12);
});

test('catalog grid is four balanced columns at 1440 and three at 1280', async ({ page }) => {
  await page.goto('/shop');
  // The streamed document briefly holds the loading skeleton's grid too; measure the grid of real cards.
  await expect(page.locator('.catalog-results .product-card').first()).toBeVisible();
  const grid = page.locator('.catalog-results .product-grid').filter({ has: page.locator('.product-card') });
  const columns = () => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await expect.poll(columns).toBe(4);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(columns).toBe(3);
  const titles = await page.locator('.product-title').evaluateAll(els => els.slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height)));
  expect(new Set(titles).size).toBe(1);
});

test('product page: CTA above the fold at 1280×720, sticky buy column at 1440×900, variant + add to cart', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/product/shomiz-01');
  const cta = page.getByRole('button', { name: 'رنگ و سایز رو انتخاب کن' });
  const box = (await cta.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(720);
  await expect(page.getByRole('group', { name: 'تصاویر محصول' })).toBeInViewport();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.pdp-buy')).toHaveCSS('position', 'sticky');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزایش تعداد' }).click();
  const add = page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true });
  await add.click();
  await expect(page.locator('.purchase-feedback')).toContainText('به سبد خرید اضافه شد');
  await expect(page.getByRole('link', { name: /سبد خرید، ۲ کالا/ })).toBeVisible();
  await expect(page.locator('.header-actions [role="status"]')).toHaveText('سبد خرید: ۲ کالا');
  // The confirmation opens under the header cart icon (inline end = left in RTL), not over the product.
  const added = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expect(added).toContainText('تعداد ۲');
  await expect.poll(async () => (await added.boundingBox())!.x).toBeLessThan(120);
  expect((await added.boundingBox())!.y).toBeGreaterThan(60);
  await page.keyboard.press('Escape');
  await expect(added).toBeHidden();
  await expect(add).toBeFocused();
  // Thumbnail keyboard control.
  await page.getByRole('button', { name: 'نمایش تصویر ۲' }).click();
  await expect(page.getByRole('button', { name: 'نمایش تصویر ۲' })).toHaveAttribute('aria-pressed', 'true');
});

test('zoom magnifies with click and pans with the keyboard', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: /بزرگ‌نمایی تصویر ۱/ }).click();
  const zoom = page.getByRole('dialog', { name: 'نمای بزرگ محصول' });
  const toggle = zoom.getByRole('button', { name: 'بزرگ‌نمایی بیشتر' });
  await toggle.click();
  const image = zoom.locator('.zoom-image img');
  await expect(image).toHaveCSS('transform', /matrix\(2/);
  const before = await image.evaluate(el => el.style.transformOrigin);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => image.evaluate(el => el.style.transformOrigin)).not.toBe(before);
  await zoom.getByRole('button', { name: 'بازگشت به اندازه عادی' }).click();
  await expect(image).toHaveCSS('transform', /matrix\(1, 0, 0, 1/);
});

test('cart quantity edit and remove with in-place undo keep totals honest', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kasra-demo-v1', JSON.stringify({
    cart: [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }, { productId: 'manto-03', colorId: 'sage', size: 'M', quantity: 1 }],
    wishlist: []
  })));
  await page.goto('/cart');
  const summary = page.getByRole('complementary', { name: 'خلاصه سفارش' });
  await expect(summary).toContainText('قیمت کالاها (۲)');
  await page.getByRole('button', { name: 'افزایش تعداد شومیز لینن آوید' }).click();
  await expect(summary).toContainText('قیمت کالاها (۳)');
  await page.getByRole('button', { name: 'حذف شومیز لینن آوید از سبد' }).click();
  const undo = page.getByRole('button', { name: 'بازگرداندن' });
  await expect(undo).toBeFocused();
  await expect(page.locator('.cart-removed')).toContainText('شومیز لینن آوید');
  await expect(summary).toContainText('قیمت کالاها (۱)');
  await undo.click();
  await expect(page.locator('.cart-item').first()).toContainText('شومیز لینن آوید');
  await expect(page.locator('.cart-item').first().getByRole('link', { name: 'شومیز لینن آوید' })).toBeFocused();
  await expect(summary).toContainText('قیمت کالاها (۳)');
});

test('checkout: inline errors are linked, focus the first problem and Persian digits are accepted', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kasra-demo-v1', JSON.stringify({
    cart: [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }], wishlist: []
  })));
  await page.goto('/checkout');
  const next = page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' });
  await next.click();
  const name = page.getByLabel('نام و نام خانوادگی تحویل‌گیرنده');
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription('نام و نام خانوادگی را کامل وارد کن.');
  await expect(page.locator('.status-message.error')).toContainText('۶ مورد');
  await name.fill('نام نمایشی');
  await expect(name).toHaveAttribute('aria-invalid', 'false');
  const mobile = page.getByLabel('شماره موبایل');
  await mobile.fill('۰۹۱۲ ۳۴۵ ۶۷۸۹');
  await mobile.blur();
  await expect(mobile).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('استان').selectOption('تهران');
  await page.getByLabel('شهر', { exact: true }).fill('تهران');
  await page.getByLabel('نشانی دقیق').fill('خیابان نمونه، کوچه آزمایشی، پلاک ده');
  await page.getByLabel('کد پستی').fill('۱۲۳۴۵-۶۷۸۹۰');
  await next.click();
  await expect(page).toHaveURL(/step=payment/);
  await expect(page.locator('.checkout-review')).toContainText('۰۹۱۲۳۴۵۶۷۸۹');
  await page.getByRole('button', { name: /^پرداخت/ }).click();
  await page.getByRole('button', { name: 'شبیه‌سازی پرداخت موفق' }).click();
  await expect(page).toHaveURL(/order-confirmation/);
  await expect(page.getByText('هیچ سفارش واقعی ثبت نشده', { exact: false })).toBeVisible();
});

test('returning from a product restores the catalog position and filters', async ({ page }) => {
  await page.goto('/shop?color=cream');
  const card = page.locator('.product-card').nth(7);
  await card.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => Math.round(scrollY));
  expect(before).toBeGreaterThan(300);
  await card.locator('.product-link').click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/color=cream/);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(before - 60);
});
