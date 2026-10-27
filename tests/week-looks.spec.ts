import { expect, test } from '@playwright/test';

// The home page's week of looks: six studio photos, Saturday to Thursday, each opening the catalog on its look.

test('dresses Saturday to Thursday and opens the catalog on a look\'s category and color', async ({ page }) => {
  await page.goto('/');
  const week = page.getByRole('region', { name: 'یک هفته، شش استایل' });
  const looks = week.getByRole('list', { name: 'استایل‌های هفته' }).getByRole('link');
  await expect(looks).toHaveCount(6);
  await expect(looks.first()).toContainText('شنبه');
  await expect(looks.last()).toContainText('پنجشنبه');
  await expect(looks.nth(3)).toHaveAccessibleName(/سه‌شنبه.*مانتو مشکی/);
  await looks.nth(3).click();
  await expect(page).toHaveURL(/\/shop\?category=manto&color=black$/);
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the strip scrolls sideways inside itself, never the page', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator('.week-scroll');
    await expect(strip).toBeVisible();
    expect(await strip.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
});
