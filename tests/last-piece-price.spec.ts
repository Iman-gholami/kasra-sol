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

test.describe('listings', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const card = (page: Page, name: string) => page.locator('.product-card').filter({ hasText: name });

  test('a product with some last pieces keeps its price and says so; one with only a last piece shows its price', async ({ page }) => {
    await page.goto('/shop?category=shomiz');
    const some = card(page, 'شومیز ساده ویانا');
    await expect(some.locator('.price-line strong')).toHaveText('۸۰۴٬۰۰۰ تومان');
    await expect(some.locator('.price-line del')).toHaveCount(0);
    await expect(some.locator('.product-deal')).toHaveText('تا ۲۰٪ تخفیف روی رنگ و سایزهای تک‌دونه');
    await expect(some.locator('.discount-tag')).toHaveCount(0);
    const only = card(page, 'شومیز نخی دریا');
    await expect(only.locator('.price-line strong')).toHaveText('۵۷۴٬۰۰۰ تومان');
    await expect(only.locator('.price-line del')).toContainText('۷۱۸٬۰۰۰');
    await expect(only.locator('.discount-tag')).toHaveText('۲۰٪ تخفیف');
    await expect(only.locator('.product-deal')).toHaveCount(0);
  });

  test('the sale filter includes a product whose only discount is a last piece', async ({ page }) => {
    await page.goto('/shop?sale=1&category=shomiz');
    await expect(card(page, 'شومیز ساده ویانا')).toHaveCount(1);
  });
});

test.describe('order confirmation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a placed order keeps the price each line was sold at, then shows that price', async ({ page }) => {
    await seed(page, [L, M]);
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
    await page.getByRole('radio', { name: /پیک همان‌روز/ }).check();
    await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
    await page.getByRole('radio', { name: /پرداخت در محل/ }).check();
    await page.getByRole('button', { name: /^ثبت/ }).click();
    await expect(page).toHaveURL(/order-confirmation/);
    const items = page.locator('.order-card-wide .checkout-lines li');
    await expect(items.filter({ hasText: 'مشکی' }).locator('strong.price')).toHaveText('۶۴۳٬۰۰۰ تومان');
    await expect(items.filter({ hasText: 'سفید' }).locator('strong.price')).toHaveText('۸۰۴٬۰۰۰ تومان');
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kasra-demo-order-v1') ?? 'null'));
    expect(stored.lines.map((line: { unitPrice: number }) => line.unitPrice)).toEqual([643_000, 804_000]);
  });

  test('the confirmation reads the stored unit price, not today’s catalog price', async ({ page }) => {
    // With the API, the demo catalog is not the source of prices: an order placed at 700,000 shows 700,000.
    await page.goto('/');
    await page.evaluate(order => sessionStorage.setItem('kasra-demo-order-v1', JSON.stringify(order)), {
      id: 'KS-123456', items: [L], fields: { name: 'مشتری نمونه', mobile: '09120000000', province: 'تهران', city: 'تهران',
        address: 'خیابان نمونه، پلاک ۱', postal: '1234567890', notes: '' },
      shipping: 'courier', payment: 'cod', code: '',
      totals: { units: 1, subtotal: 700_000, original: 804_000, savings: 104_000, discount: 0, shipping: 0, total: 700_000 },
      lines: [{ item: L, unitPrice: 700_000, product: { id: 'shomiz-06', slug: 'shomiz-06', name: 'شومیز ساده ویانا',
        images: ['/images/lookbook/shomiz-cream.avif'], colors: [{ id: 'black', name: 'مشکی', hex: '#1d1d1f' }] } }]
    });
    await page.goto('/order-confirmation');
    const item = page.locator('.order-card-wide .checkout-lines li');
    await expect(item).toHaveCount(1);
    await expect(item.locator('strong.price')).toHaveText('۷۰۰٬۰۰۰ تومان');
  });
});
