import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Cart and checkout V10: free-shipping progress, stock-aware add, save for later, discount code in the cart,
// two-step checkout (shipping → payment), method restrictions, history and refresh, simulated gateway outcomes,
// and the focused purchase-flow chrome on phones.

type Line = { productId: string; colorId: string; size: string; quantity: number };
const shomiz = (quantity = 1): Line => ({ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity }); // 589,000 · stock 3
const manto: Line = { productId: 'manto-03', colorId: 'sage', size: 'M', quantity: 1 };                      // 1,248,000

/** Seeds once per tab: init scripts run on every navigation, and the flow empties the cart on purpose. */
const seed = (page: Page, cart: Line[]) => page.addInitScript(lines => {
  if (sessionStorage.getItem('kasra-test-seeded')) return;
  sessionStorage.setItem('kasra-test-seeded', '1');
  localStorage.setItem('kasra-demo-v1', JSON.stringify({ cart: lines, wishlist: [] }));
}, cart);

async function toPayment(page: Page) {
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  await expect(page).toHaveURL(/step=payment/);
}

test('cart: free-shipping progress, savings, stock notes and save for later with undo', async ({ page }) => {
  await seed(page, [shomiz(), manto]);
  await page.goto('/cart');
  const summary = page.getByRole('complementary', { name: 'خلاصه سفارش' });
  await expect(page.getByRole('list', { name: 'مراحل خرید' }).getByRole('listitem').first()).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.ship-meter')).toContainText('۶۶۳٬۰۰۰ تومان خرید دیگر');
  await expect(summary).toContainText('سود تو از تخفیف کالاها');
  await expect(summary).toContainText('از ۸۵٬۰۰۰ تومان، در مرحله بعد');
  const line = page.locator('.cart-item', { hasText: 'شومیز لینن آوید' });
  await expect(line).toContainText('از این رنگ و سایز ۳ عدد موجود است');
  const plus = page.getByRole('button', { name: 'افزایش تعداد شومیز لینن آوید' });
  await plus.click();
  await plus.click();
  await expect(plus).toBeDisabled();
  await expect(line).toContainText('همه موجودی این رنگ و سایز در سبد توست');
  await expect(summary).toContainText('رایگان با پست پیشتاز');

  await page.getByRole('button', { name: 'انتقال به علاقه‌مندی‌ها، مانتو کوتاه ژیوا' }).click();
  await expect(page.locator('.cart-removed')).toContainText('به علاقه‌مندی‌ها منتقل شد');
  await expect(page.getByRole('link', { name: 'علاقه‌مندی‌ها، ۱ مورد' })).toBeVisible();
  const undo = page.getByRole('button', { name: 'بازگرداندن' });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(page.locator('.cart-item', { hasText: 'مانتو کوتاه ژیوا' })).toBeVisible();
});

test('product: adding never exceeds stock already in the cart', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزایش تعداد' }).click();
  await page.getByRole('button', { name: 'افزایش تعداد' }).click();
  await expect(page.getByRole('button', { name: 'افزایش تعداد' })).toBeDisabled();
  const add = page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true });
  await add.click();
  const added = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expect(added).toContainText('تعداد ۳');
  await added.getByRole('button', { name: 'ادامه خرید' }).click();
  await expect(page.locator('.stock-note')).toContainText('موجودی نمونه: ۳ عدد، ۳ عدد در سبد خریدت');
  await page.getByRole('button', { name: 'همه موجودی در سبد خریدت', exact: true }).click();
  await expect(page.locator('.purchase-feedback')).toContainText('همه موجودی این رنگ و سایز (۳ عدد) در سبد خریدت است');
  await expect(added).toBeHidden();
});

test('shipping step: free post above the threshold, courier only inside Tehran, fallback is announced', async ({ page }) => {
  await seed(page, [shomiz(3), manto]);
  await page.goto('/checkout');
  const post = page.getByRole('radio', { name: /پست پیشتاز/ });
  const courier = page.getByRole('radio', { name: /پیک همان‌روز/ });
  await expect(post).toBeChecked();
  await expect(page.locator('.choice-card', { has: post })).toContainText('رایگان');
  await page.getByLabel('استان').selectOption('اصفهان');
  await expect(courier).toBeDisabled();
  await expect(courier).toHaveAccessibleDescription(/فقط برای نشانی‌های داخل شهر تهران/);
  await page.getByLabel('استان').selectOption('تهران');
  await page.getByLabel('شهر', { exact: true }).fill('تهران');
  await page.getByLabel('شهر', { exact: true }).blur();
  await courier.check();
  await expect(page.getByRole('complementary', { name: 'خلاصه سفارش' })).toContainText('۱۲۰٬۰۰۰ تومان');
  await page.getByLabel('شهر', { exact: true }).fill('کرج');
  await page.getByLabel('شهر', { exact: true }).blur();
  await expect(page.locator('.choice-notice')).toContainText('روش ارسال به پست پیشتاز تغییر کرد');
  await expect(post).toBeChecked();
});

