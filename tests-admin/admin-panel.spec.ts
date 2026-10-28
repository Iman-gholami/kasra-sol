import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accounts, API, overflowing, PNG, SCREENSHOTS, signIn, visitorAddress, watchConsole } from './helpers';

// Real back office: Fastify + PostgreSQL behind the Next.js proxy. Tests run in order and share records.
const PRODUCT = 'e2e-linen-manto';
const PRODUCT_NAME = 'مانتو کتان آزمایشی';
// Scrolled to the top first (instantly: the site uses smooth scrolling), or full-page captures draw
// sticky and fixed parts in the middle of the page.
async function shot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: join(SCREENSHOTS, 'admin-' + name + '.png'), fullPage: true });
}

async function accessibilityViolations(page: Page, scope: string) {
  const scan = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa']).analyze();
  return scan.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '));
}

async function openTab(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'بخش‌های مدیریت' }).getByRole('button', { name: label }).click();
}
async function customerOrder(browser: Browser, payment: 'cod' | 'online') {
  const context = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': visitorAddress() } });
  const page = await context.newPage();
  await page.goto('/product/' + PRODUCT);
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT_NAME })).toBeVisible();
  await page.getByRole('button', { name: 'رنگ مشکی' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' })).toBeVisible();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
  if (payment === 'cod') await page.getByRole('radio', { name: /پیک همان‌روز/ }).check();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  if (payment === 'cod') {
    await page.getByRole('radio', { name: /پرداخت در محل/ }).check();
    await page.getByRole('button', { name: 'ثبت نهایی سفارش' }).click();
  } else await page.getByRole('button', { name: 'ثبت سفارش در انتظار پرداخت' }).click();
  await expect(page).toHaveURL(/order-confirmation/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(payment === 'cod'
    ? 'سفارش با پرداخت در محل ثبت شد' : 'سفارش در انتظار پرداخت ثبت شد');
  await context.close();
}

test('owner dashboard: private chrome, live metrics, accessible and free of console errors', async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, accounts().owner);
  await expect(page.getByRole('heading', { level: 1, name: 'داشبورد فروشگاه' })).toBeVisible();
  await expect(page.locator('.site-header, .footer, .bottom-nav, .announcement')).toHaveCount(0);
  await expect(page.getByTestId('products-active')).toContainText('۳۶');
  await expect(page.getByTestId('low-stock-count')).toContainText('ترکیب کم‌موجود');
  await expect(page.getByTestId('orders-month')).toContainText(/سفارش‌های \S+ ۱۴[۰-۹]{2}/);
  await expect(page.getByText('هیچ عددی در این صفحه درآمد قطعی نیست', { exact: false })).toBeVisible();
  const scan = await new AxeBuilder({ page }).include('.admin-app').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(scan.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '))).toEqual([]);
  await shot(page, 'dashboard-desktop');
  expect(problems).toEqual([]);
});

test('owner creates a draft with photos, publishes it, and it reaches the storefront', async ({ page }) => {
  const problems = watchConsole(page);
  page.on('dialog', dialog => void dialog.accept());
  await signIn(page, accounts().owner);
  await openTab(page, 'محصولات و موجودی');
  await page.getByRole('button', { name: 'افزودن محصول' }).click();
  await expect(page.getByRole('heading', { name: 'افزودن محصول جدید' })).toBeFocused();
  await page.getByLabel('شناسه ثابت (لاتین)').fill(PRODUCT);
  await page.getByLabel('آدرس محصول (slug)').fill(PRODUCT);
  await page.getByLabel('نام محصول').fill(PRODUCT_NAME);
  await page.getByLabel('دسته‌بندی').selectOption('manto');
  await page.getByLabel('قیمت فروش (تومان)').fill('۱۲۵۰۰۰۰');
  await page.getByLabel('قیمت قبل از تخفیف (اختیاری)').fill('1490000');
  await page.getByLabel('توضیحات محصول').fill('مانتو کتان سبک برای استفاده روزانه با دوخت تمیز');
  await page.getByLabel('جنس پارچه').fill('کتان');
  await page.getByLabel('فرم لباس').fill('آزاد');
  await page.getByLabel('راهنمای نگهداری').fill('شست‌وشو با آب سرد');
  await page.getByLabel('سایزها، جداشده با ویرگول').fill('M، L');
  await page.getByLabel('مشکی / M').fill('5');
  await page.getByLabel('مشکی / L').fill('2');
  const upload = page.getByLabel(/انتخاب تصویر/);
  await upload.setInputFiles([{ name: 'front.png', mimeType: 'image/png', buffer: PNG },
    { name: 'back.png', mimeType: 'image/png', buffer: PNG }]);
  await expect(page.getByText('۲ تصویر بارگذاری شد', { exact: false })).toBeVisible();
  await expect(page.locator('.admin-gallery-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'انتقال تصویر ۲ به جلو' }).click();
  await shot(page, 'product-editor-desktop');
  await page.getByRole('button', { name: 'ایجاد پیش‌نویس محصول' }).click();

  await expect(page.getByRole('heading', { name: /فهرست محصولات/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  const row = page.getByRole('row', { name: new RegExp(PRODUCT_NAME) });
  await expect(row.getByText('پیش‌نویس')).toBeVisible();
  const repeatedSearch = page.waitForResponse(response => response.url().includes('/api/admin/products?') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  expect((await repeatedSearch).status()).toBe(200);
  await row.getByRole('button', { name: 'انتشار ' + PRODUCT_NAME }).click();
  await expect(page.getByRole('row', { name: new RegExp(PRODUCT_NAME) }).getByText('منتشرشده')).toBeVisible();
  await shot(page, 'products-desktop');

  const storefront = await page.context().browser()!.newPage();
  await storefront.goto('/product/' + PRODUCT);
  await expect(storefront.getByRole('heading', { level: 1, name: PRODUCT_NAME })).toBeVisible();
  await expect(storefront.locator('.detail-price')).toContainText('۱٬۲۵۰٬۰۰۰');
  await storefront.goto('/');
  await expect(storefront.locator('.shop-color-result-summary')).toContainText(/محصول در کاتالوگ$/);
  await storefront.close();
  expect(problems).toEqual([]);
});

test('a COD order placed on the storefront is fulfilled step by step with history', async ({ page, browser }) => {
  await customerOrder(browser, 'cod');
  page.on('dialog', dialog => void dialog.accept());
  await signIn(page, accounts().manager);
  await expect(page.getByRole('navigation', { name: 'بخش‌های مدیریت' }).getByRole('button', { name: /سفارش‌ها/ }))
    .toContainText('۱ سفارش جدید در انتظار رسیدگی');
  await openTab(page, 'سفارش‌ها');
  await page.getByRole('button', { name: /جزئیات سفارش/ }).first().click();
  const detail = page.getByTestId('order-detail');
  await expect(detail).toContainText('مهمان نمایشی');
  await expect(detail).toContainText(PRODUCT_NAME);
  await expect(detail).toContainText('پرداخت هنگام تحویل');
  for (const [action, state] of [['شروع آماده‌سازی', 'در حال آماده‌سازی'], ['ثبت ارسال', 'ارسال‌شده'], ['ثبت تحویل به مشتری', 'تحویل‌شده']]) {
    await detail.getByRole('button', { name: action }).click();
    await expect(detail.getByRole('status').filter({ hasText: 'وضعیت سفارش به «' + state + '» تغییر کرد' })).toBeVisible();
  }
  await expect(detail.locator('.admin-timeline li')).toHaveCount(4);
  await expect(detail).toContainText('دریافت وجه ثبت نشده');
  await expect(detail.getByRole('button', { name: 'لغو سفارش' })).toHaveCount(0);
  await shot(page, 'order-detail-desktop');

  await openTab(page, 'محصولات و موجودی');
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await page.getByRole('button', { name: 'موجودی رنگ و سایز ' + PRODUCT_NAME }).click();
  await expect(page.locator('.admin-variant-card', { hasText: 'مشکی / M' })).toContainText('موجودی فعلی: ۴');
});

test('an online order stays unpaid: it can be cancelled but never prepared or shipped', async ({ page, browser }) => {
  await customerOrder(browser, 'online');
  page.on('dialog', dialog => void dialog.accept());
  await signIn(page, accounts().owner);
  await openTab(page, 'سفارش‌ها');
  await page.getByLabel('فیلتر وضعیت سفارش').selectOption('pending_payment');
  const row = page.getByRole('row').filter({ hasText: 'در انتظار پرداخت' }).first();
  await expect(row).toContainText('پرداخت‌نشده');
  await row.getByRole('button', { name: /جزئیات سفارش/ }).click();
  const detail = page.getByTestId('order-detail');
  await expect(detail).toContainText('هنوز پرداخت نشده است');
  for (const forbidden of ['شروع آماده‌سازی', 'ثبت ارسال', 'ثبت تحویل به مشتری'])
    await expect(detail.getByRole('button', { name: forbidden })).toHaveCount(0);
  const forced = await page.evaluate(async () => {
    const id = document.querySelector('[data-testid="order-detail"] .admin-mono')!.textContent!;
    const response = await fetch('/api/admin/orders/' + id + '/status', { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'preparing' }) });
    return response.status;
  });
  expect(forced, 'the API refuses to prepare an unpaid online order').toBe(409);
  await detail.getByRole('button', { name: 'لغو سفارش' }).click();
  await expect(detail.getByRole('status').filter({ hasText: 'لغوشده' })).toBeVisible();
});

test('staff: least privilege in the menu and on every API call', async ({ page }) => {
  await signIn(page, accounts().staff);
  const nav = page.getByRole('navigation', { name: 'بخش‌های مدیریت' });
  await expect(nav.getByRole('button')).toHaveText(['صندوق فروش', 'محصولات و موجودی', 'سفارش‌ها', 'حساب من']);
  // Shop staff open the panel on the counter; receiving goods and discounts need an owner's grant.
  await expect(page.getByRole('heading', { level: 1, name: 'صندوق فروش حضوری' })).toBeVisible();
  await expect(page.getByLabel('تخفیف (تومان)')).toHaveCount(0);
  await openTab(page, 'محصولات و موجودی');
  await expect(page.getByRole('heading', { name: /فهرست محصولات/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /قیمت فروش/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^ویرایش / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(انتشار|آرشیو) / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'افزودن محصول' })).toHaveCount(0);
  await shot(page, 'staff-products-desktop');
  const statuses = await page.evaluate(async () => {
    const call = async (path: string, method = 'GET', body?: unknown) => (await fetch('/api/admin/' + path, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined
    })).status;
    return [
      await call('staff'), await call('audit'), await call('reports/overview'),
      await call('products/manto-01/price', 'PATCH', { price: 1 }),
      await call('products/manto-01/visibility', 'PATCH', { active: false }),
      await call('staff', 'POST', { username: 'sneaky_e2e', displayName: 'نفوذی', password: 'p'.repeat(16), role: 'manager' }),
      await call('orders/export'),
      await call('stock-receipts', 'POST', { clientRef: crypto.randomUUID(),
        lines: [{ productId: 'manto-01', colorId: 'black', size: 'M', quantity: 50 }] })
    ];
  });
  expect(statuses).toEqual([403, 403, 403, 403, 403, 403, 403, 403]);
  await openTab(page, 'سفارش‌ها');
  await expect(page.getByRole('heading', { name: 'فهرست سفارش‌ها' })).toBeVisible();
  await expect(page.getByRole('button', { name: /خروجی Excel/ })).toHaveCount(0);
  await page.goto('/admin?tab=staff');
  await expect(page.getByRole('heading', { level: 1, name: 'صندوق فروش حضوری' })).toBeVisible();
});

test('manager: runs the store but cannot administer staff', async ({ page }) => {
  await signIn(page, accounts().manager);
  const nav = page.getByRole('navigation', { name: 'بخش‌های مدیریت' });
  await expect(nav.getByRole('button', { name: 'کارکنان و مجوزها' })).toHaveCount(0);
  await openTab(page, 'محصولات و موجودی');
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  // Typed on a Persian keyboard: a number input would silently drop these digits.
  const price = page.getByRole('textbox', { name: 'قیمت فروش ' + PRODUCT_NAME + ' به تومان' });
  await price.fill('۱۲۰۰۰۰۰');
  await expect(price).toHaveValue('1200000');
  await page.getByRole('row', { name: new RegExp(PRODUCT_NAME) }).getByRole('button', { name: 'ثبت', exact: true }).click();
  await expect(page.getByText('قیمت ذخیره شد.')).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/api/admin/staff')).status)).toBe(403);
});

test('manager picks the home slider products and their order, and the storefront cover follows it', async ({ page, browser }) => {
  const problems = watchConsole(page);
  await signIn(page, accounts().manager);
  await openTab(page, 'اسلایدر صفحه اول');
  await expect(page.getByText('هنوز محصولی انتخاب نشده است', { exact: false })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'جست‌وجوی محصول برای اسلایدر' });
  for (const name of [PRODUCT_NAME, 'تیشرت بیسیک سپید', 'شومیز لینن آوید']) {
    await search.fill(name);
    await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
    await page.getByRole('button', { name: 'افزودن به اسلایدر: ' + name }).click();
    await expect(page.getByRole('button', { name: 'در اسلایدر است: ' + name })).toBeDisabled();
  }
  const order = page.getByRole('list', { name: 'ترتیب اسلایدها' }).locator('.admin-product-name');
  await page.getByRole('button', { name: 'جلوتر بردن شومیز لینن آوید' }).click();
  await page.getByRole('button', { name: 'جلوتر بردن شومیز لینن آوید' }).click();
  await page.getByRole('button', { name: 'حذف تیشرت بیسیک سپید از اسلایدر' }).click();
  await expect(order).toHaveText(['شومیز لینن آوید', PRODUCT_NAME]);
  await expect(page.getByText('تغییرات هنوز ذخیره نشده است.')).toBeVisible();
  // Leaving with unsaved changes asks first; staying keeps them.
  const asked: string[] = [];
  page.on('dialog', dialog => { asked.push(dialog.message()); void dialog.dismiss(); });
  await openTab(page, 'داشبورد');
  expect(asked).toEqual(['ترتیب ذخیره‌نشده اسلایدر از بین می‌رود. ادامه می‌دهید؟']);
  await expect(order).toHaveText(['شومیز لینن آوید', PRODUCT_NAME]);
  page.removeAllListeners('dialog');
  const scan = await new AxeBuilder({ page }).include('.admin-app').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(scan.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '))).toEqual([]);
  await page.getByRole('button', { name: 'ذخیره اسلایدر' }).click();
  await expect(page.getByText('اسلایدر ذخیره شد', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ذخیره اسلایدر' })).toBeDisabled();
  await shot(page, 'home-slider-desktop');
  await page.reload();
  await expect(order).toHaveText(['شومیز لینن آوید', PRODUCT_NAME]);

  const context = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': visitorAddress() }, reducedMotion: 'reduce' });
  const home = await context.newPage();
  await home.goto('/');
  const slides = home.getByRole('region', { name: 'محصولات ویژه' }).locator('.hero-slide');
  await expect(slides.locator('.hero-tag-name')).toHaveText(['شومیز لینن آوید', PRODUCT_NAME]);
  await expect(slides.first()).toHaveAttribute('data-active');
  await expect(slides.first()).toContainText('۱۷٪ تخفیف');
  await context.close();
  expect(problems).toEqual([]);
});

/** Real touch drag through CDP (synthetic DOM TouchEvents never reach pointer handlers the way a finger does). */
async function touchDrag(page: Page, x: number, y: number, dx: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 10, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

// The demo storefront shows one still cover, so the rotating slider is only exercised here, with the API connected.
test('the storefront cover rotates the picked products, pauses, and follows its slide buttons and swipes', async ({ browser, request }) => {
  // As the owner, through the API: show three products, then restore the pick the previous test saved.
  const headers = { 'X-Forwarded-For': visitorAddress() };
  const login = await request.post(API + '/v1/admin/auth/login', { data: accounts().owner, headers });
  expect(login.status()).toBe(200);
  const auth = { ...headers, Authorization: 'Bearer ' + (await login.json() as { token: string }).token };
  const saved = (await (await request.get(API + '/v1/admin/home-slider', { headers: auth })).json() as { items: { id: string }[] })
    .items.map(item => item.id);
  const pick = (productIds: string[]) => request.put(API + '/v1/admin/home-slider', { headers: auth, data: { productIds } });
  expect((await pick(['shomiz-01', 'manto-01', 'tshirt-01'])).status()).toBe(200);
  const names = ['شومیز لینن آوید', 'مانتو کتی سارا', 'تیشرت بیسیک سپید'];
  const open = async (options: Parameters<Browser['newContext']>[0] = {}) => {
    const context = await browser.newContext({ ...options, extraHTTPHeaders: { 'X-Forwarded-For': visitorAddress() } });
    const page = await context.newPage();
    await page.goto('/');
    const cover = page.getByRole('region', { name: 'محصولات ویژه' });
    return { context, page, cover, active: cover.locator('.hero-slide[data-active] .hero-tag-name') };
  };
  try {
    // Moves on by itself; the pause button (WCAG 2.2.2) holds it; a slide button jumps.
    const moving = await open();
    await expect(moving.cover.locator('.hero-slide')).toHaveCount(3);
    await expect(moving.active).toHaveText(names[0]);
    await expect(moving.cover.locator('.hero-slide').nth(1)).toHaveAttribute('inert');
    await expect(moving.active).toHaveText(names[1], { timeout: 8000 });
    await moving.page.getByRole('button', { name: 'توقف خودکار اسلایدها' }).click();
    // Focus and hover inside also hold the slider; leave both so only the pause button keeps it still.
    await moving.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await moving.page.mouse.move(2, 2);
    await moving.page.waitForTimeout(6000);
    await expect(moving.active).toHaveText(names[1]);
    await expect(moving.page.getByRole('button', { name: 'پخش خودکار اسلایدها' })).toBeVisible();
    const third = moving.page.getByRole('button', { name: 'اسلاید ۳ از ۳' });
    await third.click();
    await expect(third).toHaveAttribute('aria-current', 'true');
    await expect(moving.active).toHaveText(names[2]);
    await moving.context.close();

    // Reduced motion: never moves by itself and has no pause control, but the slide buttons work.
    const still = await open({ reducedMotion: 'reduce' });
    await expect(still.active).toHaveText(names[0]);
    await expect(still.page.getByRole('button', { name: 'توقف خودکار اسلایدها' })).toHaveCount(0);
    await still.page.waitForTimeout(6000);
    await expect(still.active).toHaveText(names[0]);
    await still.page.getByRole('button', { name: 'اسلاید ۲ از ۳' }).click();
    await expect(still.active).toHaveText(names[1]);
    await still.context.close();

    // Touch, RTL: a swipe to the right shows the next slide, to the left the previous one.
    const touch = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await expect(touch.active).toHaveText(names[0]);
    await touch.page.getByRole('button', { name: 'اسلاید ۱ از ۳' }).tap(); // hydrate first
    const box = (await touch.cover.locator('.hero-slides').boundingBox())!;
    await touchDrag(touch.page, box.x + 60, box.y + box.height * 0.6, 200);
    await expect(touch.active).toHaveText(names[1]);
    await touchDrag(touch.page, box.x + box.width - 60, box.y + box.height * 0.6, -200);
    await expect(touch.active).toHaveText(names[0]);
    expect(await touch.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await touch.context.close();
  } finally {
    expect((await pick(saved)).status()).toBe(200);
  }
});

const COUNTER_PRODUCT = 'e2e-counter-tee';
const COUNTER_NAME = 'تیشرت صندوق آزمایشی';
const persianDigits = (value: string) => value.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
test('goods arrive with barcode labels, the counter sells them by scan, and the website stock follows', async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const problems = watchConsole(page);
  const headers = { 'X-Forwarded-For': visitorAddress() };
  const owner = await (await request.post(API + '/v1/admin/auth/login', { data: accounts().owner, headers })).json() as { token: string };
  const auth = { ...headers, Authorization: 'Bearer ' + owner.token };
  const image = await (await request.post(API + '/v1/admin/media', { headers: { ...auth, 'Content-Type': 'image/png' }, data: PNG }))
    .json() as { url: string };
  expect((await request.post(API + '/v1/admin/products', { headers: auth, data: {
    id: COUNTER_PRODUCT, slug: COUNTER_PRODUCT, name: COUNTER_NAME, category: 'tshirt', description: 'تیشرت پنبه‌ای برای آزمون صندوق',
    price: 640_000, compareAt: null, images: [image.url], colors: [{ id: 'white', name: 'سفید', hex: '#ffffff' }], sizes: ['S', 'M'],
    variants: [{ colorId: 'white', size: 'S', stock: 0 }, { colorId: 'white', size: 'M', stock: 0 }],
    material: 'پنبه', fit: 'آزاد', care: 'شست‌وشو با آب سرد', featured: false } })).status()).toBe(201);
  expect((await request.patch(API + '/v1/admin/products/' + COUNTER_PRODUCT + '/visibility', { headers: auth,
    data: { active: true } })).status()).toBe(200);
  const websiteStock = async (size: string) => ((await (await request.get(API + '/v1/products/' + COUNTER_PRODUCT)).json()) as
    { variants: { size: string; stock: number }[] }).variants.find(variant => variant.size === size)!.stock;

  // The manager receives three medium shirts and prints one label per unit.
  page.on('dialog', dialog => void dialog.accept());
  await signIn(page, accounts().manager);
  await openTab(page, 'ورود کالا و برچسب');
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول برای رسید' }).fill(COUNTER_PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await page.getByRole('button', { name: 'انتخاب ' + COUNTER_NAME }).click();
  await page.getByLabel('تعداد رسیده سفید سایز M').fill('۳');
  await page.getByRole('button', { name: 'افزودن به رسید' }).click();
  await page.getByRole('button', { name: 'ثبت رسید و افزودن به موجودی' }).click();
  await expect(page.getByText(/ثبت شد و ۳ عدد به موجودی اضافه شد/)).toBeVisible();
  expect(await websiteStock('M')).toBe(3);
  expect(await accessibilityViolations(page, '.admin-app')).toEqual([]);
  await shot(page, 'receiving-desktop');
  const [labels] = await Promise.all([page.context().waitForEvent('page'),
    page.getByRole('link', { name: /چاپ ۳ برچسب این رسید/ }).click()]);
  await expect(labels.locator('.label')).toHaveCount(3);
  const code = (await labels.locator('.label-code').first().textContent())!.trim();
  expect(code).toMatch(/^20\d{11}$/);
  await expect(labels.locator('.label').first()).toContainText('۶۴۰٬۰۰۰ تومان');
  expect(await accessibilityViolations(labels, '.label-tools')).toEqual([]);
  await shot(labels, 'labels-desktop');
  // The print holds labels only, one 50 × 25 mm page each (the size of the shop's current stickers).
  await labels.emulateMedia({ media: 'print' });
  await expect(labels.locator('.label-tools')).toBeHidden();
  const pdf = (await labels.pdf({ preferCSSPageSize: true })).toString('latin1');
  expect(pdf.match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(3);
  // Points; Chromium rounds the page to whole CSS pixels.
  const [width, height] = pdf.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/)!.slice(1).map(Number);
  expect(Math.abs(width - 50 / 25.4 * 72)).toBeLessThan(1);
  expect(Math.abs(height - 25 / 25.4 * 72)).toBeLessThan(1);
  await labels.close();

  // Staff sell two at the counter; the scanner types Persian digits on a Persian keyboard layout.
  const counterContext = await browser.newContext();
  const counter = await counterContext.newPage();
  const counterProblems = watchConsole(counter);
  await signIn(counter, accounts().staff);
  await expect(counter.getByRole('heading', { level: 1, name: 'صندوق فروش حضوری' })).toBeVisible();
  const scan = counter.getByLabel('اسکن بارکد کالا');
  await scan.fill(persianDigits(code));
  await scan.press('Enter');
  await scan.fill(code);
  await scan.press('Enter');
  await expect(counter.getByRole('status').filter({ hasText: 'یک عدد دیگر اضافه شد' })).toBeVisible();
  await expect(counter.getByLabel('تعداد ' + COUNTER_NAME)).toHaveText('۲');
  await scan.fill(code.slice(0, 12) + String((Number(code[12]) + 1) % 10));
  await scan.press('Enter');
  await expect(counter.getByRole('alert').filter({ hasText: 'رقم کنترل' })).toBeVisible();
  // The customer goes back to the fitting room: the cart is held and the counter serves the next customer meanwhile.
  await counter.getByLabel('یادداشت (اختیاری)').fill('خانم تیشرت سفید، اتاق پرو');
  await counter.getByRole('button', { name: 'تعلیق فاکتور (مشتری بعدی)' }).click();
  await expect(counter.getByText('سبد خالی است؛ اولین کالا را اسکن کنید.')).toBeVisible();
  const heldCarts = counter.getByRole('list', { name: 'فاکتورهای معلق' });
  await expect(heldCarts.getByRole('listitem')).toHaveCount(1);
  await expect(heldCarts).toContainText('خانم تیشرت سفید، اتاق پرو');
  await expect(heldCarts).toContainText('۱٬۲۸۰٬۰۰۰ تومان');
  expect(await websiteStock('M')).toBe(3);
  await shot(counter, 'counter-held-desktop');
  await heldCarts.getByRole('button', { name: /^ادامه فاکتور معلق/ }).click();
  await expect(counter.getByLabel('تعداد ' + COUNTER_NAME)).toHaveText('۲');
  await expect(counter.getByLabel('یادداشت (اختیاری)')).toHaveValue('خانم تیشرت سفید، اتاق پرو');
  await expect(counter.getByRole('list', { name: 'فاکتورهای معلق' })).toHaveCount(0);
  await counter.getByRole('radio', { name: 'نقدی' }).check();
  await counter.getByRole('button', { name: 'ثبت فروش و کم کردن از موجودی' }).click();
  await expect(counter.getByText(/فروش شماره .* به مبلغ ۱٬۲۸۰٬۰۰۰ تومان ثبت شد/)).toBeVisible();
  expect(await websiteStock('M')).toBe(1);
  const sale = counter.getByRole('row', { name: new RegExp(COUNTER_NAME) }).first();
  await expect(sale).toContainText('نقدی');
  await expect(sale.getByRole('button', { name: /ابطال/ })).toHaveCount(0);
  expect(await accessibilityViolations(counter, '.admin-app')).toEqual([]);
  await shot(counter, 'counter-desktop');
  // A label of a size with no stock is refused at the scan, with the likely reason.
  const small = await (await request.post(API + '/v1/admin/products/' + COUNTER_PRODUCT + '/barcodes', { headers: auth })).json() as
    { items: { size: string; code: string }[] };
  await scan.fill(small.items.find(item => item.size === 'S')!.code);
  await scan.press('Enter');
  await expect(counter.getByRole('status').filter({ hasText: 'در سیستم موجودی ندارد' })).toBeVisible();
  await counterContext.close();

  // The manager voids it (a returned purchase): both units go back to the website stock.
  await openTab(page, 'صندوق فروش');
  const row = page.getByRole('row', { name: new RegExp(COUNTER_NAME) }).first();
  await row.getByRole('button', { name: /ابطال فروش شماره/ }).click();
  await expect(page.getByText(/باطل شد و ۲ عدد به موجودی برگشت/)).toBeVisible();
  await expect(row).toContainText('باطل‌شده');
  expect(await websiteStock('M')).toBe(3);
  // Labels can be printed again for a whole product, one per unit in stock.
  await openTab(page, 'محصولات و موجودی');
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(COUNTER_PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  const [reprint] = await Promise.all([page.context().waitForEvent('page'),
    page.getByRole('link', { name: 'چاپ برچسب بارکد ' + COUNTER_NAME + ' (در زبانه جدید)' }).click()]);
  await expect(reprint.getByRole('cell', { name: code })).toBeVisible();
  await expect(reprint.locator('.label')).toHaveCount(2);
  await reprint.getByRole('button', { name: 'هر کدام به تعداد موجودی' }).click();
  await expect(reprint.locator('.label')).toHaveCount(3);
  // A label printer with other stickers: any size in millimetres.
  await reprint.getByLabel('نوع برچسب').selectOption('roll-custom');
  await reprint.getByLabel('عرض').fill('۴۰');
  await reprint.getByLabel('ارتفاع').fill('20');
  const custom = (await reprint.locator('.label').first().boundingBox())!;
  expect([Math.round(custom.width / 96 * 25.4), Math.round(custom.height / 96 * 25.4)]).toEqual([40, 20]);
  await reprint.getByLabel('نوع برچسب').selectOption('a4-65');
  await reprint.getByLabel('چند خانه اول برگه خالی بماند؟').fill('۴');
  await expect(reprint.locator('.label-blank')).toHaveCount(4);
  await reprint.close();
  expect([...problems, ...counterProblems]).toEqual([]);
});

test('product editor: unsaved changes are guarded, Back moves between screens, a copy starts as an empty draft', async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, accounts().owner);
  // From a dashboard low-stock row straight to that product in the list.
  await page.getByRole('button', { name: /^نمایش .+ در فهرست محصولات$/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'محصولات و موجودی' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'جست‌وجوی محصول' })).not.toHaveValue('');
  await expect(page).toHaveURL(/tab=products&q=/);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'داشبورد فروشگاه' })).toBeVisible();

  await openTab(page, 'محصولات و موجودی');
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await page.getByRole('button', { name: 'ویرایش ' + PRODUCT_NAME, exact: true }).click();
  await expect(page.getByRole('heading', { name: /ویرایش محصول/ })).toBeFocused();
  await expect(page).toHaveURL(/edit=e2e-linen-manto/);
  await page.getByLabel('نام محصول').fill('نام ذخیره‌نشده');
  let asked = 0;
  page.on('dialog', dialog => { asked++; void dialog.dismiss(); });
  await openTab(page, 'داشبورد');
  await page.getByRole('button', { name: 'انصراف' }).click();
  expect(asked).toBe(2);
  await expect(page.getByLabel('نام محصول')).toHaveValue('نام ذخیره‌نشده');
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => void dialog.accept());
  await page.goBack();
  await expect(page.getByRole('heading', { name: /فهرست محصولات/ })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel('نام محصول')).toHaveValue(PRODUCT_NAME);
  await page.getByRole('button', { name: 'بازگشت به فهرست' }).click();

  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await page.getByRole('button', { name: 'کپی ' + PRODUCT_NAME + ' به‌عنوان محصول جدید' }).click();
  await expect(page.getByRole('heading', { name: 'کپی محصول' })).toBeFocused();
  await expect(page.getByLabel('شناسه ثابت (لاتین)')).toHaveValue(PRODUCT + '-copy');
  await expect(page.getByLabel('نام محصول')).toHaveValue(PRODUCT_NAME + ' (کپی)');
  await expect(page.getByLabel('مشکی / M')).toHaveValue('0');
  await page.getByLabel('مشکی / M').fill('۷');
  // Renaming a color keeps the stock entered for it.
  await page.getByLabel('شناسه لاتین').fill('jet-black');
  await expect(page.getByLabel('مشکی / M')).toHaveValue('7');
  await page.getByRole('button', { name: 'ایجاد پیش‌نویس محصول' }).click();
  await expect(page.getByText('محصول ذخیره شد.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT + '-copy');
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  const copy = page.getByRole('row', { name: new RegExp(PRODUCT_NAME + ' \\(کپی\\)') });
  await expect(copy.getByText('پیش‌نویس')).toBeVisible();
  await expect(copy).toContainText('۷ عدد');
  expect(problems).toEqual([]);
});

test('orders: period filter, Excel export of the filtered list, and a printable order slip', async ({ page }) => {
  await signIn(page, accounts().owner);
  await openTab(page, 'سفارش‌ها');
  await page.getByLabel('فیلتر وضعیت سفارش').selectOption('all');
  await page.getByLabel('بازه زمانی ثبت سفارش').selectOption('today');
  await expect(page.getByRole('row').filter({ hasText: 'مهمان نمایشی' }).first()).toBeVisible();
  const repeatedSearch = page.waitForResponse(response => response.url().includes('/api/admin/orders?') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  expect((await repeatedSearch).status()).toBe(200);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /خروجی Excel/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^kasra-orders-\d{4}-\d{2}-\d{2}\.csv$/);
  const file = readFileSync(await download.path());
  expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = file.toString('utf8');
  expect(csv).toContain('شماره سفارش,شناسه کامل,تاریخ ثبت (تهران)');
  expect(csv).toContain('مهمان نمایشی');
  expect(csv).toContain(PRODUCT_NAME);

  await page.getByRole('button', { name: /جزئیات سفارش/ }).first().click();
  const detail = page.getByTestId('order-detail');
  await expect(detail.getByRole('button', { name: 'چاپ برگه سفارش' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.admin-sidebar')).toBeHidden();
  await expect(detail.getByRole('heading', { name: 'تاریخچه وضعیت' })).toBeHidden();
  await expect(detail.getByRole('button', { name: 'چاپ برگه سفارش' })).toBeHidden();
  await expect(detail.getByRole('heading', { name: 'اقلام سفارش' })).toBeVisible();
  await expect(detail).toContainText('کد پستی');
  await page.emulateMedia({ media: 'screen' });
});

test('traffic statistics: real storefront visits appear in the owner dashboard, bots do not', async ({ page, browser }) => {
  const report = () => page.evaluate(async () => (await fetch('/api/admin/reports/traffic?days=7')).json()) as
    Promise<{ today: { views: number; visitors: number } }>;
  await signIn(page, accounts().owner);
  const before = await report();
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const visit = async (userAgent: string, paths: string[], referer?: string) => {
    const context = await browser.newContext({ userAgent, extraHTTPHeaders: { 'X-Forwarded-For': visitorAddress() } });
    // Look like a person's browser: automated ones (navigator.webdriver) are deliberately not counted.
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const visitor = await context.newPage();
    for (const [i, path] of paths.entries()) {
      const beacon = visitor.waitForResponse(response => response.url().endsWith('/api/analytics/view'));
      await visitor.goto(path, i === 0 && referer ? { referer } : undefined);
      await beacon;
    }
    await context.close();
  };
  await visit(CHROME, ['/', '/product/' + PRODUCT], 'https://www.google.com/search?q=manto');
  await visit(IPHONE, ['/shop', '/product/' + PRODUCT], 'https://l.instagram.com/');
  const after = await report();
  expect(after.today.views - before.today.views).toBe(4);
  expect(after.today.visitors - before.today.visitors).toBe(2);

  await openTab(page, 'آمار بازدید');
  const traffic = page.getByTestId('traffic-overview');
  await expect(traffic.getByTestId('traffic-today-views')).toContainText(new Intl.NumberFormat('fa-IR').format(after.today.views));
  await expect(traffic.getByTestId('traffic-live').locator('.tr-tile-value')).not.toHaveText('۰');
  await expect(traffic.locator('.tr-ranked').first()).toContainText(PRODUCT_NAME);
  await expect(traffic.getByRole('img', { name: /سهم منابع ورود/ })).toHaveAttribute('aria-label', /موتور جست‌وجو/);
  await expect(traffic.getByRole('img', { name: /سهم دستگاه‌ها/ })).toHaveAttribute('aria-label', /موبایل/);
  const chart = traffic.getByRole('group', { name: /نمودار بازدید روزانه/ });
  await chart.focus();
  await page.keyboard.press('End');
  await expect(traffic.locator('.tr-tooltip')).toContainText('بازدید صفحه');
  await traffic.getByRole('button', { name: 'نمایش جدول' }).click();
  await expect(traffic.locator('#tr-daily-table tbody tr')).toHaveCount(7);
  const scan = await new AxeBuilder({ page }).include('[data-testid="traffic-overview"]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(scan.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '))).toEqual([]);
  await shot(page, 'traffic-desktop');
  await traffic.getByRole('button', { name: '۳۰ روز' }).click();
  await expect(traffic.getByRole('heading', { name: /۳۰ روز اخیر/ })).toBeVisible();
  await expect(traffic.locator('#tr-daily-table tbody tr')).toHaveCount(30);
});

test('owner manages an employee: new account, own password change, permission grant, deactivation ends sessions', async ({ page, browser }) => {
  page.on('dialog', dialog => void dialog.accept());
  await signIn(page, accounts().owner);
  await openTab(page, 'کارکنان و مجوزها');
  const temp = { username: 'temp_e2e', password: 'temporary-password-e2e-1' };
  await page.getByLabel('نام کاربری (لاتین)').fill(temp.username);
  await page.getByLabel('نام نمایشی').fill('همکار موقت');
  await page.getByLabel('رمز عبور اولیه (حداقل ۱۲ نویسه)').fill(temp.password);
  await page.getByRole('button', { name: 'ساخت حساب مستقل' }).click();
  await expect(page.getByText('حساب «همکار موقت» ساخته شد', { exact: false })).toBeVisible();
  await shot(page, 'staff-desktop');

  const employee = await (await browser.newContext()).newPage();
  await signIn(employee, temp);
  await employee.getByRole('navigation', { name: 'بخش‌های مدیریت' }).getByRole('button', { name: 'حساب من' }).click();
  const fresh = 'my-own-new-password-e2e';
  await employee.getByLabel('رمز فعلی').fill(temp.password);
  await employee.getByLabel('رمز جدید', { exact: true }).fill(fresh);
  await employee.getByLabel('تکرار رمز جدید').fill(fresh);
  await employee.getByRole('button', { name: 'تغییر رمز عبور' }).click();
  await expect(employee.getByText('رمز عبور تغییر کرد', { exact: false })).toBeVisible();

  const card = page.locator('.admin-member', { hasText: 'همکار موقت' });
  await card.getByText('نمایش و ویرایش مجوزها').click();
  await card.getByRole('checkbox', { name: /تغییر قیمت/ }).check();
  await expect(page.locator('.admin-member', { hasText: 'همکار موقت' }).getByRole('checkbox', { name: /تغییر قیمت/ })).toBeChecked();
  await employee.reload();
  await expect(employee).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
  await signIn(employee, { ...temp, password: fresh });
  await page.locator('.admin-member', { hasText: 'همکار موقت' }).getByRole('button', { name: 'غیرفعال‌کردن حساب' }).click();
  await expect(page.locator('.admin-member', { hasText: 'همکار موقت' }).getByText('غیرفعال', { exact: true })).toBeVisible();
  await employee.getByRole('navigation', { name: 'بخش‌های مدیریت' }).getByRole('button', { name: 'سفارش‌ها' }).click();
  await expect(employee).toHaveURL(/\/admin\/login\?expired=1/);
  await openTab(page, 'تاریخچه فعالیت‌ها');
  await expect(page.getByRole('cell', { name: 'تغییر نقش یا دسترسی کارمند' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'تغییر رمز عبور' }).first()).toBeVisible();
  // Details read as Persian sentences and name the employee, and the history narrows to one kind of event.
  await page.getByLabel('نوع رویداد').selectOption('staff');
  const rows = page.locator('.admin-table tbody tr');
  await expect(rows.first()).toContainText('همکار موقت');
  await expect(rows.filter({ hasText: 'دسترسی افزوده: تغییر قیمت' }).first()).toBeVisible();
  await expect(rows.filter({ hasText: 'غیرفعال شد' }).first()).toBeVisible();
  for (const event of await rows.locator('td[data-label="رویداد"]').allTextContents())
    expect(['ایجاد حساب کارمند', 'تغییر نقش یا دسترسی کارمند', 'تعیین رمز جدید برای کارمند']).toContain(event);
});

test('login: generic error, password reveal, logout and private routes', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': visitorAddress() });
  await page.goto('/admin/login');
  await expect(page.locator('.site-header, .footer')).toHaveCount(0);
  await page.getByLabel('نام کاربری').fill(accounts().owner.username);
  const password = page.getByLabel('رمز عبور', { exact: true });
  await password.fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'نمایش رمز' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: /ورود به پنل مدیریت/ }).click();
  await expect(page.locator('.admin-login-error')).toHaveText(/نام کاربری یا رمز عبور درست نیست/);
  await signIn(page, accounts().owner);
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('cross-site requests are refused by the storefront proxies', async ({ request }) => {
  const evil = { Origin: 'https://evil.example' };
  expect((await request.post('/api/admin/login', { headers: evil, data: accounts().owner })).status()).toBe(403);
  expect((await request.post('/api/orders', { headers: { ...evil, 'Idempotency-Key': 'evil-origin-key-0001' }, data: {} })).status()).toBe(403);
  expect((await request.post('/api/admin/staff', { headers: { ...evil, Cookie: 'kasra_admin=' + 'a'.repeat(64) }, data: {} })).status()).toBe(403);
});

test('a committed order with a lost response is retried after reload without duplication', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': visitorAddress() });
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' })).toBeVisible();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  let firstKey: string | undefined;
  let firstId = '';
  await page.route('**/api/orders', async route => {
    firstKey = route.request().headers()['idempotency-key'];
    const committed = await route.fetch();
    expect(committed.status()).toBe(201);
    firstId = (await committed.json()).id;
    await route.abort('connectionfailed');
  }, { times: 1 });
  await page.getByRole('button', { name: 'ثبت سفارش در انتظار پرداخت' }).click();
  await expect(page.locator('.checkout-outcome[role="alert"]')).toBeVisible();
  expect(firstId).not.toBe('');
  await page.reload();
  const response = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'ثبت سفارش در انتظار پرداخت' }).click();
  const retried = await response;
  expect(retried.request().headers()['idempotency-key']).toBe(firstKey);
  expect(retried.status()).toBe(201);
  expect((await retried.json()).id).toBe(firstId);
  await expect(page).toHaveURL(/order-confirmation/);
  expect(await page.evaluate(() => sessionStorage.getItem('kasra-order-attempt-v1'))).toBeNull();
});

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('every admin section fits a 390px phone and tables turn into cards', async ({ page }) => {
    await page.goto('/admin/login');
    expect(await overflowing(page)).toEqual([]);
    await shot(page, 'login-mobile');
    await signIn(page, accounts().owner);
    for (const [label, name] of [['داشبورد', 'dashboard'], ['آمار بازدید', 'traffic'], ['صندوق فروش', 'counter'],
      ['ورود کالا و برچسب', 'receiving'], ['محصولات و موجودی', 'products'], ['اسلایدر صفحه اول', 'home-slider'],
      ['سفارش‌ها', 'orders'], ['کارکنان و مجوزها', 'staff'], ['تاریخچه فعالیت‌ها', 'audit'], ['حساب من', 'account']] as const) {
      await openTab(page, label);
      await expect(page.locator('.admin-loading')).toHaveCount(0);
      expect(await overflowing(page), label).toEqual([]);
      await shot(page, name + '-mobile');
    }
    await openTab(page, 'محصولات و موجودی');
    const firstCell = page.locator('.admin-table-cards tbody tr').first().locator('td').first();
    expect(await firstCell.evaluate(cell => getComputedStyle(cell).display)).toBe('block');
  });
});

