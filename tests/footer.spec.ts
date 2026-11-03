import { expect, test, type Locator, type Page } from '@playwright/test';

// The footer: a charcoal panel led by the store's three phone lines (one tap calls), then Instagram and the Bale
// channel in their own colours, the site's links and the small print. The contact page shows the same lines and pages.

const LINES = [
  { name: 'تماس با فروشگاه ۰۲۱ ۶۳۱۲ ۸۹۶۲', href: 'tel:+982163128962' },
  { name: 'تماس با پشتیبانی ۰۹۰۲ ۶۴۵ ۰۵۹۶', href: 'tel:+989026450596' },
  { name: 'تماس با فروش عمده ۰۹۱۹ ۹۱۸ ۱۲۶۱', href: 'tel:+989199181261' }
];
const SOCIAL = [
  { name: 'اینستاگرام کسری بوتیک (در پنجره تازه)', href: 'https://www.instagram.com/kasra_boutiquee/' },
  { name: 'کانال بله کسری بوتیک (در پنجره تازه)', href: 'https://ble.ir/kasraboutique' }
];

/** Every call and social link: present with its address, a comfortable target, and inside the given box. */
async function expectContactLinks(page: Page, scope: Locator, within: Locator) {
  const box = (await within.boundingBox())!;
  for (const { name, href } of [...LINES, ...SOCIAL]) {
    const link = scope.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', href);
    const target = (await link.boundingBox())!;
    expect(target.height, name).toBeGreaterThanOrEqual(44);
    expect(target.x, name).toBeGreaterThanOrEqual(box.x - 1);
    expect(target.x + target.width, name).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  for (const { name } of SOCIAL) {
    const link = scope.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  // Each number reads left to right in its groups, whole on one line.
  for (const number of await scope.locator('.phone-line-number').all()) {
    await expect(number).toHaveAttribute('dir', 'ltr');
    expect(await number.evaluate(el => el.getClientRects().length)).toBe(1);
  }
}

for (const width of [390, 320]) {
  test.describe('phone ' + width, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });

    test('the footer leads with the three phone lines and the Instagram and Bale links', async ({ page }) => {
      await page.goto('/');
      const footer = page.locator('.footer');
      const contact = footer.getByRole('region', { name: 'تماس با کسری' });
      await contact.scrollIntoViewIfNeeded();
      await expectContactLinks(page, contact, footer.locator('.footer-panel'));
      // The numbers are the footer's memorable thing: large, in the logo's cream.
      const number = contact.locator('.phone-line-number').first();
      await expect(number).toHaveCSS('color', 'rgb(242, 210, 175)');
      expect(parseFloat(await number.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
      // The logos are drawn in their own colours: each fill resolves to a gradient on the page.
      for (const logo of await contact.locator('.social-link svg').all()) {
        const fill = await logo.locator('[fill^="url("]').getAttribute('fill');
        const id = fill!.slice(5, -1);
        expect(await page.evaluate(gradient => !!document.getElementById(gradient)?.matches('radialGradient, linearGradient'), id)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('the contact page lists the same lines and pages, and the footer does not repeat them', async ({ page }) => {
      await page.goto('/contact');
      const main = page.locator('main');
      await expect(main.getByText('اطلاعات تماس رسمی و راه‌های پشتیبانی هنوز ثبت نشده‌اند')).toHaveCount(0);
      await expectContactLinks(page, main, main.locator('.contact-page'));
      await expect(page.locator('.footer').getByRole('region', { name: 'تماس با کسری' })).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}

test('keyboard focus on the dark footer shows in the logo cream', async ({ page }) => {
  await page.goto('/');
  const call = page.getByRole('link', { name: LINES[0].name, exact: true });
  await call.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(call).toBeFocused();
  await expect(call).toHaveCSS('outline-color', 'rgb(242, 210, 175)');
});
