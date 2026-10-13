import { expect, test } from '@playwright/test';

test('PDP gallery swipes horizontally, keeps vertical gestures and closes enlarged view', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/product/shomiz-01');
  const gallery = page.locator('.pdp-gallery');
  await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۱ / ۲');
  // Exercise one real click first so the client has hydrated before synthetic touch events.
  await gallery.getByRole('button',{name:'تصویر بعدی'}).click();
  await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
  await gallery.getByRole('button',{name:'تصویر قبلی'}).click();
  await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۱ / ۲');
  await page.evaluate(() => {
    const target = document.querySelector('.pdp-gallery')!;
    const createTouch = (x: number, y: number) => new Touch({identifier:1,target,clientX:x,clientY:y});
    const start = createTouch(320,190);
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start],changedTouches:[start]}));
    const end = createTouch(90,193);
    target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[end]}));
  });
  await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
  await page.evaluate(() => {
    const target = document.querySelector('.pdp-gallery')!;
    const createTouch = (x: number, y: number) => new Touch({identifier:2,target,clientX:x,clientY:y});
    const start = createTouch(180,110);
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start],changedTouches:[start]}));
    const end = createTouch(176,360);
    target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[end]}));
  });
  await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
  await gallery.getByRole('button',{name:'تصویر قبلی'}).click();
  await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۱ / ۲');
  const zoomTrigger = page.getByRole('button',{name:/بزرگ‌نمایی تصویر/});
  await zoomTrigger.click();
  const zoom = page.getByRole('dialog',{name:'نمای بزرگ محصول'});
  await expect(zoom).toBeVisible();
  await zoom.getByRole('button',{name:'تصویر بعدی'}).click();
  await expect(zoom).toContainText('۲ / ۲');
  await page.keyboard.press('Escape');
  await expect(zoom).toBeHidden();
  await expect(zoomTrigger).toBeFocused();
});

test('PDP selection responds to unavailable size after a color change',async ({page})=>{
  await page.goto('/product/shomiz-01');
  await page.getByRole('button',{name:'رنگ رز خاکی'}).click();
  await page.getByRole('button',{name:'سایز S'}).click();
  await expect(page.getByRole('button',{name:'سایز S'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'رنگ کرم'}).click();
  await expect(page.getByRole('button',{name:'سایز S ناموجود'})).toBeDisabled();
  await expect(page.getByText('سایز قبلی برای این رنگ ناموجود است')).toBeVisible();
  await expect(page.getByRole('button',{name:'رنگ و سایز رو انتخاب کن'})).toBeVisible();
  await page.getByRole('button',{name:'سایز M'}).click();
  await expect(page.getByText('سایز قبلی برای این رنگ ناموجود است')).toHaveCount(0);
  await page.getByRole('button',{name:'افزودن به سبد خرید',exact:true}).click();
  await expect(page.locator('.purchase-feedback')).toContainText('اضافه شد');
  await expect(page.getByRole('dialog',{name:'سبد خرید سریع'})).toHaveCount(0);
  await page.getByRole('button',{name:'سبد سریع'}).click();
  const cart=page.getByRole('dialog',{name:'سبد خرید سریع'});
  await expect(cart).toContainText('کرم');
  await expect(cart).toContainText('M');
});

test('PDP sticky mobile action prompts and focuses missing selection, then hides near main CTA', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/product/shomiz-01');
  const sticky=page.locator('.pdp-sticky-bar');
  await expect(sticky).toHaveClass(/is-visible/);
  await expect(sticky.getByRole('button',{name:'انتخاب رنگ و سایز از نوار پایین'})).toBeVisible();
  await sticky.getByRole('button',{name:'انتخاب رنگ و سایز از نوار پایین'}).click();
  await expect(page.getByRole('button',{name:'رنگ کرم'})).toBeFocused();
  await expect(page.locator('.purchase-feedback')).toContainText('اول رنگ');
  await page.getByRole('button',{name:'رنگ کرم'}).click();
  await page.evaluate(() => window.scrollTo(0,0));
  await expect(sticky).toHaveClass(/is-visible/);
  await expect(sticky.getByRole('button',{name:'انتخاب سایز از نوار پایین'})).toContainText('انتخاب سایز');
  await page.getByRole('button',{name:'سایز M'}).click();
  await page.evaluate(() => window.scrollTo(0,0));
  await expect(sticky).toHaveClass(/is-visible/);
  await expect(sticky.getByRole('button',{name:'افزودن به سبد خرید از نوار پایین'})).toBeVisible();
  await page.locator('.purchase-row .btn-dark').scrollIntoViewIfNeeded();
  await expect(sticky).not.toHaveClass(/is-visible/);
  await page.evaluate(() => window.scrollTo(0,0));
  await expect(sticky).toHaveClass(/is-visible/);
  const rect=await sticky.evaluate(el => ({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
  expect(rect.top).toBeGreaterThan(680);
  expect(rect.bottom).toBeLessThanOrEqual(845);
  await sticky.getByRole('button',{name:'افزودن به سبد خرید از نوار پایین'}).click();
  await expect(sticky.getByRole('link',{name:'مشاهده سبد'})).toBeVisible();
});

test('PDP size guide uses no unverified measurements and restores keyboard focus',async ({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/product/shomiz-01');
  const trigger=page.getByRole('button',{name:'راهنمای سایز'});
  await trigger.click();
  const guide=page.getByRole('dialog',{name:'راهنمای سایز نمونه'});
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('اندازه‌گیری اختصاصی این کالا هنوز ثبت نشده است');
  await expect(guide.locator('table')).toHaveCount(0);
  await guide.getByRole('button',{name:'بستن راهنمای سایز'}).click();
  await expect(guide).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('PDP compact gallery, safe-area purchase and RTL do not overflow tested viewports',async ({page})=>{
  for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/product/shomiz-01');
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    await page.evaluate(async()=>{await document.fonts.ready;});
    await expect(page.locator('.detail-copy h1')).toHaveCSS('font-family',/estedad/i);
    const info=await page.evaluate(()=>{
      const gallery=document.querySelector('.pdp-gallery')!.getBoundingClientRect();
      const main=document.querySelector('.gallery-main')!.getBoundingClientRect();
      return {scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,photoHeight:main.height,photoWidth:gallery.width};
    });
    expect(info.scrollWidth).toBeLessThanOrEqual(width+1);
    if(width<=430) {
      expect(info.photoHeight).toBeLessThan(520);
      await expect(page.locator('.pdp-sticky-bar')).toHaveClass(/is-visible/);
    } else {
      await expect(page.locator('.pdp-sticky-bar')).not.toBeVisible();
    }
  }
});