test('cart discount code: states, Enter applies, removal, and the code carries into the payment total', async ({ page }) => {
  await seed(page, [shomiz()]);
  await page.goto('/cart');
  const code = page.getByLabel('کد تخفیف');
  await code.fill('WELCOME');
  await code.press('Enter');
  await expect(code).toHaveAccessibleDescription(/۹۱۱٬۰۰۰ تومان دیگر/);
  await code.fill('nope');
  await page.getByRole('button', { name: 'ثبت کد' }).click();
  await expect(code).toHaveAttribute('aria-invalid', 'true');
  await expect(code).toHaveAccessibleDescription(/این کد معتبر نیست/);
  await code.fill('kasra ۱۰');
  await code.press('Enter');
  const summary = page.getByRole('complementary', { name: 'خلاصه سفارش' });
  await expect(page.locator('.discount-applied')).toContainText('KASRA10');
  await expect(summary).toContainText('۵۸٬۹۰۰ تومان');
  await expect(summary).toContainText('۵۳۰٬۱۰۰ تومان');
  await page.getByRole('button', { name: 'حذف کد' }).click();
  await expect(page.getByLabel('کد تخفیف')).toBeFocused();
  await expect(summary).not.toContainText('۵۸٬۹۰۰');
  await page.getByLabel('کد تخفیف').fill('KASRA10');
  await page.getByRole('button', { name: 'ثبت کد' }).click();
  await page.getByRole('link', { name: 'ادامه فرایند خرید' }).click();
  await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  await expect(page.locator('.checkout-code-note')).toContainText('KASRA10');
  await expect(page.getByRole('button', { name: /^پرداخت/ })).toHaveText('پرداخت ۶۱۵٬۱۰۰ تومان');
});

test('payment step: review, focus on the step heading, pay-on-delivery only with the courier', async ({ page }) => {
  await seed(page, [shomiz()]);
  await toPayment(page);
  await expect(page.getByRole('heading', { name: 'بازبینی و پرداخت' })).toBeFocused();
  await expect(page.locator('.checkout-review')).toContainText('پست پیشتاز');
  const cod = page.getByRole('radio', { name: /پرداخت در محل/ });
  await expect(cod).toBeDisabled();
  await expect(cod).toHaveAccessibleDescription(/فقط همراه با پیک همان‌روز/);

  await expect(page.getByRole('button', { name: /^پرداخت/ })).toHaveText('پرداخت ۶۷۴٬۰۰۰ تومان');

  await page.getByRole('link', { name: 'تغییر روش ارسال' }).click();
  await expect(page.getByRole('radio', { name: /پست پیشتاز/ })).toBeFocused();
  await page.getByRole('radio', { name: /پیک همان‌روز/ }).check();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  await cod.check();
  await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click();
  await expect(page).toHaveURL(/order-confirmation/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('سفارش آزمایشی ثبت شد');
  await expect(page.locator('.order-done')).toContainText('پرداخت در محل');
});

test('history and refresh: Back returns to shipping with entries kept, refresh keeps the step, bare payment URL falls back', async ({ page }) => {
  await seed(page, [shomiz()]);
  await page.goto('/checkout?step=payment');
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'نشانی و روش ارسال' })).toBeVisible();
  await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  await expect(page).toHaveURL(/step=payment/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'نشانی و روش ارسال' })).toBeFocused();
  await expect(page.getByLabel('نام و نام خانوادگی تحویل‌گیرنده')).toHaveValue('مهمان نمایشی');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'بازبینی و پرداخت' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'بازبینی و پرداخت' })).toBeVisible();
  await expect(page.locator('.checkout-review')).toContainText('مهمان نمایشی');
});

