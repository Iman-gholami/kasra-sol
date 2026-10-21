/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser review runner. */
const fs = require('node:fs');
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const version = process.env.REVIEW_VERSION || 'after';
const out = 'artifacts/astra';
const base = 'http://127.0.0.1:3000';
const seed = { cart: [{productId:'shomiz-01',colorId:'cream',size:'M',quantity:1}], wishlist:[] };
const results = {version, pages:[], interactions:[], errors:[]};
fs.mkdirSync(out,{recursive:true});
async function capture(page, name, width) {
  await page.evaluate(async()=>{
    await document.fonts.ready;
    document.querySelectorAll('img').forEach(i=>i.loading='eager');
    await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
  });
  await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true,animations:'disabled'});
  const layout = await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dir:document.documentElement.dir,brokenImages:[...document.images].filter(i=>!i.naturalWidth).length}));
  const entry={name,width,...layout};
  if(width===390||width===1440) entry.axe=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));
  results.pages.push(entry);
  expect(layout.scrollWidth,`${name} overflow at ${width}`).toBeLessThanOrEqual(width+1);
  expect(layout.dir).toBe('rtl');
}
(async()=>{
 const browser=await chromium.launch();
 try {
  for(const width of [320,360,390,430,768,1024,1280,1440,1920]) {
   const context=await browser.newContext({viewport:{width,height:width<=430?844:900},locale:'fa-IR',reducedMotion:'reduce',hasTouch:width<=430});
   await context.addInitScript(value=>localStorage.setItem('kasra-demo-v1',JSON.stringify(value)),seed);
   const page=await context.newPage();
   page.on('pageerror',e=>results.errors.push({width,message:e.message}));
   for(const [name,route] of [['home','/'],['catalog','/shop'],['product','/product/shomiz-01'],['cart','/cart'],['checkout','/checkout'],['wishlist-empty','/wishlist'],['search-empty','/search?q=کلمهبدوننتیجه'],['faq','/faq']]) {
    await page.goto(base+route,{waitUntil:'networkidle'});
    await expect(page.locator('main h1')).toBeVisible();
    await capture(page,name,width);
   }
   if(width===390||width===1440) {
    await page.goto(base+'/checkout');
    await page.getByRole('button',{name:'ادامه و انتخاب روش پرداخت'}).click();
    await page.getByLabel('نام و نام خانوادگی تحویل‌گیرنده').fill('مهمان آزمایشی');
    await expect(page.locator('[aria-invalid=true]')).toHaveCount(5);
    const summary=await page.locator('.checkout-form-error').innerText();
    results.interactions.push({width,test:'error-count-after-one-correction',summary,invalid:5});
    if(version==='after') await expect(page.locator('.checkout-form-error')).toContainText('۵ مورد');
    await capture(page,'checkout-errors',width);
    await page.getByRole('button',{name:'پر کردن با اطلاعات نمونه'}).click();
    await expect(page.locator('.checkout-form-error')).toHaveCount(0);
    await page.getByRole('button',{name:'ادامه و انتخاب روش پرداخت'}).click();
    await expect(page.getByRole('heading',{name:'بازبینی و پرداخت'})).toBeVisible();
    await capture(page,'payment',width);
    await page.getByRole('button',{name:/^پرداخت /}).click();
    await page.getByRole('button',{name:'شبیه‌سازی پرداخت موفق'}).click();
    await expect(page.getByRole('heading',{name:'پرداخت آزمایشی موفق بود'})).toBeVisible();
    await capture(page,'confirmation',width);
    results.interactions.push({width,test:'demo-checkout',passed:true});
    await page.goto(base+'/cart');
    const save=page.getByRole('button',{name:(version==='after'?'انتقال به علاقه‌مندی‌ها، ':'ذخیره برای بعد، ')+'شومیز لینن آوید'});
    if(version==='after') await expect(save).toContainText('انتقال به علاقه‌مندی‌ها');
    await save.click();
    await expect(page.getByText('منتقل شد.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'بازگرداندن'}).click();
    await expect(page.locator('.cart-item-title')).toContainText('شومیز لینن آوید');
    results.interactions.push({width,test:'save-and-undo',passed:true});
    await page.goto(base+'/');
    if(width===390){
      const opener=page.getByRole('button',{name:'باز کردن منو'});
      await opener.click(); await expect(page.getByRole('navigation',{name:'منوی موبایل'})).toBeVisible();
      await capture(page,'menu',width); await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
      await page.goto(base+'/shop'); await page.getByRole('button',{name:'فیلتر محصولات'}).click();
      await expect(page.getByRole('dialog',{name:'فیلترهای محصولات'})).toBeVisible(); await capture(page,'filters',width); await page.keyboard.press('Escape');
    }
    await page.getByRole('button',{name:'جستجوی محصولات'}).click();
    await page.getByRole('combobox',{name:'عبارت جستجو'}).fill('شومیز');
    await expect(page.getByRole('option').first()).toBeVisible(); await capture(page,'search-dialog',width); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.goto(base+'/product/shomiz-01');
    await page.getByRole('button',{name:'راهنمای سایز',exact:true}).click(); await capture(page,'size-guide',width); await page.keyboard.press('Escape');
    await page.getByRole('button',{name:/بزرگ‌نمایی تصویر ۱/}).click(); await capture(page,'gallery',width); await page.keyboard.press('Escape');
   }
   await context.close();
  }
  expect(results.errors).toEqual([]);
 } finally { fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)); await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
