import { expect, test, type Locator, type Page } from '@playwright/test';
import { activeAnnouncement, announcements } from '../src/data/announcements';

// Mobile Experience 9.0: announcement, centered header, homepage quick start, persistent bottom nav and its
// coexistence with task bars, overlays and the on-screen keyboard. Phone viewport with touch unless stated.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const KEY = 'kasra-demo-v1';
const seed = (page: Page, cart: object[] = [], wishlist: string[] = []) =>
  page.addInitScript(([key, c, w]) => localStorage.setItem(key, JSON.stringify({ cart: c, wishlist: w })), [KEY, cart, wishlist] as const);
const settled = (overlay: Locator) => overlay.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
const rect = (locator: Locator) => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });
/** True when the element's center is the topmost hit target, i.e. nothing fixed covers it. */
const reachable = (locator: Locator) => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(hit && (hit === el || el.contains(hit)));
});
const bottomNav = (page: Page) => page.getByRole('navigation', { name: 'ناوبری اصلی موبایل' });
const searchDialog = (page: Page) => page.getByRole('dialog', { name: 'جستجو در محصولات کسری' });

test('announcement config: one enabled message by priority, nothing when all are disabled', () => {
  expect(activeAnnouncement()?.id).toBe('demo-status');
  expect(activeAnnouncement([{ id: 'a', message: 'a', enabled: true }, { id: 'b', message: 'b', enabled: true, priority: 5 }])?.id).toBe('b');
  expect(activeAnnouncement(announcements.map(item => ({ ...item, enabled: false })))).toBeUndefined();
});

