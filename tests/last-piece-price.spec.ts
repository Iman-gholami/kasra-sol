import { expect, test, type Page } from '@playwright/test';

// Last-piece prices per variant in demo mode (the demo setting is on at 20%). shomiz-06 (شومیز ساده ویانا) is 804,000;
// its black L is the demo's one-unit variant, so it sells at 643,000; every other colour and size is 804,000.
type Line = { productId: string; colorId: string; size: string; quantity: number };
const seed = (page: Page, cart: Line[]) => page.addInitScript(lines => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('kasra-demo-v1', JSON.stringify({ cart: lines, wishlist: [] }));
}, cart);
const L = { productId: 'shomiz-06', colorId: 'black', size: 'L', quantity: 1 };
const M = { productId: 'shomiz-06', colorId: 'white', size: 'M', quantity: 1 };

test.describe('cart and checkout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the cart prices each line at its own variant price, and the totals agree', async ({ page }) => {
    await seed(page, [L, M]);
    await page.goto('/cart');
    const lines = page.locator('.cart-item');
    await expect(lines).toHaveCount(2);
    const black = lines.filter({ hasText: 'مشکی' }), white = lines.filter({ hasText: 'سفید' });
    await expect(black.locator('.cart-unit strong.price')).toHaveText('۶۴۳٬۰۰۰ تومان');
    await expect(black.locator('.cart-unit del')).toContainText('۸۰۴٬۰۰۰');
    await expect(white.locator('.cart-unit strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');
    await expect(white.locator('.cart-unit del')).toHaveCount(0);
    await expect(page.locator('.price-rows').first()).toContainText('۱۶۱٬۰۰۰ تومان');
    await expect(page.locator('.task-bar-total strong.price')).toContainText('۱٬۴۴۷٬۰۰۰');

    await page.goto('/checkout');
    // On phones the order summary is a collapsed box at the top: open it, as a shopper would.
    const box = page.locator('details.checkout-summary-mobile');
    await box.locator('summary').click();
    const summary = box.locator('.checkout-lines li');
    await expect(summary.filter({ hasText: 'مشکی' }).locator('strong.price')).toHaveText('۶۴۳٬۰۰۰ تومان');
    await expect(summary.filter({ hasText: 'سفید' }).locator('strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');
    await expect(box.locator('.summary-row').filter({ hasText: 'سود تو از تخفیف کالاها' })).toContainText('۱۶۱٬۰۰۰ تومان');
  });
});

for (const [device, use] of [
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ['desktop', { viewport: { width: 1280, height: 860 } }]
] as const) {
  test.describe('product page, ' + device, () => {
    test.use(use);
    const price = (page: Page) => page.locator('.detail-price');

    test('the price follows the chosen colour and size, and last-piece sizes are marked', async ({ page }) => {
      await page.goto('/product/shomiz-06');
      await expect(price(page).locator('strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');
      await expect(price(page).locator('.detail-deal')).toHaveText('تا ۲۰٪ تخفیف روی رنگ و سایزهای تک‌دونه');
      await page.getByRole('button', { name: 'رنگ مشکی' }).click();
      const large = page.getByRole('button', { name: 'سایز L، با تخفیف آخرین دونه' });
      await expect(large).toContainText('٪');
      await large.click();
      await expect(price(page).locator('strong.price')).toHaveText('۶۴۳٬۰۰۰ تومان');
      await expect(price(page).locator('del')).toContainText('۸۰۴٬۰۰۰');
      await expect(price(page).locator('.sale-badge')).toHaveText('۲۰٪ تخفیف آخرین دونه');
      await expect(price(page).locator('.detail-deal')).toHaveCount(0);
      await expect(page.locator('.pdp-sticky-price strong.price')).toHaveText('۶۴۳٬۰۰۰ تومان');
      await page.getByRole('button', { name: 'سایز XL', exact: true }).click();
      await expect(price(page).locator('strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');
      await expect(price(page).locator('del')).toHaveCount(0);
      await expect(page.locator('.pdp-sticky-price strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');
    });

    test('a link with a colour and size starts with them chosen; a bad or sold-out choice is ignored', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/product/shomiz-06?color=black&size=L');
      await expect(page.getByRole('button', { name: 'رنگ مشکی' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: /^سایز L/ })).toHaveAttribute('aria-pressed', 'true');
      await expect(price(page).locator('strong.price')).toHaveText('۶۴۳٬۰۰۰ تومان');

      await page.goto('/product/shomiz-06?color=nope&size=XXL');
      await expect(page.locator('.swatch[aria-pressed="true"], .size-option[aria-pressed="true"]')).toHaveCount(0);
      await expect(price(page).locator('strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');

      // Black M is sold out: the colour is kept, the size is not.
      await page.goto('/product/shomiz-06?color=black&size=M');
      await expect(page.getByRole('button', { name: 'رنگ مشکی' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.size-option[aria-pressed="true"]')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('a last piece beats a shallower product sale, and a product whose only stock is a last piece shows it at once', async ({ page }) => {
      await page.goto('/product/tshirt-05?color=cream&size=M');
      await expect(price(page).locator('strong.price')).toHaveText('۴۲۴٬۰۰۰ تومان');
      await expect(price(page).locator('del')).toContainText('۵۳۰٬۰۰۰');
      await page.goto('/product/shomiz-04');
      await expect(price(page).locator('strong.price')).toHaveText('۵۷۴٬۰۰۰ تومان');
      await expect(price(page).locator('del')).toContainText('۷۱۸٬۰۰۰');
    });
  });
}
