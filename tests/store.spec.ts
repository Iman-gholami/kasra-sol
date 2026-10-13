import { expect, test } from '@playwright/test';

test('homepage, category navigation, search and filters', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('استایل هر روزت');
  await page.getByRole('link', { name: 'همه محصولات' }).first().click();
  await expect(page).toHaveURL(/\/shop/);
  await expect(page.locator('.product-card')).toHaveCount(9);
  await page.locator('select[name="category"]').selectOption('manto');
  await page.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page.locator('.product-category').first()).toHaveText('مانتو');
  await page.locator('select[name="sort"]').selectOption('price-asc');
  await page.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.goto('/search?q=لینن');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.goto('/search?q=کلمهبدوننتیجه');
  await expect(page.getByText('محصولی پیدا نشد')).toBeVisible();
});

test('variant stock, cart quantity and demo checkout', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'افزودن به سبد' }).click();
  await expect(page.locator('.status-message.error')).toContainText('انتخاب');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await expect(page.getByRole('button', { name: 'سایز S ناموجود' })).toBeDisabled();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد' }).click();
  await expect(page.getByRole('status')).toContainText('سبد');
  await page.goto('/cart');
  await expect(page.getByText('شومیز لینن آوید')).toBeVisible();
  await page.reload();
  await expect(page.getByText('شومیز لینن آوید')).toBeVisible();
  await page.getByRole('button', { name: 'افزایش تعداد شومیز لینن آوید' }).click();
  await expect(page.locator('.qty-stepper span').first()).toContainText('۲');
  await page.getByRole('link', { name: /ادامه تا تسویه/ }).click();
  await page.getByRole('button', { name: 'تأیید نمایشی سفارش' }).click();
  await expect(page.locator('.status-message.error')).toContainText('تأیید');
  await page.getByLabel('نام و نام خانوادگی').fill('نام نمایشی کاربر');
  await page.getByLabel('شماره موبایل').fill('09123456789');
  await page.getByLabel('استان').selectOption('تهران');
  await page.getByLabel('شهر').fill('تهران');
  await page.getByLabel('نشانی دقیق').fill('خیابان نمونه، کوچه آزمایشی، پلاک ده');
  await page.getByLabel('کد پستی').fill('1234567890');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'تأیید نمایشی سفارش' }).click();
  await expect(page).toHaveURL(/order-confirmation/);
  await expect(page.getByText('هیچ سفارشی ثبت نشده', { exact: false })).toBeVisible();
});

test('wishlist persists after refresh', async ({ page }) => {
  await page.goto('/product/manto-01');
  await page.getByRole('button', { name: 'افزودن به علاقه‌مندی‌ها', exact: true }).click();
  await page.goto('/wishlist');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.product-card')).toHaveCount(1);
});

test('mobile menu and horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await page.getByRole('navigation', { name: 'منوی موبایل' }).getByRole('link', { name: 'مانتو' }).click();
  await expect(page).toHaveURL(/\/category\/manto/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
