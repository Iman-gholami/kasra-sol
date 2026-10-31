import { expect, test, type Locator } from '@playwright/test';

// Critical paths on wide screens at 1440×900 (and 1280×720 where the fold matters). The storefront has one phone
// layout, shown on wide screens as a centred column (tests/single-layout.spec.ts); keyboard and mouse use is checked here.
test.use({ viewport: { width: 1440, height: 900 } });
const COLUMN = { left: (1440 - 15 - 480) / 2, width: 480 }; // the column between the page's scrollbar gutter

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
  // The phone's full-screen search, filling the column.
  await settled(dialog);
  const panel = (await dialog.boundingBox())!;
  expect(Math.round(panel.x)).toBe(Math.round(COLUMN.left));
  expect(Math.round(panel.width)).toBe(COLUMN.width);
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

test('filters apply instantly from the filter sheet, Back leaves the filtered list and clear-all resets', async ({ page }) => {
  await page.goto('/shop');
  const open = page.getByRole('button', { name: 'فیلتر محصولات' });
  const sheet = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
  await open.click();
  await sheet.getByRole('radio', { name: 'مشکی' }).check();
  await expect(page).toHaveURL(/color=black/);
  await sheet.getByRole('radio', { name: 'M', exact: true }).check();
  await expect(page).toHaveURL(/size=M/);
  await expect(page).toHaveURL(/color=black/);
  await sheet.getByRole('button', { name: /اعمال فیلترها/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('.active-filter-chip', { hasText: 'مشکی' })).toBeVisible();
  await expect(page.locator('.catalog-count')).not.toContainText('۳۶');
  // The sheet replaces the address while it is open, so its changes are one step of history.
  await page.goBack();
  await expect(page).toHaveURL(/\/shop$/);
  await page.goForward();
  await expect(page).toHaveURL(/color=black/);
  await page.getByRole('link', { name: 'پاک کردن همه' }).first().click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator('.active-filter-chip')).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(12);
});

test('catalog grid is the two balanced columns of the phone layout at 1440 and at 1280', async ({ page }) => {
  await page.goto('/shop');
  // The streamed document briefly holds the loading skeleton's grid too; measure the grid of real cards.
  await expect(page.locator('.catalog-results .product-card').first()).toBeVisible();
  const grid = page.locator('.catalog-results .product-grid').filter({ has: page.locator('.product-card') });
  const columns = () => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await expect.poll(columns).toBe(2);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(columns).toBe(2);
  const titles = await page.locator('.product-title').evaluateAll(els => els.slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height)));
  expect(new Set(titles).size).toBe(1);
});

test('product page: purchase bar in the column at 1280×720, variant + add to cart, confirmation sheet in the column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/product/shomiz-01');
  await expect(page.locator('.pdp-gallery')).toBeInViewport();
  // The phone's purchase bar stays at the bottom of the window, as wide as the column.
  const bar = page.locator('.pdp-sticky-bar');
  await expect(bar).toHaveClass(/is-visible/);
  const barBox = (await bar.boundingBox())!;
  expect(Math.round(barBox.y + barBox.height)).toBe(720);
  expect(Math.round(barBox.width)).toBe(480);
  expect(Math.round(barBox.x)).toBe(Math.round((1280 - 15 - 480) / 2));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزایش تعداد' }).click();
  const add = page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true });
  await add.click();
  await expect(page.locator('.purchase-feedback')).toContainText('به سبد خرید اضافه شد');
  await expect(page.locator('.header-actions [role="status"]')).toHaveText('سبد خرید: ۲ کالا');
  // The confirmation is the phone's bottom sheet, held to the column.
  const added = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expect(added).toContainText('تعداد ۲');
  await settled(added);
  const sheet = (await added.boundingBox())!;
  expect(Math.round(sheet.x)).toBe(Math.round(COLUMN.left));
  expect(Math.round(sheet.width)).toBe(COLUMN.width);
  expect(Math.round(sheet.y + sheet.height)).toBe(900);
  await page.keyboard.press('Escape');
  await expect(added).toBeHidden();
  await expect(add).toBeFocused();
  // The gallery's arrows work with the mouse (wide screens have no swipe).
  await page.locator('.pdp-gallery').getByRole('button', { name: 'تصویر بعدی' }).click();
  await expect(page.locator('.pdp-gallery .pdp-gallery-counter')).toContainText('۲ / ۲');
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
