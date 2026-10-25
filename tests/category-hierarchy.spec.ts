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
