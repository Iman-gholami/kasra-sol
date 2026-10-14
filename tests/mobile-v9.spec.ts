import { expect, test, type Locator, type Page } from '@playwright/test';

// V9 phone paths with touch emulation (390×844 unless a test says otherwise).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const seed = (page: Page, cart: object[] = [], wishlist: string[] = []) =>
  page.addInitScript(([c, w]) => localStorage.setItem('kasra-demo-v1', JSON.stringify({ cart: c, wishlist: w })), [cart, wishlist] as const);

/** Overlays scale or slide in; measure their geometry only once the enter transition has finished. */
const settled = (overlay: Locator) => overlay.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));

async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('bottom navigation on browsing pages only, never covering content, with Persian badges', async ({ page }) => {
  await seed(page, [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 2 }], ['manto-03']);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'ناوبری پایین صفحه' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'خانه' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'سبد خرید، ۲ کالا' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'علاقه‌مندی‌ها، ۱ مورد' })).toBeVisible();
  // Scrolled to the very end, the last footer line sits above the bar.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const footerBottom = await page.locator('.footer-bottom').evaluate(el => el.getBoundingClientRect().bottom);
  const navTop = await nav.evaluate(el => el.getBoundingClientRect().top);
  expect(footerBottom).toBeLessThanOrEqual(navTop + 1);
  // Search from the thumb zone opens the full-screen overlay with the field focused.
  await nav.getByRole('button', { name: 'جستجو' }).click();
  const search = page.getByRole('dialog', { name: 'جستجو در محصولات کسری' });
  await expect(search.getByRole('combobox')).toBeFocused();
  await settled(search);
  const box = (await search.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(388);
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  await nav.getByRole('link', { name: 'دسته‌ها' }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(nav.getByRole('link', { name: 'دسته‌ها' })).toHaveAttribute('aria-current', 'page');
  for (const route of ['/product/shomiz-01', '/cart', '/checkout']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(nav).toHaveCount(0);
  }
});

test('menu drawer: focus stays inside, swipe toward its edge closes and focus returns', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'باز کردن منو' });
  await trigger.click();
  const drawer = page.locator('#mobile-navigation');
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'منوی موبایل' })).toBeVisible();
  // Native modal dialog: Tab cycles through the drawer (and the browser UI), never the page behind.
  let insideCount = 0;
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => document.activeElement === document.body ? 'browser' :
      document.activeElement?.closest('#mobile-navigation') ? 'drawer' : 'page');
    expect(where).not.toBe('page');
    if (where === 'drawer') insideCount++;
  }
  expect(insideCount).toBeGreaterThan(20);
  await expect.poll(async () => Math.round(((await drawer.boundingBox())!).x)).toBe(390 - Math.round(((await drawer.boundingBox())!).width));
  const box = (await drawer.boundingBox())!;
  // Drawer enters from the inline start (right edge in RTL); dragging toward that edge dismisses it.
  expect(Math.round(box.x + box.width)).toBe(390);
  await touchDrag(page, box.x + 60, box.y + 300, 200, 4);
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('filter bottom sheet shows the live result count, applies behind the sheet and closes by swipe', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  const sheet = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
  await expect(sheet).toBeVisible();
  await expect.poll(async () => { const b = (await sheet.boundingBox())!; return Math.round(b.y + b.height); }).toBe(844);
  const cta = sheet.getByRole('button', { name: /اعمال فیلترها و نمایش/ });
  await expect(cta).toContainText('نمایش ۳۶ کالا');
  await sheet.getByRole('radio', { name: 'مشکی' }).check();
  await expect(page).toHaveURL(/color=black/);
  await expect(cta).not.toContainText('۳۶');
  const label = (await cta.textContent())!;
  const shown = label.match(/[۰-۹]+/)![0];
  await expect(page.locator('.catalog-count strong')).toHaveText(shown);
  // Dragging the header down dismisses the sheet; the filter stays applied.
  const header = (await sheet.locator('.sheet-header').boundingBox())!;
  await touchDrag(page, header.x + header.width / 2, header.y + 20, 0, 260);
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: 'فیلتر محصولات' })).toBeFocused();
  await expect(page.locator('.active-filter-chip', { hasText: 'مشکی' })).toBeVisible();
  // After scrolling past the controls, a floating pill keeps filters one tap away.
  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: 'instant' }));
  const pill = page.getByRole('button', { name: /فیلترها/ });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /اعمال فیلترها/ }).click();
  await expect(sheet).toBeHidden();
});

