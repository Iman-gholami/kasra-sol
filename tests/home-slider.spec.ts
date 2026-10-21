import { expect, test, type Page } from '@playwright/test';

// The home cover slider in demo mode: discounted products one at a time, timed by a CSS progress bar, with a pause
// control (WCAG 2.2.2), slide buttons, swipe, and no autoplay under reduced motion.

const active = (page: Page) => page.locator('.hero-slide[data-active]');
const activeName = (page: Page) => active(page).locator('.hero-tag-name');

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

test('shows discounted products one at a time, moves on by itself, pauses and jumps by segment', async ({ page }) => {
  await page.goto('/');
  const slides = page.locator('.hero-slide');
  await expect(slides).toHaveCount(5);
  await expect(activeName(page)).toHaveText('شومیز لینن آوید');
  await expect(active(page).locator('.hero-tag-badge')).toHaveText('۱۷٪ تخفیف');
  await expect(slides.nth(1)).toHaveAttribute('inert');
  await expect(page.getByRole('region', { name: 'محصولات ویژه' })).toBeVisible();

  await expect(activeName(page)).toHaveText('مانتو کتی سارا', { timeout: 8000 });

  await page.getByRole('button', { name: 'توقف خودکار اسلایدها' }).click();
  // Focus and hover inside also hold the slider; leave both so only the pause button keeps it still.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(2, 2);
  await page.waitForTimeout(6000);
  await expect(activeName(page)).toHaveText('مانتو کتی سارا');
  await expect(page.getByRole('button', { name: 'پخش خودکار اسلایدها' })).toBeVisible();

  const fourth = page.getByRole('button', { name: 'اسلاید ۴ از ۵' });
  await fourth.click();
  await expect(fourth).toHaveAttribute('aria-current', 'true');
  await expect(slides.nth(3)).toHaveAttribute('data-active');
  await active(page).locator('.hero-tag').click();
  await expect(page).toHaveURL(/\/product\//);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('never moves by itself and offers no pause control, but the segments still work', async ({ page }) => {
    await page.goto('/');
    await expect(activeName(page)).toHaveText('شومیز لینن آوید');
    await expect(page.getByRole('button', { name: 'توقف خودکار اسلایدها' })).toHaveCount(0);
    await page.waitForTimeout(6000);
    await expect(activeName(page)).toHaveText('شومیز لینن آوید');
    await page.getByRole('button', { name: 'اسلاید ۲ از ۵' }).click();
    await expect(activeName(page)).toHaveText('مانتو کتی سارا');
  });
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  test('a swipe to the right shows the next slide and to the left the previous one (RTL)', async ({ page }) => {
    await page.goto('/');
    await expect(activeName(page)).toHaveText('شومیز لینن آوید');
    // Hydrate first: one real tap on a segment.
    await page.getByRole('button', { name: 'اسلاید ۱ از ۵' }).tap();
    const box = (await page.locator('.hero-slides').boundingBox())!;
    await touchDrag(page, box.x + 60, box.y + box.height * 0.6, 200);
    await expect(activeName(page)).toHaveText('مانتو کتی سارا');
    await touchDrag(page, box.x + box.width - 60, box.y + box.height * 0.6, -200);
    await expect(activeName(page)).toHaveText('شومیز لینن آوید');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
});
