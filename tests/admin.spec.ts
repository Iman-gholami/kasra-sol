import { expect, test } from '@playwright/test';

test('admin is private and redirects visitors to the employee login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', {name:'ورود به مدیریت فروشگاه'})).toBeVisible();
  await expect(page.getByLabel('نام کاربری')).toBeVisible();
  await expect(page.getByLabel('رمز عبور')).toHaveAttribute('type','password');
});

test('admin login shows a generic invalid-credential error without leaking passwords', async ({ page }) => {
  await page.route('**/api/admin/login', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({error:'invalid_credentials'})
  }));
  await page.goto('/admin/login');
  await page.getByLabel('نام کاربری').fill('employee_test');
  await page.getByLabel('رمز عبور').fill('not-the-real-password');
  await page.getByRole('button', {name:'ورود امن'}).click();
  await expect(page.getByRole('alert')).toContainText('نام کاربری یا رمز عبور درست نیست');
  await expect(page).toHaveURL(/\/admin\/login/);
});
