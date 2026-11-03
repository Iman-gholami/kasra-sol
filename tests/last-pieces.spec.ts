import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// «آخرین دونه‌ها»: one card per colour-and-size variant with exactly one unit left (demo setting on at 20%), on a
// Kasra-red band between «تازه رسیده‌ها» and «خرید بر اساس رنگ». The demo has nine; the first is شومیز نخی دریا in
// white, size M, 718,000 → 574,000. «مشاهده همه» opens /last-pieces with all of them.
const railOf = (page: Page) => page.getByRole('region', { name: 'آخرین دونه‌ها' });
const topOf = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Waits until the rail's smooth scroll has come to rest (no scroll event for 400ms, measured in the page so a busy
 * machine cannot fool it) and returns where it stopped. */
const settled = (track: Locator) => track.evaluate(el => new Promise<number>(resolve => {
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const rest = () => {
    clearTimeout(quiet);
    quiet = setTimeout(() => { el.removeEventListener('scroll', rest); resolve(Math.round(el.scrollLeft)); }, 400);
  };
  el.addEventListener('scroll', rest, { passive: true });
  rest();
}));

test('sits between the new arrivals and shop by colour: a red band, the stamp, and one card per last piece', async ({ page }) => {
  await page.goto('/');
  const rail = railOf(page);
  await expect(rail).toBeVisible();
  const [arrivals, last, colors] = await Promise.all([page.locator('section[aria-labelledby="arrivals-title"]'), rail,
    page.getByRole('region', { name: 'خرید بر اساس رنگ' })].map(locator => locator.evaluate(topOf)));
  expect(arrivals).toBeLessThan(last);
  expect(last).toBeLessThan(colors);
  await expect(rail.locator('.last-pieces-band')).toHaveCSS('background-color', 'rgb(181, 31, 43)');
  await expect(rail.locator('.last-pieces-stamp')).toBeVisible();

  const cards = rail.locator('.last-piece-card');
  await expect(cards).toHaveCount(9);
  const first = cards.first();
  await expect(first.locator('.last-piece-name')).toHaveText('شومیز نخی دریا');
  await expect(first.locator('.last-piece-variant')).toHaveText('سفید، سایز M');
  await expect(first.locator('.last-piece-pill')).toHaveText('۲۰٪ تخفیف');
  await expect(first.locator('.last-piece-price strong')).toHaveText('۵۷۴٬۰۰۰ تومان');
  await expect(first.locator('.last-piece-price del')).toContainText('۷۱۸٬۰۰۰');
});

test('a card opens its product with that colour and size chosen', async ({ page }) => {
  await page.goto('/');
  await railOf(page).locator('.last-piece-card').filter({ hasText: 'کرم، سایز XL' }).click();
  await expect(page).toHaveURL(/\/product\/manto-08\?color=cream&size=XL$/);
  await expect(page.getByRole('button', { name: 'رنگ کرم' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^سایز XL/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.detail-price strong.price')).toHaveText('۱٬۳۱۴٬۰۰۰ تومان');
});

test('«مشاهده همه» opens a page with every last piece', async ({ page }) => {
  await page.goto('/');
  const all = railOf(page).getByRole('link', { name: 'مشاهده همه' });
  await expect(all).toHaveAttribute('href', '/last-pieces');
  await all.click();
  await expect(page).toHaveURL(/\/last-pieces$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('آخرین دونه‌ها');
  await expect(page.locator('.last-piece-card')).toHaveCount(9);
  await expect(page.locator('.last-pieces-count')).toHaveText('۹ دونه');
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id)).toEqual([]);
});

for (const [device, use] of [
  ['desktop', { viewport: { width: 1280, height: 860 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(device, () => {
    test.use(use);

    test('the arrows page through the rail and stop at both ends', async ({ page }) => {
      await page.goto('/');
      const rail = railOf(page);
      const track = rail.locator('.last-pieces-track');
      const previous = rail.getByRole('button', { name: 'دونه‌های قبلی' });
      const next = rail.getByRole('button', { name: 'دونه‌های بعدی' });
      await rail.scrollIntoViewIfNeeded();
      await expect(next).toBeVisible();
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();
      const offset = () => track.evaluate(el => Math.round(el.scrollLeft));
      // RTL: the rail starts at its right edge and moves forward to the left, so scrollLeft goes from 0 to negative.
      await next.click();
      expect(await settled(track)).toBeLessThan(-100);
      await expect(previous).toBeEnabled();
      for (let i = 0; i < 12 && await next.isEnabled(); i++) { await next.click(); await settled(track); }
      await expect(next).toBeDisabled();
      for (let i = 0; i < 12 && await previous.isEnabled(); i++) { await previous.click(); await settled(track); }
      await expect(previous).toBeDisabled();
      expect(await offset()).toBe(0);
    });

    test('a quick double press on an arrow moves two pages', async ({ page }) => {
      const rail = railOf(page);
      const track = rail.locator('.last-pieces-track');
      const next = rail.getByRole('button', { name: 'دونه‌های بعدی' });
      // Fresh navigations each time: a reload may restore the rail's previous scroll position.
      await page.goto('/');
      await rail.scrollIntoViewIfNeeded();
      await next.click();
      const onePage = await settled(track);
      await page.goto('/');
      await rail.scrollIntoViewIfNeeded();
      await next.click();
      await next.click();
      expect(Math.abs(await settled(track) - 2 * onePage)).toBeLessThanOrEqual(2);
    });
  });
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('swipes inside the band without widening the page; the third card is cut at the edge', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      const rail = railOf(page);
      await rail.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), String(width)).toBeLessThanOrEqual(width + 1);
      const track = await rail.locator('.last-pieces-track').boundingBox();
      const third = await rail.locator('.last-piece-card').nth(2).boundingBox();
      // RTL: the third card starts inside the band and runs past its left edge.
      expect(third!.x, String(width)).toBeLessThan(track!.x);
      expect(third!.x + third!.width, String(width)).toBeGreaterThan(track!.x + 8);
      const result = await new AxeBuilder({ page }).include('.last-pieces').withTags(AXE_TAGS).analyze();
      expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id)).toEqual([]);
    }
  });
});

test('the stamp edge turns on its own, very slowly; the words stay upright; still for reduced motion', async ({ page }) => {
  await page.goto('/');
  const edge = railOf(page).locator('.last-pieces-stamp-edge');
  const turning = await edge.evaluate(el => {
    const style = getComputedStyle(el);
    return { name: style.animationName, seconds: parseFloat(style.animationDuration), repeat: style.animationIterationCount,
      running: el.getAnimations().some(animation => animation.playState === 'running') };
  });
  expect(turning).toEqual({ name: 'last-stamp-turn', seconds: 40, repeat: 'infinite', running: true });
  // Only the scalloped edge and its ring turn: «فقط ۱ دونه» and the red centre never move.
  for (const still of await railOf(page).locator('.last-pieces-stamp > :not(.last-pieces-stamp-edge)').all())
    expect(await still.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await edge.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
