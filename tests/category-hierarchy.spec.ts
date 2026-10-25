import { expect, test } from '@playwright/test';

test('a parent category includes legacy child products and links to its children', async ({ page }) => {
  await page.goto('/category/shomiz-vest');
  await expect(page.getByRole('heading', { level: 1, name: 'شومیز و وست زنانه' })).toBeVisible();
  await expect(page.getByText('شومیز لینن آوید').first()).toBeVisible();
  const subcategories = page.getByRole('navigation', { name: 'زیرگروه‌های این دسته' });
  await expect(subcategories.getByRole('link', { name: 'شومیز', exact: true })).toBeVisible();
  await subcategories.getByRole('link', { name: 'شومیز', exact: true }).click();
  await expect(page).toHaveURL(/\/category\/shomiz$/);
  await expect(page.getByRole('heading', { level: 1, name: 'شومیز' })).toBeVisible();
});

test('the mobile navigation exposes the pants hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  const pants = page.locator('.mobile-category-details').filter({ has: page.locator('summary', { hasText: 'شلوار زنانه' }) });
  await pants.locator('summary').click();
  await pants.getByRole('link', { name: 'شلوار بوتکات' }).click();
  await expect(page).toHaveURL(/\/category\/bootcut-pants$/);
  await expect(page.getByRole('heading', { level: 1, name: 'شلوار بوتکات' })).toBeVisible();
});

test('category navigation stays on one line with accessible RTL scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/category/pants');
  const parents = page.getByRole('navigation', { name: 'دسته‌بندی‌های محصولات' });
  const models = page.getByRole('navigation', { name: 'زیرگروه‌های این دسته' });
  await expect(parents.getByRole('link', { name: 'شلوار زنانه', exact: true })).toHaveAttribute('data-active', 'true');
  await expect(models.getByRole('link', { name: 'همه شلوار زنانه' })).toHaveAttribute('aria-current', 'page');

  for (const nav of [parents, models]) {
    const shape = await nav.evaluate(node => ({
      height: node.getBoundingClientRect().height,
      scroll: node.scrollWidth - node.clientWidth,
      nowrap: getComputedStyle(node).flexWrap,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    expect(shape.nowrap).toBe('nowrap');
    expect(shape.height).toBeLessThanOrEqual(55);
    expect(shape.scroll).toBeGreaterThan(100);
    expect(shape.pageOverflow).toBe(false);
  }

  await models.getByRole('link', { name: 'شلوار بوتکات', exact: true }).click();
  await expect(page).toHaveURL(/\/category\/bootcut-pants$/);
  await expect(page.getByRole('navigation', { name: 'دسته‌بندی‌های محصولات' })
    .getByRole('link', { name: 'شلوار زنانه', exact: true })).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('navigation', { name: 'زیرگروه‌های این دسته' })
    .getByRole('link', { name: 'شلوار بوتکات', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('desktop shows controls only when a category rail overflows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/category/pants');
  const previous = page.getByRole('button', { name: 'موارد قبلی دسته‌ها' });
  const next = page.getByRole('button', { name: 'موارد بعدی دسته‌ها' });
  await expect(next).toBeEnabled();
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(previous).toBeEnabled();
});