test('homepage: announcement, centered header, search entry and quick categories; other routes drop the homepage layers', async ({ page }) => {
  await page.goto('/');
  const announcement = page.getByRole('complementary', { name: 'اطلاعیه فروشگاه' });
  await expect(announcement).toHaveText(activeAnnouncement()!.message);
  expect(Math.round((await rect(announcement)).height)).toBeLessThanOrEqual(34);

  const header = page.getByRole('banner');
  const brand = header.getByRole('link', { name: 'کسری بوتیک، صفحه اصلی' });
  const menu = header.getByRole('button', { name: 'باز کردن منو' });
  const searchIcon = header.getByRole('button', { name: 'جستجوی محصولات' });
  const cartIcon = header.getByRole('link', { name: /^سبد خرید/ });
  const b = await rect(brand);
  // The wordmark sits on the viewport's center line, not between the uneven icon groups.
  expect(Math.abs(b.left + b.width / 2 - 195)).toBeLessThanOrEqual(1);
  // RTL: menu on the right, search then bag on the left.
  expect((await rect(menu)).left).toBeGreaterThan(b.right);
  expect((await rect(searchIcon)).right).toBeLessThan(b.left);
  expect((await rect(cartIcon)).right).toBeLessThanOrEqual((await rect(searchIcon)).left + 1);
  for (const target of [menu, searchIcon, cartIcon]) {
    const r = await rect(target);
    expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(44);
  }

  const entry = page.getByRole('button', { name: 'دنبال چه لباسی می‌گردی؟' });
  await expect(entry).toBeVisible();
  const quick = page.getByRole('navigation', { name: 'دسته‌بندی‌های سریع' });
  const expected: [string, string][] = [['شومیز', '/category/shomiz'], ['مانتو', '/category/manto'], ['تیشرت', '/category/tshirt'], ['جدیدها', '/shop?sort=newest']];
  await expect(quick.getByRole('link')).toHaveText(expected.map(([name]) => name));
  for (const [name, href] of expected) await expect(quick.getByRole('link', { name })).toHaveAttribute('href', href);
  // Order: search entry, then categories, then the hero, all below the header.
  expect((await rect(entry)).top).toBeGreaterThan((await rect(header)).bottom - 1);
  expect((await rect(quick)).top).toBeGreaterThan((await rect(entry)).bottom);
  expect((await rect(page.locator('.hero-visual'))).top).toBeGreaterThan((await rect(quick)).bottom);

  await quick.getByRole('link', { name: 'مانتو' }).click();
  await expect(page).toHaveURL(/\/category\/manto$/);
  for (const route of ['/shop', '/product/shomiz-01', '/cart']) {
    await page.goto(route);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'اطلاعیه فروشگاه' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'دنبال چه لباسی می‌گردی؟' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'دسته‌بندی‌های سریع' })).toHaveCount(0);
    await expect(bottomNav(page)).toBeVisible();
  }
  await page.getByRole('banner').getByRole('link', { name: 'کسری بوتیک، صفحه اصلی' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('header icon, homepage entry and bottom nav all open the one search dialog, focus its field and restore focus', async ({ page }) => {
  await page.goto('/');
  const dialog = searchDialog(page);
  const entry = page.getByRole('button', { name: 'دنبال چه لباسی می‌گردی؟' });
  await entry.click();
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(entry).toHaveAttribute('aria-expanded', 'true');
  await settled(dialog);
  // Full screen on phones; the close button stays reachable above the keyboard area.
  const box = await rect(dialog);
  expect(box.width).toBeGreaterThanOrEqual(388);
  expect(await reachable(dialog.getByRole('button', { name: 'بستن جستجو' }))).toBe(true);
  await page.keyboard.type('شومیز');
  await expect(dialog.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('combobox')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  await expect(entry).toHaveAttribute('aria-expanded', 'false');

  const headerSearch = page.getByRole('banner').getByRole('button', { name: 'جستجوی محصولات' });
  await headerSearch.click();
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await dialog.getByRole('button', { name: 'بستن جستجو' }).click();
  await expect(dialog).toBeHidden();
  await expect(headerSearch).toBeFocused();

  const navSearch = bottomNav(page).getByRole('button', { name: 'جستجو' });
  await navSearch.click();
  await expect(dialog.getByRole('combobox')).toBeFocused();
  // Under the modal the nav is hidden (out of the accessibility tree), so read the trigger's state from the DOM.
  const navSearchNode = page.locator('.bottom-nav button.bottom-nav-item');
  await expect(navSearchNode).toBeHidden();
  await expect(navSearchNode).toHaveAttribute('aria-expanded', 'true');
  // A modal search is an open state, never "the current page".
  await expect(navSearchNode).not.toHaveAttribute('aria-current', /.+/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(navSearch).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('bottom nav: five items right to left, actions, and a route-derived active state', async ({ page }) => {
  await page.goto('/');
  const nav = bottomNav(page);
  const items = nav.locator('.bottom-nav-item');
  await expect(items).toHaveCount(5);
  const order = await items.evaluateAll(els => els.map(el => ({ label: el.textContent?.trim(), x: el.getBoundingClientRect().left }))
    .sort((a, b) => b.x - a.x).map(item => item.label));
  expect(order).toEqual(['خانه', 'فروشگاه', 'جستجو', 'علاقه‌مندی', 'سبد']);
  for (const item of await items.all()) {
    const r = await rect(item);
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }

  const home = nav.getByRole('link', { name: 'خانه' });
  const shop = nav.getByRole('link', { name: 'فروشگاه' });
  const wishlist = nav.getByRole('link', { name: /^علاقه‌مندی‌ها/ });
  const cart = nav.getByRole('link', { name: /^سبد خرید/ });
  const search = nav.getByRole('button', { name: 'جستجو' });
  const currentOf = () => items.evaluateAll(els => els.filter(el => el.hasAttribute('aria-current'))
    .map(el => el.textContent?.trim() + ':' + el.getAttribute('aria-current')));

  await expect(home).toHaveAttribute('aria-current', 'page');
  await shop.click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect.poll(currentOf).toEqual(['فروشگاه:page']);
  await wishlist.click();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect.poll(currentOf).toEqual(['علاقه‌مندی:page']);
  await cart.click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect.poll(currentOf).toEqual(['سبد:page']);
  await home.click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(currentOf).toEqual(['خانه:page']);

  // Section routes highlight the shop without claiming to be its page; product pages never highlight home.
  for (const route of ['/category/manto', '/product/shomiz-01']) {
    await page.goto(route);
    await expect.poll(currentOf).toEqual(['فروشگاه:true']);
  }
  await page.goto('/search?q=' + encodeURIComponent('مانتو'));
  await expect(search).toHaveAttribute('aria-current', 'page');
  await page.goto('/faq');
  await expect.poll(currentOf).toEqual([]);
  await page.goto('/checkout');
  await expect(page.locator('main')).toBeVisible();
  await expect(nav).toHaveCount(0);
});

test('bottom nav stays fixed while scrolling and the page reserves its height', async ({ page }) => {
  await page.goto('/');
  const nav = bottomNav(page);
  expect(await nav.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  for (const top of [0, 1200, 99999]) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top);
    const r = await rect(nav);
    expect(Math.round(r.bottom)).toBe(844);
    expect(Math.round(r.height)).toBe(60);
  }
  const footerBottom = (await rect(page.locator('.footer-bottom'))).bottom;
  expect(footerBottom).toBeLessThanOrEqual((await rect(nav)).top + 1);
});

test('safe area is padded once, by the layer touching the screen edge', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
  await page.goto('/product/shomiz-01');
  const nav = bottomNav(page);
  const bar = page.locator('.pdp-sticky-bar');
  await expect(bar).toHaveClass(/is-visible/);
  const n = await rect(nav);
  const b = await rect(bar);
  expect(Math.round(n.height)).toBe(60 + 34);
  expect(Math.round(b.bottom)).toBe(Math.round(n.top));
  // The bar does not add the inset again: content 46px + 2 × 8px padding + 1px border.
  expect(Math.round(b.height)).toBe(63);
  const reserved = await page.locator('.site-shell').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
  expect(Math.round(reserved)).toBe(Math.round(n.height + b.height));
});

test('cart badge: header and bottom nav agree from add-to-cart through refresh to an empty cart', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  const headerCart = page.getByRole('banner').getByRole('link', { name: /^سبد خرید/ });
  const navCart = bottomNav(page).getByRole('link', { name: /^سبد خرید/ });
  await expect(headerCart).toHaveAccessibleName('سبد خرید');
  await expect(navCart).toHaveAccessibleName('سبد خرید');
  await expect(page.locator('.count')).toHaveCount(0);

  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزایش تعداد' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
  await expect(headerCart).toHaveAccessibleName('سبد خرید، ۲ کالا');
  await expect(navCart).toHaveAccessibleName('سبد خرید، ۲ کالا');
  await expect(headerCart.locator('.count')).toHaveText('۲');
  await expect(navCart.locator('.count')).toHaveText('۲');
  await expect(page.getByRole('status').filter({ hasText: 'سبد خرید: ۲ کالا' })).toHaveCount(1);

  await page.reload();
  await expect(navCart).toHaveAccessibleName('سبد خرید، ۲ کالا');
  await expect(headerCart).toHaveAccessibleName('سبد خرید، ۲ کالا');

  await navCart.click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole('button', { name: 'کاهش تعداد شومیز لینن آوید' }).click();
  await expect(navCart).toHaveAccessibleName('سبد خرید، ۱ کالا');
  await page.getByRole('button', { name: 'حذف شومیز لینن آوید از سبد' }).click();
  await expect(navCart).toHaveAccessibleName('سبد خرید');
  await expect(headerCart).toHaveAccessibleName('سبد خرید');
  await expect(page.locator('.count')).toHaveCount(0);
});

test('product page: purchase bar sits on the nav, the main CTA is never hidden behind it, size guide suppresses both', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  const nav = bottomNav(page);
  const bar = page.locator('.pdp-sticky-bar');
  await expect(bar).toHaveClass(/is-visible/);
  expect(Math.round((await rect(bar)).bottom)).toBe(Math.round((await rect(nav)).top));
  const barButton = bar.getByRole('button', { name: 'انتخاب رنگ و سایز از نوار پایین' });
  expect(await reachable(barButton)).toBe(true);

  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  // Put the main button just above the nav: it is visible, so the bar steps aside and nothing covers it.
  const main = page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true });
  await main.evaluate(el => {
    const navTop = document.querySelector('.bottom-nav')!.getBoundingClientRect().top;
    window.scrollBy({ top: el.getBoundingClientRect().bottom - navTop + 8, behavior: 'instant' });
  });
  await expect(bar).not.toHaveClass(/is-visible/);
  await expect.poll(() => reachable(main)).toBe(true);
  // Main button behind the nav counts as hidden: the bar returns instead of leaving no reachable CTA.
  await main.evaluate(el => {
    const navTop = document.querySelector('.bottom-nav')!.getBoundingClientRect().top;
    window.scrollBy({ top: el.getBoundingClientRect().top - navTop - 10, behavior: 'instant' });
  });
  await expect(bar).toHaveClass(/is-visible/);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await bar.getByRole('button', { name: 'افزودن به سبد خرید از نوار پایین' }).click();
  await expect(bar.getByRole('status')).toContainText('به سبد خرید اضافه شد');
  expect(Math.round((await rect(bar)).bottom)).toBe(Math.round((await rect(nav)).top));
  await expect(nav.getByRole('link', { name: 'سبد خرید، ۱ کالا' })).toBeVisible();

  await page.getByRole('button', { name: 'راهنمای سایز' }).click();
  const guide = page.getByRole('dialog', { name: 'راهنمای سایز نمونه' });
  await expect(guide).toBeVisible();
  await expect(nav).toBeHidden();
  await expect(bar).toBeHidden();
  await settled(guide);
  expect(await reachable(guide.getByRole('button', { name: 'بستن راهنمای سایز' }))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(nav).toBeVisible();

  // At the very end the footer clears both fixed layers.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(bar).toHaveClass(/is-visible/);
  expect((await rect(page.locator('.footer-bottom'))).bottom).toBeLessThanOrEqual((await rect(bar)).top + 1);
});

test('cart page: total bar stacks on the nav and its checkout link stays reachable', async ({ page }) => {
  await seed(page, [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }]);
  await page.goto('/cart');
  const nav = bottomNav(page);
  const taskBar = page.locator('.cart-task-bar');
  await expect(taskBar).toBeVisible();
  expect(Math.round((await rect(taskBar)).bottom)).toBe(Math.round((await rect(nav)).top));
  const checkout = taskBar.getByRole('link', { name: /ادامه تا تسویه‌حساب/ });
  expect(await reachable(checkout)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  expect((await rect(page.locator('.footer-bottom'))).bottom).toBeLessThanOrEqual((await rect(taskBar)).top + 1);
});

test('overlays and the keyboard: drawers and sheets cover the nav, a focused field hides it, both restore', async ({ page }) => {
  await page.goto('/');
  const nav = bottomNav(page);
  const menu = page.getByRole('button', { name: 'باز کردن منو' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'منوی موبایل' })).toBeVisible();
  await expect(nav).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(nav).toBeVisible();
  await expect(menu).toBeFocused();

  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  const sheet = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
  await expect(sheet).toBeVisible();
  await expect(nav).toBeHidden();
  await settled(sheet);
  expect(await reachable(sheet.getByRole('button', { name: /اعمال فیلترها و نمایش/ }))).toBe(true);
  await sheet.getByRole('button', { name: /اعمال فیلترها/ }).click();
  await expect(sheet).toBeHidden();
  await expect(nav).toBeVisible();
  // The floating filter pill rides above the nav instead of under it.
  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: 'instant' }));
  const pill = page.getByRole('button', { name: /فیلترها/ });
  await expect(pill).toBeVisible();
  expect((await rect(pill)).bottom).toBeLessThanOrEqual((await rect(nav)).top - 8);

  await page.goto('/search');
  const field = page.getByRole('searchbox', { name: 'جستجوی محصولات' });
  await field.focus();
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', '');
  await expect(nav).toBeHidden();
  await field.blur();
  await expect(nav).toBeVisible();
  // Radios and checkboxes never raise a keyboard, so focusing one does not count as typing.
  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  await page.getByRole('dialog', { name: 'فیلترهای محصولات' }).getByRole('radio', { name: 'مشکی' }).focus();
  await expect(page.locator('html')).not.toHaveAttribute('data-keyboard');
  await page.keyboard.press('Escape');
  await expect(nav).toBeVisible();
});

