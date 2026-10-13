import { expect, test } from '@playwright/test';

test('search suggestions are server-capped and normalized for Persian keyboard variants',async ({request})=>{
  const response=await request.get('/api/search-suggestions?q='+encodeURIComponent('شوميز'));
  expect(response.ok()).toBe(true);
  const body=await response.json();
  expect(body.count).toBeGreaterThan(4);
  expect(body.products.length).toBeLessThanOrEqual(4);
  expect(body.categories.some((c:{title:string})=>c.title==='شومیز')).toBe(true);
  const exact=await request.get('/api/search-suggestions?q='+encodeURIComponent('شومیز لینن آوید'));
  const single=await exact.json();
  expect(single.products[0].name).toBe('شومیز لینن آوید');
});

test('mobile search dialog supports query, keyboard selection, clear, Escape, and focus return',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const opener=page.getByRole('button',{name:'جستجوی محصولات'});
  await opener.click();
  const dialog=page.getByRole('dialog',{name:'جستجو در محصولات کسری'});
  await expect(dialog).toBeVisible();
  const input=dialog.getByRole('combobox',{name:'عبارت جستجو'});
  await expect(input).toBeFocused();
  await input.fill('لینن');
  await expect(dialog.locator('.search-preview-item').first()).toBeVisible();
  const suggestions=await dialog.locator('.search-preview-item').count();
  expect(suggestions).toBeGreaterThan(0);
  await input.press('ArrowDown');
  await expect(dialog.getByRole('option',{selected:true})).toHaveCount(1);
  await dialog.getByRole('button',{name:'پاک کردن عبارت جستجو'}).click();
  await expect(input).toHaveValue('');
  await input.fill('شومیز لینن');
  await expect(dialog.locator('.search-preview-item').first()).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/product\/shomiz-/);
  await page.goto('/');
  await page.getByRole('button',{name:'جستجوی محصولات'}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'جستجو در محصولات کسری'})).toBeHidden();
  await expect(page.getByRole('button',{name:'جستجوی محصولات'})).toBeFocused();
});

test('multiword Persian search matches real catalog colors and category terms',async ({page})=>{
  await page.goto('/search?q='+encodeURIComponent('شوميز سفید'));
  await expect(page.getByRole('heading',{name:/نتایج جستجو برای/})).toBeVisible();
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.goto('/search?q='+encodeURIComponent('شومیز\u200cدکمه دار'));
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('category browsing retains search query and sorting while filtering',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/search?q='+encodeURIComponent('لینن'));
  await page.getByRole('navigation',{name:'دسته‌بندی‌های محصولات'}).getByRole('link',{name:'مانتو'}).click();
  await expect(page).toHaveURL(/category=manto/);
  await expect(page).toHaveURL(/q=/);
  await page.getByRole('button',{name:'فیلتر محصولات'}).click();
  const drawer=page.getByRole('dialog',{name:'فیلترهای محصولات'});
  await drawer.getByRole('radio',{name:'M'}).check();
  await drawer.getByRole('button',{name:'اعمال فیلترها'}).click();
  await expect(page).toHaveURL(/size=M/);
  await expect(page).toHaveURL(/q=/);
  await page.locator('.catalog-mobile-sort select[name="sort"]').selectOption('price-asc');
  await page.getByRole('button',{name:'اعمال مرتب‌سازی موبایل'}).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await expect(page).toHaveURL(/size=M/);
  await expect(page).toHaveURL(/q=/);
});

test('Persian Toman price fields and no-results recovery retain the original query',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/search?q='+encodeURIComponent('شومیز'));
  await page.getByRole('button',{name:'فیلتر محصولات'}).click();
  const drawer=page.getByRole('dialog',{name:'فیلترهای محصولات'});
  await drawer.locator('input[name="min"]').fill('۹۹٬۹۹۹٬۹۹۹');
  await drawer.getByRole('button',{name:'اعمال فیلترها'}).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page).toHaveURL(/min=/);
  await expect(page.getByRole('heading',{name:'محصولی با این انتخاب‌ها پیدا نشد'})).toBeVisible();
  await page.getByRole('link',{name:'حذف فیلترها و دیدن نتایج'}).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page).not.toHaveURL(/min=/);
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('filtered result navigation preserves shareable URL on browser return',async ({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/shop?category=manto&size=M&sort=newest');
  await expect(page.locator('.product-card').first()).toBeVisible();
  const initial=page.url();
  await page.locator('.product-image-link').first().click();
  await expect(page).toHaveURL(/\/product\//);
  await page.goBack();
  await expect(page).toHaveURL(initial);
  await expect(page.locator('.product-card').first()).toBeVisible();
  await expect(page.getByRole('navigation',{name:'دسته‌بندی‌های محصولات'}).getByRole('link',{name:'مانتو'})).toHaveAttribute('aria-current','page');
});

test('discovery layouts never overflow tested viewports, including opened panels',async ({page})=>{
  for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/shop');
    await expect(page.locator('.product-card').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(width<=820){
      await page.getByRole('button',{name:'فیلتر محصولات'}).click();
      await expect(page.getByRole('dialog',{name:'فیلترهای محصولات'})).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await page.goto('/');
    await page.getByRole('button',{name:'جستجوی محصولات'}).click();
    await expect(page.getByRole('dialog',{name:'جستجو در محصولات کسری'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});