test('product: purchase bar summarizes the variant, size guide is a bottom sheet, add from the thumb zone', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  const bar = page.locator('.pdp-sticky-bar');
  await expect(bar).toHaveClass(/is-visible/);
  await expect(bar).toContainText('رنگ و سایز انتخاب نشده');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(bar).toContainText('کرم، سایز M');
  await page.getByRole('button', { name: 'راهنمای سایز' }).click();
  const guide = page.getByRole('dialog', { name: 'راهنمای سایز نمونه' });
  await expect(guide).toBeVisible();
  await expect.poll(async () => Math.round(((await guide.boundingBox())!).y + ((await guide.boundingBox())!).height)).toBe(844);
  await expect(bar).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  // Opening the guide scrolled the main button into view; back at the top the bar returns.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(bar).toHaveClass(/is-visible/);
  await bar.getByRole('button', { name: 'افزودن به سبد خرید از نوار پایین' }).click();
  await expect(bar.getByRole('status')).toContainText('به سبد خرید اضافه شد');
  // The bar never hides page content: the page reserves its height at the end.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const footerBottom = await page.locator('.footer-bottom').evaluate(el => el.getBoundingClientRect().bottom);
  const barTop = await bar.evaluate(el => el.getBoundingClientRect().top);
  expect(footerBottom).toBeLessThanOrEqual(barTop + 1);
});

test('cart: large steppers, remove with undo, total and checkout CTA always in the thumb zone', async ({ page }) => {
  await seed(page, [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }, { productId: 'manto-03', colorId: 'sage', size: 'M', quantity: 1 }]);
  await page.goto('/cart');
  const taskBar = page.locator('.cart-task-bar');
  await expect(taskBar).toBeVisible();
  await expect(taskBar.getByRole('link', { name: /ادامه تا تسویه‌حساب/ })).toBeInViewport();
  const plus = page.getByRole('button', { name: 'افزایش تعداد شومیز لینن آوید' });
  const size = (await plus.boundingBox())!;
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(44);
  await plus.click();
  await expect(page.locator('.cart-item').first().locator('.qty-stepper span')).toHaveText('۲');
  const before = await taskBar.locator('strong').textContent();
  await page.getByRole('button', { name: 'حذف مانتو کوتاه ژیوا از سبد' }).click();
  await expect(page.getByRole('button', { name: 'بازگرداندن' })).toBeFocused();
  await expect(taskBar.locator('strong')).not.toHaveText(before!);
  await page.getByRole('button', { name: 'بازگرداندن' }).click();
  await expect(taskBar.locator('strong')).toHaveText(before!);
  await expect(page.locator('.summary-cta')).toBeHidden();
});

test('checkout on a phone: collapsible summary, 16px fields with mobile keyboards, inline errors, demo success', async ({ page }) => {
  await seed(page, [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }]);
  await page.goto('/checkout');
  const summary = page.locator('.checkout-summary-mobile');
  await expect(summary).toContainText('۱ کالا');
  await summary.locator('summary').click();
  await expect(summary).toContainText('شومیز لینن آوید');
  const mobile = page.getByLabel('شماره موبایل');
  await expect(mobile).toHaveAttribute('inputmode', 'tel');
  await expect(mobile).toHaveAttribute('autocomplete', 'tel');
  await expect(page.getByLabel('کد پستی')).toHaveAttribute('inputmode', 'numeric');
  for (const field of await page.locator('.control').all()) {
    expect(parseFloat(await field.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  const submit = page.getByRole('button', { name: 'تأیید نمایشی سفارش' });
  await expect(submit).toBeInViewport();
  await page.getByRole('checkbox').check();
  await submit.click();
  await expect(page.getByLabel('نام و نام خانوادگی')).toBeFocused();
  await page.getByRole('button', { name: 'پر کردن با اطلاعات نمونه' }).click();
  await submit.click();
  await expect(page).toHaveURL(/order-confirmation/);
});

for (const width of [360, 390, 412]) {
  test(`touch targets ≥ 44px, text ≥ 12px and no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await seed(page, [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }], ['manto-03']);
    for (const route of ['/', '/shop', '/shop?category=manto&color=black&sort=newest', '/product/shomiz-01', '/cart', '/checkout', '/wishlist', '/faq', '/size-guide']) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      const report = await page.evaluate(() => {
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[inert],[aria-hidden="true"]');
        };
        const small = [...document.querySelectorAll('a[href],button,select,textarea,input:not([type=hidden]),summary')]
          .filter(visible)
          .filter(el => !(el.tagName === 'A' && el.closest('p') && getComputedStyle(el).display === 'inline'))
          .map(el => {
            const target = (el as HTMLInputElement).type === 'radio' || (el as HTMLInputElement).type === 'checkbox' ? el.closest('label') ?? el : el;
            const r = target.getBoundingClientRect();
            return { el: el.tagName + '.' + (el.getAttribute('class') ?? '') + ' ' + (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
          })
          .filter(t => t.w < 44 || t.h < 44);
        const tiny: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const el = walker.currentNode.parentElement;
          if (!el || !walker.currentNode.textContent?.trim() || !visible(el) || el.closest('.brand,.footer-wordmark')) continue;
          if (parseFloat(getComputedStyle(el).fontSize) < 12) tiny.push(el.tagName + ':' + walker.currentNode.textContent.trim().slice(0, 20));
        }
        return { small, tiny, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      expect(report.overflow, route).toBe(false);
      expect(report.small, route).toEqual([]);
      expect(report.tiny, route).toEqual([]);
    }
  });
}