test('quick categories become a native RTL horizontal scroller when more categories than fit are configured', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const list = page.locator('.quick-categories ul');
  expect(await list.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  // Simulate a longer future category list by cloning the configured items.
  await list.evaluate(el => { for (const li of [...el.children]) el.append(li.cloneNode(true)); });
  expect(await list.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  const last = list.locator('li').last();
  expect(await last.evaluate(el => el.getBoundingClientRect().right < 0 || el.getBoundingClientRect().left < 0)).toBe(true);
  // RTL scrollers start at the right edge and scroll toward negative scrollLeft.
  await list.evaluate(el => el.scrollTo({ left: -el.scrollWidth, behavior: 'instant' }));
  const r = await rect(last);
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [width, height] of [[320, 720], [375, 812], [390, 844], [430, 932]] as const) {
  test(`phone layout at ${width}px: no overflow, unclipped centered logo, legible nav labels`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seed(page, [{ productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 }], ['manto-03']);
    for (const route of ['/', '/shop', '/product/shomiz-01', '/cart']) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      const report = await page.evaluate(() => {
        const brand = document.querySelector('.site-header .brand')!;
        const parts = [...brand.querySelectorAll('.brand-monogram, .brand-type strong, .brand-type small')];
        const b = brand.getBoundingClientRect();
        const labels = [...document.querySelectorAll('.bottom-nav-item > span:last-child')].map(el => ({
          size: parseFloat(getComputedStyle(el).fontSize), clipped: el.scrollWidth > (el.parentElement as HTMLElement).clientWidth
        }));
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          center: b.left + b.width / 2 - innerWidth / 2,
          brandVisible: parts.length === 3 && parts.every(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth; }),
          labels
        };
      });
      expect(report.overflow, route).toBe(false);
      expect(Math.abs(report.center), route).toBeLessThanOrEqual(1);
      expect(report.brandVisible, route).toBe(true);
      expect(report.labels).toHaveLength(5);
      for (const label of report.labels) {
        expect(label.size).toBeGreaterThanOrEqual(12);
        expect(label.clipped).toBe(false);
      }
    }
  });
}

