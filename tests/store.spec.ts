import { expect, test } from '@playwright/test';

test('homepage, category navigation, search and filters', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('استایل هر روزت');
  await page.getByRole('link', { name: 'همه محصولات' }).first().click();
  await expect(page).toHaveURL(/\/shop/);
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page.locator('select[name="category"]').selectOption('manto');
  await page.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page.locator('.product-category').first()).toContainText('مانتو');
  await page.locator('.catalog-sort-form select[name="sort"]').selectOption('price-asc');
  await page.getByRole('button', { name: 'اعمال', exact: true }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.goto('/search?q=لینن');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.goto('/search?q=کلمهبدوننتیجه');
  await expect(page.getByText('محصولی با این انتخاب‌ها پیدا نشد')).toBeVisible();
});

test('variant stock, cart quantity and demo checkout', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ و سایز رو انتخاب کن' }).click();
  await expect(page.locator('.status-message.error')).toContainText('انتخاب');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await expect(page.getByRole('button', { name: 'سایز S ناموجود' })).toBeDisabled();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
  await expect(page.locator('.purchase-feedback')).toContainText('به سبد خرید اضافه شد');
  const added = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expect(added).toBeVisible();
  await expect(added).toContainText('شومیز لینن آوید');
  await added.getByRole('button', { name: 'ادامه خرید' }).click();
  await expect(added).toBeHidden();
  await page.goto('/cart');
  await expect(page.locator('.cart-item').getByText('شومیز لینن آوید')).toBeVisible();
  await page.reload();
  await expect(page.locator('.cart-item').getByText('شومیز لینن آوید')).toBeVisible();
  await page.getByRole('button', { name: 'افزایش تعداد شومیز لینن آوید' }).click();
  await expect(page.locator('.qty-stepper span').first()).toContainText('۲');
  await page.getByRole('link', { name: 'ادامه فرایند خرید' }).click();
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  await expect(page.locator('.status-message.error')).toContainText('۶ مورد');
  await page.getByLabel('نام و نام خانوادگی تحویل‌گیرنده').fill('نام نمایشی کاربر');
  await page.getByLabel('شماره موبایل').fill('09123456789');
  await page.getByLabel('استان').selectOption('تهران');
  await page.getByLabel('شهر', { exact: true }).fill('تهران');
  await page.getByLabel('نشانی دقیق').fill('خیابان نمونه، کوچه آزمایشی، پلاک ده');
  await page.getByLabel('کد پستی').fill('1234567890');
  await page.getByRole('button', { name: 'ادامه و انتخاب روش پرداخت' }).click();
  await expect(page).toHaveURL(/step=payment/);
  await page.getByRole('button', { name: /^پرداخت/ }).click();
  await page.getByRole('dialog', { name: 'پرداخت سفارش کسری بوتیک' }).getByRole('button', { name: 'شبیه‌سازی پرداخت موفق' }).click();
  await expect(page).toHaveURL(/order-confirmation/);
  await expect(page.getByText('هیچ سفارش واقعی ثبت نشده', { exact: false })).toBeVisible();
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
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  const dialog = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="category"]').selectOption('manto');
  await dialog.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page.getByRole('link', { name: /مانتو/ }).filter({ has: page.locator('svg') }).last()).toBeVisible();
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
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
      if (overflow) {
        const details = await page.evaluate(() => [...document.querySelectorAll('body *')]
          .map(el => {
            const rect = el.getBoundingClientRect();
            return {element: el.tagName.toLowerCase(), cls: (el.className && typeof el.className === 'string') ? el.className.slice(0,90) : '', left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width)};
          })
          .filter(x => x.right > window.innerWidth + 1 || x.left < -1).slice(0,20));
        throw new Error('Horizontal overflow at ' + width + 'px on ' + route + ': ' + JSON.stringify(details));
      }
    }
  }
});

