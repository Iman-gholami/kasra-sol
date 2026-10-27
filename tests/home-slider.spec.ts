import { expect, test } from '@playwright/test';

// The home cover in demo mode: it shows the studio cover portrait as one fixed slide (the first discounted shirt),
// so there is nothing to rotate. With the API connected, the owner's pick rotates; its autoplay,
// pause control, slide buttons and swipe are tested in tests-admin/admin-panel.spec.ts against the real catalog.

test('shows the studio cover portrait as a single, still cover linking to its product', async ({ page }) => {
  await page.goto('/');
  const cover = page.getByRole('region', { name: 'محصولات ویژه' });
  await expect(cover.locator('.hero-slide')).toHaveCount(1);
  const slide = cover.locator('.hero-slide[data-active]');
  await expect(slide.locator('.hero-tag-name')).toHaveText('شومیز لینن آوید');
  await expect(slide.locator('.hero-tag-badge')).toHaveText('۱۷٪ تخفیف');
  await expect(slide.locator('.hero-visual img')).toHaveAttribute('src', /hero-model\.avif/);
  // One slide: no progress segments, no pause control, no autoplay.
  await expect(cover.locator('.hero-segment')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /خودکار اسلایدها/ })).toHaveCount(0);
  await expect(cover).not.toHaveAttribute('data-autoplay');
  await page.waitForTimeout(6000);
  await expect(slide.locator('.hero-tag-name')).toHaveText('شومیز لینن آوید');
  await slide.locator('.hero-tag').click();
  await expect(page).toHaveURL(/\/product\/shomiz-01$/);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('fits a phone without sideways scrolling', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-slide[data-active] .hero-tag-name')).toHaveText('شومیز لینن آوید');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
});