test('gateway: failure and cancel keep the cart for a retry; success shows the order and empties the cart', async ({ page }) => {
  await seed(page, [shomiz()]);
  await toPayment(page);
  const pay = page.getByRole('button', { name: /^پرداخت/ });
  const gateway = page.getByRole('dialog', { name: 'پرداخت سفارش کسری بوتیک' });
  await pay.click();
  await expect(gateway).toContainText('هیچ اطلاعات کارت بانکی نمی‌گیرد');
  await expect(gateway.getByRole('button', { name: 'شبیه‌سازی پرداخت موفق' })).toBeFocused();
  await gateway.getByRole('button', { name: 'شبیه‌سازی پرداخت ناموفق' }).click();
  await expect(gateway).toBeHidden();
  await expect(page.locator('.checkout-outcome[role="alert"]')).toContainText('پرداخت انجام نشد. سبد خریدت محفوظ است');
  await expect(pay).toBeFocused();
  await expect(page.getByRole('link', { name: 'سبد خرید، ۱ کالا' })).toBeVisible();
  await pay.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.checkout-outcome')).toContainText('پرداخت را لغو کردی');
  await pay.click();
  await gateway.getByRole('button', { name: 'شبیه‌سازی پرداخت موفق' }).click();

  await expect(page).toHaveURL(/order-confirmation/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('پرداخت آزمایشی موفق بود');
  const order = page.locator('.order-done');
  await expect(order).toContainText('کد پیگیری آزمایشی');
  await expect(order).toContainText('شومیز لینن آوید');
  await expect(order).toContainText('مهمان نمایشی');
  await expect(order).toContainText('هیچ سفارش واقعی ثبت نشده');
  await expect(page.getByRole('link', { name: 'سبد خرید', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('پرداخت آزمایشی موفق بود');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible();
});

test.describe('phone purchase-flow chrome', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('cart and checkout swap the site header and footer for a back-and-logo header; the floating bar yields to the inline CTA', async ({ page }) => {
    await seed(page, [shomiz(), manto]);
    await page.goto('/cart');
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.footer')).toBeHidden();
    await expect(page.getByRole('link', { name: 'بازگشت به فروشگاه' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'KASRA کسری بوتیک، صفحه اصلی' })).toBeVisible();
    const bar = page.locator('.cart-task-bar');
    await expect(bar).toBeVisible();
    await page.locator('.summary-cta').scrollIntoViewIfNeeded();
    await expect(page.locator('.summary-cta')).toBeInViewport();
    await expect(bar).toBeHidden();
    await page.locator('.summary-cta').click();
    await expect(page.getByRole('link', { name: 'بازگشت به سبد خرید' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'سبد خرید (انجام شد)' })).toBeVisible();
    await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
    await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
    const back = page.getByRole('link', { name: 'بازگشت به اطلاعات ارسال' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByRole('heading', { name: 'نشانی و روش ارسال' })).toBeVisible();
    await page.goto('/order-confirmation');
    await expect(page.locator('.site-header')).toBeVisible();
  });
});

test('desktop keeps the site header and hides the phone flow header', async ({ page }) => {
  await seed(page, [shomiz()]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/cart');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.flow-header')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'سبد خرید' })).toBeVisible();
});

// The shared header/footer wordmarks and the phone bottom navigation already fail axe's label-in-name rule
// before this change (see a11y.spec.ts); they are excluded here so these screens are audited on their own.
const SHARED_LAYOUT = ['.brand', '.footer-wordmark', '.bottom-nav'];
async function audit(page: Page, label: string) {
  const builder = SHARED_LAYOUT.reduce((axe, selector) => axe.exclude(selector), new AxeBuilder({ page }));
  const result = await builder
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const blocking = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map(v => ({ id: v.id, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })), label).toEqual([]);
}

for (const [name, use] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(name, () => {
    test.use(use);
    test('cart, both checkout steps, gateway, confirmation and the added sheet have no serious axe violations', async ({ page }) => {
      test.setTimeout(90_000);
      await seed(page, [shomiz(), manto]);
      await page.goto('/cart');
      await expect(page.locator('.cart-item').first()).toBeVisible();
      await page.getByLabel('کد تخفیف').fill('x');
      await page.getByRole('button', { name: 'ثبت کد' }).click();
      await audit(page, name + ' cart');
      await page.goto('/checkout');
      await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
      await audit(page, name + ' shipping with errors');
      await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
      await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
      await expect(page.getByRole('heading', { name: 'بازبینی و پرداخت' })).toBeVisible();
      await audit(page, name + ' payment');
      await page.getByRole('button', { name: /^پرداخت/ }).click();
      await expect(page.getByRole('dialog', { name: 'پرداخت سفارش کسری بوتیک' })).toBeVisible();
      await audit(page, name + ' gateway');
      await page.getByRole('button', { name: 'شبیه‌سازی پرداخت موفق' }).click();
      await expect(page.locator('.order-done')).toBeVisible();
      await audit(page, name + ' confirmation');
      await page.goto('/product/shomiz-01');
      await page.getByRole('button', { name: 'رنگ کرم' }).click();
      await page.getByRole('button', { name: 'سایز M' }).click();
      await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' })).toBeVisible();
      await audit(page, name + ' added to cart');
    });
  });
}