test('size guide is accessible in place and closes with Escape', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'راهنمای سایز' }).click();
  const dialog = page.getByRole('dialog', { name: 'راهنمای سایز نمونه' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('اندازه‌گیری اختصاصی این کالا هنوز ثبت نشده است');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'رنگ و سایز رو انتخاب کن' })).toBeVisible();
});

test('header search previews and full Persian search route', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'جستجوی محصولات' }).click();
  const search = page.getByRole('dialog', { name: 'جستجو در محصولات کسری' });
  await search.getByRole('combobox', { name: 'عبارت جستجو' }).fill('لینن');
  await expect(page.locator('.search-preview-item').first()).toBeVisible();
  await expect(page.locator('.search-preview-item').first().locator('img')).toBeVisible();
  await page.getByRole('link', { name: /نمایش نتایج «لینن»/ }).click();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole('heading', { name: /نتایج جستجو برای «لینن»/ })).toBeVisible();
});

test('mobile color swatches persist in shareable filtered URL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  const drawer = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
  await drawer.getByRole('radio', { name: 'مشکی' }).check();
  await drawer.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page).toHaveURL(/color=black/);
  await expect(page.getByRole('link', { name: 'مشکی', exact: true })).toBeVisible();
});

test('added-to-cart confirmation focuses the safe choice, returns focus and links to the cart', async ({ page }) => {
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  const add = page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true });
  await add.click();
  const sheet = page.getByRole('dialog', { name: 'به سبد خرید اضافه شد' });
  await expect(sheet).toContainText('انتخاب قشنگیه!');
  await expect(sheet).toContainText('رنگ کرم،سایز M،تعداد ۱');
  await expect(sheet.getByRole('button', { name: 'ادامه خرید' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(add).toBeFocused();
  await add.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: 'مشاهده سبد خرید' }).click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'خلاصه سفارش' })).toBeVisible();
});

test('desktop 1800 layout uses space and catalog sort preserves selected filters', async ({page}) => {
  await page.setViewportSize({width:1800,height:1000});
  await page.goto('/');
  await expect(page.locator('.hero')).toBeVisible();
  await expect.poll(async () =>
    page.locator('.hero').evaluate(el => Math.round(el.getBoundingClientRect().width))
  ).toBeGreaterThan(1400);
  await page.goto('/shop?category=manto&color=black&sort=newest');
  await expect(page.locator('.active-filter-chip')).toHaveCount(3);
  await page.locator('.catalog-sort-form select[name="sort"]').selectOption('price-desc');
  await page.getByRole('button', {name:'اعمال',exact:true}).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page).toHaveURL(/color=black/);
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('mobile purchase information is grouped and demo imagery disclosure remains visible', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/product/shomiz-01');
  const buyPanel = page.getByRole('region', {name:'انتخاب مشخصات و خرید'});
  await expect(buyPanel.getByText('رنگ', {exact:false}).first()).toBeVisible();
  await expect(page.getByText('عکس‌های مدل با هوش مصنوعی ساخته شده‌اند', {exact:false})).toBeVisible();
  await buyPanel.getByRole('button', {name:'رنگ کرم'}).click();
  await buyPanel.getByRole('button', {name:'سایز M'}).click();
  await expect(buyPanel.getByRole('button', {name:'افزودن به سبد خرید'})).toBeEnabled();
});

