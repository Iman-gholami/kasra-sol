import { expect, test, type Locator, type Page } from '@playwright/test';

// What a customer does on an iPhone: taps, not clicks, in WebKit.

async function chooseVariant(page: Page) {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ کرم' }).tap();
  await page.getByRole('button', { name: 'سایز M' }).tap();
}

// Visible and, once it has slid in, resting on the bottom edge of the screen.
async function expectOnScreen(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize()!;
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return box && box.height > 100 && box.y >= 0 ? Math.round(box.y + box.height) : -1;
  }).toBe(viewport.height);
}

test('adding to the cart from the buy button shows the confirmation sheet', async ({ page }) => {
  await chooseVariant(page);
  await page.locator('.buy-panel').getByRole('button', { name: 'افزودن به سبد خرید' }).tap();
  const added = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expectOnScreen(page, added);
  await expect(added).toContainText('شومیز');
  await added.getByRole('button', { name: 'ادامه خرید' }).tap();
  await expect(added).toBeHidden();
});

test('adding to the cart from the bottom bar shows the confirmation sheet', async ({ page }) => {
  await chooseVariant(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const bar = page.locator('.pdp-sticky-bar');
  await expect(bar).toHaveClass(/is-visible/);
  await bar.getByRole('button', { name: 'افزودن به سبد خرید از نوار پایین' }).tap();
  const added = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expectOnScreen(page, added);
  await added.getByRole('link', { name: 'مشاهده سبد خرید' }).tap();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: 'شومیز' }).first()).toBeVisible();
});
