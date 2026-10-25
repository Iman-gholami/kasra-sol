import { expect, test, type Page } from '@playwright/test';

/** Real touch drag through CDP (synthetic DOM TouchEvents never scroll a native scroller). */
async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y}]});
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x: x + dx * i / 12, y: y + dy * i / 12}]});
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await cdp.detach();
}

test.describe('touch device', () => {
  test.use({viewport:{width:390,height:844}, hasTouch:true, isMobile:true});

  test('PDP gallery swipes horizontally, keeps vertical gestures and closes enlarged view', async ({page}) => {
    await page.goto('/product/shomiz-01');
    const gallery = page.locator('.pdp-gallery');
    await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۱ / ۲');
    // Exercise one real tap first so the client has hydrated before the touch gestures.
    await gallery.getByRole('button',{name:'تصویر بعدی'}).click();
    await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
    await gallery.getByRole('button',{name:'تصویر قبلی'}).click();
    await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۱ / ۲');
    // V9: the gallery is a native RTL scroll-snap track. In RTL the next image sits to the left, so
    // dragging the finger to the right reveals it — the direction the arrows and dots imply.
    // Let the button-driven smooth scroll finish so the drag starts from a settled track.
    await expect.poll(() => page.locator('.pdp-track').evaluate(track => Math.abs(track.scrollLeft))).toBe(0);
    const box = (await gallery.boundingBox())!;
    await touchDrag(page, box.x + 60, box.y + box.height / 2, 230, 3);
    await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
    await expect(gallery.locator('.gallery-dots span').nth(1)).toHaveClass(/is-active/);
    // A mostly vertical drag scrolls the page and keeps the current image.
    await touchDrag(page, box.x + box.width / 2, box.y + 300, -4, -220);
    await expect(gallery.locator('.pdp-gallery-counter')).toContainText('۲ / ۲');
    await page.evaluate(() => window.scrollTo(0, 0));
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
  const added=page.getByRole('dialog',{name:'به سبد خرید اضافه شد'});
  await expect(added).toContainText('کرم');
  await expect(added).toContainText('M');
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
  // The confirmation sheet covers the bar while open; after it closes the bar keeps a link to the cart.
  const added=page.getByRole('dialog',{name:'به سبد خرید اضافه شد'});
  await expect(added).toBeVisible();
  await expect(sticky).toBeHidden();
  await added.getByRole('button',{name:'ادامه خرید'}).click();
  await expect(sticky.getByRole('link',{name:'مشاهده سبد'})).toBeVisible();
});

test('compact size guide sits by the color-and-size CTA without crowding small phones',async ({page})=>{
  for (const width of [320,375,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/product/shomiz-01');
    const row = page.locator('.purchase-row');
    const primary = row.getByRole('button',{name:'رنگ و سایز رو انتخاب کن'});
    const guide = row.getByRole('button',{name:'راهنمای سایز'});
    await expect(primary).toBeVisible();
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute('aria-haspopup','dialog');
    const cta = await primary.boundingBox(), card = await guide.boundingBox();
    expect(cta).not.toBeNull();
    expect(card).not.toBeNull();
    expect(Math.abs(cta!.y-card!.y)).toBeLessThanOrEqual(1);
    // Direction is RTL: the first purchase-row element must appear physically to the right.
    expect(card!.x).toBeGreaterThan(cta!.x + cta!.width - 1);
    await expect(guide).toHaveCSS('background-color','rgb(249, 235, 237)');
    await expect(guide).toHaveCSS('border-top-color','rgb(214, 139, 147)');
    expect(card!.width).toBeLessThanOrEqual(75);
    expect(card!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  }
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