test('full catalog pagination uses balanced product rows on wide desktop', async ({page}) => {
  await page.setViewportSize({width:1800,height:960});
  await page.goto('/shop');
  await expect(page.locator('.product-card')).toHaveCount(12);
  // Product cards can mount before the stylesheet finishes, so wait for the rendered grid.
  await expect.poll(async () => page.locator('.product-grid').first().evaluate(
    el => getComputedStyle(el).gridTemplateColumns.split(' ').length
  )).toBe(4);
  await page.getByRole('link', {name:'صفحه بعد'}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.product-card')).toHaveCount(12);
});

test('mobile shopping toolbar reaches products sooner and keeps sort filters', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/shop');
  const first = page.locator('.product-card').first();
  await expect(first).toBeVisible();
  const top = await first.evaluate(el => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(510);
  await expect(page.getByRole('button',{name:'فیلتر محصولات'})).toBeVisible();
  // Sorting takes two taps: the sort pill opens a sheet, picking an order applies it and closes the sheet.
  const sortButton = page.getByRole('button',{name:'مرتب‌سازی: پیشنهادی'});
  await sortButton.click();
  const sheet = page.getByRole('dialog',{name:'مرتب‌سازی'});
  await expect(sheet.getByRole('link',{name:'پیشنهادی'})).toHaveAttribute('aria-current','true');
  await expect(sheet.getByRole('link',{name:'پیشنهادی'})).toBeFocused();
  await sheet.getByRole('link',{name:'قیمت: زیاد به کم'}).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page.getByRole('button',{name:'مرتب‌سازی: قیمت: زیاد به کم'})).toBeFocused();
  await page.goto('/shop?color=black&sort=featured');
  await page.getByRole('button',{name:/^مرتب‌سازی:/}).click();
  await page.getByRole('dialog',{name:'مرتب‌سازی'}).getByRole('link',{name:'تازه‌ترین'}).click();
  await expect(page).toHaveURL(/color=black/);
  await expect(page).toHaveURL(/sort=newest/);
});

test('official locally hosted Estedad variable font is applied throughout Persian UI', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('body')).toHaveCSS('font-family', /estedad/i);
  await expect(page.getByRole('link', { name: /همه محصولات/ }).first()).toHaveCSS('font-family', /estedad/i);
  await page.goto('/shop');
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('.product-info h3').first()).toHaveCSS('font-family', /estedad/i);
  // Checkout forms only render when the demo cart contains an item.
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'رنگ کرم' }).click();
  await page.getByRole('button', { name: 'سایز M' }).click();
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).click();
  await expect(page.locator('.purchase-feedback')).toContainText('به سبد خرید اضافه شد');
  await page.goto('/checkout');
  await expect(page.locator('input').first()).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('input').first()).toHaveCSS('font-family', /estedad/i);
  const family = await page.evaluate(() => Array.from(document.fonts).map(f => f.family.toLowerCase()));
  expect(family.some(name => name.includes('estedad'))).toBe(true);
});

test('Persian price boundaries reject reversed ranges without losing filter state', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/shop?category=manto&color=black');
  await page.getByRole('button',{name:'فیلتر محصولات'}).click();
  const drawer=page.getByRole('dialog',{name:'فیلترهای محصولات'});
  await drawer.locator('input[name="min"]').fill('۹۰۰٬۰۰۰');
  await drawer.locator('input[name="max"]').fill('۵۰۰٬۰۰۰');
  await drawer.getByRole('button',{name:'اعمال فیلترها'}).click();
  await expect(drawer.getByRole('alert')).toContainText('حداقل قیمت');
  await expect(drawer.locator('input[name="min"]')).toBeFocused();
  await expect(page).toHaveURL(/color=black/);
  await drawer.locator('input[name="max"]').fill('۲٬۰۰۰٬۰۰۰');
  await drawer.getByRole('button',{name:'اعمال فیلترها'}).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page).toHaveURL(/min=900/);
  await expect(page).toHaveURL(/max=2/);
});

test('category navigation preserves filters and empty state can relax them', async ({page}) => {
  await page.goto('/category/manto?size=M&color=black&sort=price-asc');
  await page.getByRole('navigation',{name:'دسته‌بندی‌های محصولات'}).getByRole('link',{name:'همه محصولات'}).click();
  await expect(page).toHaveURL(/\/shop\?/);
  await expect(page).toHaveURL(/size=M/);
  await expect(page).toHaveURL(/color=black/);
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.goto('/search?q=شومیز&min=99999999');
  await expect(page.getByRole('heading',{name:'محصولی با این انتخاب‌ها پیدا نشد'})).toBeVisible();
  await page.getByRole('link',{name:'حذف محدودیت‌ها و دیدن محصولات'}).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page).not.toHaveURL(/min=/);
  await expect(page.locator('.product-card').first()).toBeVisible();
});
