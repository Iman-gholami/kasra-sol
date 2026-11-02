import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The home page's «آخرین دونه‌ها»: a red panel of models down to their very last piece, between «تازه رسیده‌ها» and
// «خرید بر اساس رنگ». The demo catalog has five, newest first, each with one unit left in size M; the first is
// شومیز نخی دریا in white (718,000 toman, no discount).
const railOf = (page: Page) => page.getByRole('region', { name: 'آخرین دونه‌ها' });
const topOf = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
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

test('sits between the new arrivals and shop by colour, with every model down to its last piece', async ({ page }) => {
  await page.goto('/');
  const rail = railOf(page);
  await expect(rail).toBeVisible();
  const [arrivals, last, colors] = await Promise.all([page.locator('section[aria-labelledby="arrivals-title"]'), rail,
    page.getByRole('region', { name: 'خرید بر اساس رنگ' })].map(locator => locator.evaluate(topOf)));
  expect(arrivals).toBeLessThan(last);
  expect(last).toBeLessThan(colors);

  await expect(rail.getByText('از هر کدوم فقط یکی مونده؛ مال کسیه که زودتر برسه.')).toBeVisible();
  await expect(rail.locator('.last-pieces-tag')).toHaveText(/۱\s*دونه/);
  const cards = rail.locator('.last-card');
  await expect(cards).toHaveCount(5);
  const first = cards.first();
  await expect(first.locator('.last-card-badge')).toHaveText('فقط ۱ دونه');
  await expect(first.locator('.last-card-name')).toHaveText('شومیز نخی دریا');
  await expect(first.locator('.last-card-piece')).toHaveText('سفید، سایز M');
  await expect(first.locator('strong.price')).toHaveText('۷۱۸٬۰۰۰ تومان');
  await expect(first.locator('del')).toHaveCount(0);
  await first.click();
  await expect(page).toHaveURL(/\/product\/shomiz-04$/);
  // The piece on the card is the one the product page still sells.
  await page.getByRole('button', { name: 'رنگ سفید' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await expect(page.locator('.stock-note')).toContainText('۱ عدد');
});

test('«see all» opens the shop on the last pieces, with a chip that removes the filter', async ({ page }) => {
  await page.goto('/');
  const rail = railOf(page);
  const links = rail.getByRole('link', { name: /مشاهده همه/ });
  await expect(links).toHaveCount(2);
  expect(await links.evaluateAll(all => all.map(link => link.getAttribute('href')))).toEqual(['/shop?last=1', '/shop?last=1']);
  await expect(rail.locator('.last-pieces-more')).toContainText('۵ مدل');
  await links.first().click();
  await expect(page).toHaveURL(/\/shop\?last=1$/);
  await expect(page.locator('.product-card')).toHaveCount(5);
  await expect(page.locator('.catalog-count')).toContainText('۵');
  await page.locator('.active-filter-chip', { hasText: 'آخرین دونه‌ها' }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator('.product-card')).toHaveCount(12);
});

test('with a mouse, the arrows page through the rail and stop at both ends', async ({ page }) => {
  await page.goto('/');
  const rail = railOf(page);
  const track = rail.locator('.last-pieces-track');
  const previous = rail.getByRole('button', { name: 'دونه‌های قبلی' });
  const next = rail.getByRole('button', { name: 'دونه‌های بعدی' });
  await rail.scrollIntoViewIfNeeded();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  const offset = () => track.evaluate(el => Math.round(el.scrollLeft));
  // RTL: the rail starts at its right edge and moves forward to the left, so scrollLeft goes from 0 to negative.
  await next.click();
  expect(await settled(track)).toBeLessThan(-100);
  await expect(previous).toBeEnabled();
  for (let i = 0; i < 12 && await next.isEnabled(); i++) { await next.click(); await settled(track); }
  await expect(next).toBeDisabled();
  const end = await rail.locator('.last-pieces-more').boundingBox(), box = await track.boundingBox();
  expect(end!.x).toBeGreaterThanOrEqual(box!.x - 1);

  for (let i = 0; i < 12 && await previous.isEnabled(); i++) { await previous.click(); await settled(track); }
  await expect(previous).toBeDisabled();
  expect(await offset()).toBe(0);
});

test('a quick double press on an arrow moves two pages, not one and a bit', async ({ page }) => {
  const rail = railOf(page);
  const track = rail.locator('.last-pieces-track');
  const next = rail.getByRole('button', { name: 'دونه‌های بعدی' });
  const offset = () => track.evaluate(el => Math.round(el.scrollLeft));
  // Fresh navigations each time: a reload may restore the rail's previous scroll position.
  await page.goto('/');
  await rail.scrollIntoViewIfNeeded();
  await next.click();
  const onePage = await settled(track);
  expect(onePage).toBeLessThan(-100);

  await page.goto('/');
  await rail.scrollIntoViewIfNeeded();
  expect(await offset()).toBe(0);
  await next.click();
  await next.click();
  expect(Math.abs(await settled(track) - 2 * onePage)).toBeLessThanOrEqual(2);
});

test('has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/');
  await railOf(page).scrollIntoViewIfNeeded();
  const result = await new AxeBuilder({ page }).include('.last-pieces')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id)).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('swipes inside the panel without widening the page; a third tile peeks in; no arrows', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      const rail = railOf(page);
      await rail.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), String(width)).toBeLessThanOrEqual(width + 1);
      const track = rail.locator('.last-pieces-track');
      const { scrollWidth, clientWidth } = await track.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
      expect(scrollWidth).toBeGreaterThan(clientWidth * 2);
      const card = await rail.locator('.last-card').first().boundingBox();
      expect(card!.width / clientWidth, String(width)).toBeGreaterThan(1 / 3);
      expect(card!.width / clientWidth, String(width)).toBeLessThan(1 / 2);
      await expect(rail.getByRole('button', { name: 'دونه‌های بعدی' })).toBeHidden();

      const result = await new AxeBuilder({ page }).include('.last-pieces')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id)).toEqual([]);
    }
  });
});
