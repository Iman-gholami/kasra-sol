import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('capture editorial layout on desktop and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  const folder = 'artifacts/screenshots';
  mkdirSync(folder, { recursive: true });
  for (const width of [320, 375, 390, 430, 1024, 1440, 1800]) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    for (const [name, route] of [
      ['home','/'], ['catalog','/shop'], ['product','/product/shomiz-01']
    ]) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(async () => {
        await Promise.all([...document.images].filter(i => i.getBoundingClientRect().width > 0).map(i => i.decode().catch(() => {})));
      });
      await page.screenshot({ path: folder + '/' + name + '-' + width + '.png', fullPage: true, animations: 'disabled' });
    }
  }
});

test('capture shopping states on mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const folder = 'artifacts/screenshots';
  mkdirSync(folder, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await page.getByRole('button', { name: 'فیلتر محصولات' }).click();
  await page.screenshot({path:folder+'/filters-open-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', { name: 'راهنمای سایز' }).click();
  await page.screenshot({path:folder+'/size-guide-open-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/product/shomiz-01');
  await page.getByRole('button', {name:'رنگ کرم'}).click();
  await page.getByRole('button', {name:'سایز M'}).click();
  await page.getByRole('button', {name:'افزودن به سبد خرید',exact:true}).click();
  await page.getByRole('button', {name:'سبد سریع'}).click();
  await page.screenshot({path:folder+'/mini-cart-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/product/shomiz-01');
  await page.evaluate(() => window.scrollTo(0,0));
  await expect(page.locator('.pdp-sticky-bar')).toHaveClass(/is-visible/);
  await page.screenshot({path:folder+'/pdp-gallery-sticky-390.png',fullPage:false,animations:'disabled'});
  await page.locator('.purchase-row .btn-dark').scrollIntoViewIfNeeded();
  await expect(page.locator('.pdp-sticky-bar')).not.toHaveClass(/is-visible/);
  await page.screenshot({path:folder+'/pdp-options-390.png',fullPage:false,animations:'disabled'});
  await page.goto('/cart');
  await page.screenshot({path:folder+'/cart-390.png',fullPage:true,animations:'disabled'});
  await page.goto('/checkout');
  await page.screenshot({path:folder+'/checkout-390.png',fullPage:true,animations:'disabled'});
});

test('capture discovery overlays at 390px and 1440px',async ({page})=>{
  const folder='artifacts/screenshots';
  mkdirSync(folder,{recursive:true});
  for (const width of [390,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    await page.getByRole('button',{name:'جستجوی محصولات'}).click();
    const dialog=page.getByRole('dialog',{name:'جستجو در محصولات کسری'});
    await dialog.getByRole('combobox',{name:'عبارت جستجو'}).fill('شومیز');
    await expect(dialog.locator('.search-preview-item').first()).toBeVisible();
    await page.screenshot({path:folder+'/discovery-search-'+width+'.png',fullPage:false,animations:'disabled'});
    await dialog.getByRole('button',{name:'بستن جستجو'}).click();
    await page.goto('/search?q=شومیز%20سفید');
    await page.screenshot({path:folder+'/discovery-results-'+width+'.png',fullPage:true,animations:'disabled'});
    await page.goto('/shop');
    if(width===390){
      await page.getByRole('button',{name:'فیلتر محصولات'}).click();
      await page.screenshot({path:folder+'/discovery-filter-'+width+'.png',fullPage:false,animations:'disabled'});
    }
  }
});

test('capture Shop by Color at all viewports and two selected states',async ({page})=>{
  test.setTimeout(90000);
  const folder='artifacts/screenshots';
  mkdirSync(folder,{recursive:true});
  for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:width<=430?844:900});
    await page.goto('/');
    const section=page.getByRole('region',{name:'خرید بر اساس رنگ'});
    await expect(section.getByRole('button',{name:'نمایش محصولات رنگ کرم'}))
      .toHaveAttribute('aria-pressed','true');
    await section.screenshot({path:folder+'/shop-by-color-cream-'+width+'.png',animations:'disabled'});
    if(width===390||width===1440){
      await section.getByRole('button',{name:'نمایش محصولات رنگ مشکی'}).click();
      await expect(section.getByRole('button',{name:'نمایش محصولات رنگ مشکی'}))
        .toHaveAttribute('aria-pressed','true');
      await section.screenshot({path:folder+'/shop-by-color-black-'+width+'.png',animations:'disabled'});
    }
  }
});
