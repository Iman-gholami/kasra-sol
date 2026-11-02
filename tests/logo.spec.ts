import { expect, test } from '@playwright/test';

// The Kasra wordmark: the owner's logo redrawn as one SVG. Kasra red on the white header and the checkout header, the
// logo's own cream on the dark footer. Screen readers hear the visible word first, then the store's Persian name.
const RED = 'rgb(181, 31, 43)', CREAM = 'rgb(242, 210, 175)';
const HOME = 'KASRA کسری بوتیک، صفحه اصلی';

test('the header and the footer show the KASRA wordmark, linking home', async ({ page }) => {
  await page.goto('/shop');
  const header = page.locator('.site-header').getByRole('link', { name: HOME });
  const mark = header.getByRole('img', { name: 'KASRA' });
  await expect(mark).toBeVisible();
  await expect(mark).toHaveCSS('color', RED);
  // It replaces the old lockup: no monogram box and no typed KASRA / BOUTIQUE.
  await expect(page.locator('.brand-monogram, .brand-type')).toHaveCount(0);
  const box = await mark.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(20);
  expect(box!.height).toBeLessThanOrEqual(34);
  expect(box!.width / box!.height).toBeGreaterThan(3);

  const footer = page.locator('.footer').getByRole('link', { name: HOME });
  await expect(footer.getByRole('img', { name: 'KASRA' })).toHaveCSS('color', CREAM);
  await footer.click();
  await expect(page).toHaveURL(/\/$/);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });

  test('the wordmark fits the narrowest header and the checkout header', async ({ page }) => {
    await page.goto('/');
    const mark = page.locator('.site-header').getByRole('img', { name: 'KASRA' });
    const [logo, menu, actions] = await Promise.all([mark, page.locator('.header-start'), page.locator('.header-actions')]
      .map(locator => locator.boundingBox()));
    // Clear of the menu button on the right and the action icons on the left.
    expect(logo!.x + logo!.width).toBeLessThanOrEqual(menu!.x);
    expect(logo!.x).toBeGreaterThanOrEqual(actions!.x + actions!.width);

    await page.goto('/cart');
    const flow = page.getByRole('link', { name: HOME });
    await expect(flow.getByRole('img', { name: 'KASRA' })).toHaveCSS('color', RED);
  });
});
