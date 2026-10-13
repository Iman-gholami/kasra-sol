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
  await expect(page.locator('.product-category').first()).toContainText('مانتو');
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

test('optimized model photos are served and used by storefront', async ({ page, request }) => {
  for (const photo of ['shomiz-cream', 'shomiz-rose', 'manto-black', 'manto-sage', 'tshirt-white', 'tshirt-blue']) {
    const response = await request.get('/images/lookbook/' + photo + '.avif');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/avif');
  }
  await page.goto('/');
  await expect(page.locator('.hero-visual img')).toHaveAttribute('src', /shomiz-cream.avif/);
  await page.goto('/category/manto');
  await expect(page.locator('.product-image-link img').first()).toHaveAttribute('src', /manto-/);
  await page.goto('/category/tshirt');
  await expect(page.locator('.product-image-link img').first()).toHaveAttribute('src', /tshirt-/);
});

test('mobile drawer filters, active chips and Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر و مرتب‌سازی' }).click();
  const dialog = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="category"]').selectOption('manto');
  await dialog.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page.getByRole('link', { name: /مانتو/ }).filter({ has: page.locator('svg') }).last()).toBeVisible();
  await page.getByRole('button', { name: 'فیلتر و مرتب‌سازی' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('all requested viewport widths avoid document overflow', async ({ page }) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/shop', '/product/shomiz-01', '/cart', '/checkout']) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, 'Horizontal overflow at ' + width + 'px on ' + route).toBe(false);
    }
  }
});