test.describe('tablet and desktop', () => {
  test.use({ hasTouch: false, isMobile: false });

  for (const [width, height] of [[768, 1024], [1024, 768], [1440, 900]] as const) {
    test(`no phone-only UI at ${width}px and the existing header stays usable`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.getByRole('navigation', { name: 'ناوبری اصلی موبایل' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'دنبال چه لباسی می‌گردی؟' })).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'دسته‌بندی‌های سریع' })).toBeHidden();
      await expect(page.locator('.home-quick-start img')).toHaveCount(4);
      expect(await page.locator('.home-quick-start img').evaluateAll(imgs => imgs.every(img => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0))).toBe(true);
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.site-shell')!).paddingBottom))).toBe(0);
      const header = page.getByRole('banner');
      await expect(header.getByRole('link', { name: /^سبد خرید/ })).toBeVisible();
      await expect(header.getByRole('link', { name: /^علاقه‌مندی‌ها/ })).toBeVisible();
      if (width > 820) {
        await expect(page.getByRole('navigation', { name: 'دسته‌بندی‌های اصلی' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'باز کردن منو' })).toBeHidden();
      } else {
        await expect(page.getByRole('button', { name: 'باز کردن منو' })).toBeVisible();
      }
      // Desktop and tablet keep the start-aligned logo.
      const brand = await rect(header.getByRole('link', { name: 'کسری بوتیک، صفحه اصلی' }));
      expect(brand.right).toBeGreaterThan(width * 0.75);
      await header.getByRole('button', { name: 'جستجوی محصولات' }).click();
      await expect(searchDialog(page).getByRole('combobox')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(searchDialog(page)).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});