test('audit viewport matrix keeps admin sections within the viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, accounts().owner);
  for (const width of [360, 390, 430, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    for (const [label, name] of [['داشبورد', 'dashboard'], ['آمار بازدید', 'traffic'], ['صندوق فروش', 'counter'],
      ['ورود کالا و برچسب', 'receiving'], ['محصولات و موجودی', 'products'], ['اسلایدر صفحه اول', 'home-slider'],
      ['سفارش‌ها', 'orders'], ['کارکنان و مجوزها', 'staff']] as const) {
      await openTab(page, label);
      await expect(page.locator('.admin-loading')).toHaveCount(0);
      expect(await overflowing(page), label + ' at ' + width).toEqual([]);
      if (width === 390 || width === 768 || width === 1440) await shot(page, name + '-audit-' + width);
    }
  }
});

test('owner manages a custom role and cannot remove it while assigned', async ({ page }) => {
  page.on('dialog', dialog => void dialog.accept());
  await signIn(page, accounts().owner);
  await openTab(page, 'کارکنان و مجوزها');
  const roles = page.getByRole('region', { name: 'نقش‌های دلخواه' });
  await roles.getByLabel('نام نقش').fill('مسئول سفارش تست');
  await roles.getByRole('checkbox', { name: /مشاهده سفارش‌ها/ }).check();
  await roles.getByRole('button', { name: 'ایجاد نقش' }).click();
  await expect(roles.getByText('نقش جدید ساخته شد.')).toBeVisible();
  const form = page.getByRole('form', { name: 'ایجاد حساب کارمند' });
  await form.getByLabel('نام کاربری (لاتین)').fill('roles_e2e');
  await form.getByLabel('نام نمایشی').fill('همکار نقش تست');
  await form.getByLabel('رمز عبور اولیه (حداقل ۱۲ نویسه)').fill('test-roles-password-1');
  await expect(form.getByLabel('نقش').getByText('مسئول سفارش تست')).toHaveCount(1);
  await form.getByLabel('نقش').selectOption({ label: 'مسئول سفارش تست' });
  await form.getByRole('button', { name: 'ساخت حساب مستقل' }).click();
  await expect(page.getByText('حساب «همکار نقش تست» ساخته شد', { exact: false })).toBeVisible();
  const member = page.locator('.admin-member').filter({ hasText: 'همکار نقش تست' });
  await expect(member).toBeVisible();
  await roles.getByRole('button', { name: 'حذف نقش مسئول سفارش تست' }).click();
  await expect(roles.getByRole('alert')).toContainText('ابتدا نقش آن حساب‌ها را تغییر دهید');
  await member.getByLabel('نقش').selectOption('staff');
  await expect(roles.locator('.admin-member').filter({ hasText: 'مسئول سفارش تست' })).toContainText('۰ حساب');
  await roles.getByRole('button', { name: 'حذف نقش مسئول سفارش تست' }).click();
  await expect(roles.getByText('نقش «مسئول سفارش تست» حذف شد.')).toBeVisible();
});

test('product photo removal can be undone before saving and persists after saving', async ({ page }) => {
  await signIn(page, accounts().owner);
  await openTab(page, 'محصولات و موجودی');
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await page.getByRole('button', { name: 'ویرایش ' + PRODUCT_NAME, exact: true }).click();
  await expect(page.locator('.admin-gallery-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'حذف تصویر ۲ از محصول' }).click();
  await expect(page.locator('.admin-gallery-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'بازگرداندن تصویر' }).click();
  await expect(page.locator('.admin-gallery-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'حذف تصویر ۲ از محصول' }).click();
  await page.getByRole('button', { name: 'ذخیره تغییرات محصول' }).click();
  await expect(page.getByText('محصول ذخیره شد.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'جست‌وجوی محصول' }).fill(PRODUCT);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await page.getByRole('button', { name: 'ویرایش ' + PRODUCT_NAME, exact: true }).click();
  await expect(page.locator('.admin-gallery-item')).toHaveCount(1);
});
