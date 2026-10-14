import {expect,test} from '@playwright/test';

test('shop by color position, dataset colors, default cream and four preview products',async ({page})=>{
  await page.goto('/');
  const section=page.getByRole('region',{name:'خرید بر اساس رنگ'});
  await expect(section).toBeVisible();
  const tops=await Promise.all([
    page.locator('.category-section'),section,page.locator('section[aria-labelledby="arrivals-title"]')
  ].map(locator=>locator.evaluate(el=>el.getBoundingClientRect().top+window.scrollY)));
  expect(tops[0]).toBeLessThan(tops[1]);
  expect(tops[1]).toBeLessThan(tops[2]);
  await expect(section.getByRole('button',{name:/نمایش محصولات رنگ/})).toHaveCount(6);
  await expect(section.getByRole('button',{name:'نمایش محصولات رنگ کرم'})).toHaveAttribute('aria-pressed','true');
  await expect(section.locator('.product-card')).toHaveCount(4);
  await expect(section.locator('.price-line strong').first()).toContainText('تومان');
  await expect(section.getByRole('link',{name:/مشاهده همه محصولات این رنگ/})).toHaveAttribute('href','/shop?color=cream');
  await expect(section.getByText('عکس‌ها نمونه‌اند',{exact:false})).toBeVisible();
});

test('selecting a color updates cards, preserves wishlist and links to filtered catalog',async ({page})=>{
  await page.goto('/');
  const section=page.getByRole('region',{name:'خرید بر اساس رنگ'});
  const creamCards=await section.locator('.product-info h3').allTextContents();
  const initialUrl=page.url();
  const black=section.getByRole('button',{name:'نمایش محصولات رنگ مشکی'});
  await black.focus();
  await page.keyboard.press('Enter');
  await expect(black).toHaveAttribute('aria-pressed','true');
  await expect(section.locator('.product-card')).toHaveCount(4);
  expect(await section.locator('.product-info h3').allTextContents()).not.toEqual(creamCards);
  expect(page.url()).toBe(initialUrl);
  const first=section.locator('.product-card').first();
  const name=await first.locator('h3').innerText();
  await first.getByRole('button',{name:/افزودن به علاقه‌مندی‌ها/}).click();
  await section.getByRole('link',{name:/مشاهده همه محصولات این رنگ/}).click();
  await expect(page).toHaveURL(/\/shop\?color=black/);
  await expect(page.locator('.product-card').getByText(name)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(initialUrl);
  await page.goto('/wishlist');
  await expect(page.locator('.product-card').getByText(name)).toBeVisible();
});

test('every preview is contained in its server filtered catalog, multi-colored items match actual variants',async ({page})=>{
  const colors:[string,string][]=[
    ['cream','کرم'],['white','سفید'],['black','مشکی'],
    ['rose','رز خاکی'],['blue','آبی دودی'],['sage','سبز سدری']
  ];
  for(const [id,label] of colors){
    await page.goto('/');
    const section=page.getByRole('region',{name:'خرید بر اساس رنگ'});
    await section.getByRole('button',{name:'نمایش محصولات رنگ '+label}).click();
    const names=await section.locator('.product-info h3').allTextContents();
    expect(names).toHaveLength(4);
    await expect(section.getByRole('link',{name:/مشاهده همه محصولات این رنگ/}))
      .toHaveAttribute('href','/shop?color='+id);
    await page.goto('/shop?color='+id);
    const catalog=await page.locator('.product-info h3').allTextContents();
    names.forEach(name=>expect(catalog).toContain(name));
  }
  for(const color of ['cream','rose','blue']){
    await page.goto('/shop?color='+color);
    await expect(page.locator('.product-card').getByText('شومیز لینن آوید')).toBeVisible();
  }
  await page.goto('/shop?color=black');
  await expect(page.locator('.product-card').getByText('شومیز لینن آوید')).toHaveCount(0);
});

test('shop by color avoids horizontal overflow in six responsive widths',async ({page})=>{
  for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    const section=page.getByRole('region',{name:'خرید بر اساس رنگ'});
    await section.getByRole('button',{name:'نمایش محصولات رنگ آبی دودی'}).click();
    await expect(section.getByRole('button',{name:'نمایش محصولات رنگ آبی دودی'}))
      .toHaveAttribute('aria-pressed','true');
    await expect(section.locator('.product-card')).toHaveCount(4);
    const d=await page.evaluate(()=>{
      const row=document.querySelector('.shop-color-scroll')!;
      return {
        doc:document.documentElement.scrollWidth,
        vw:window.innerWidth,
        scroll:row.scrollWidth,
        client:row.clientWidth,
        columns:getComputedStyle(document.querySelector('.shop-color-product-grid .product-grid')!).gridTemplateColumns.split(' ').length
      };
    });
    expect(d.doc).toBeLessThanOrEqual(width+1);
    expect(d.columns).toBe(width<=820?2:4);
    if(width<=430)expect(d.scroll).toBeGreaterThan(d.client);
  }
});
