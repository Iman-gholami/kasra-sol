/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS CLI needs project-relative Playwright resolution. */
/* UX review capture: full-page screenshots per route/width, overlay states, and a DOM probe
 * (overflow, undersized touch targets, tiny text, heading count, fixed layers).
 * Usage: BASE_URL=http://127.0.0.1:3000 OUT_DIR=artifacts/ux node scripts/capture-ux.cjs [pages|states|probe|all]
 * Optional: WIDTHS=360,390 ROUTES=home,shop PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome
 * Screenshots are synthetic Chromium renders, not device photographs. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = requireFromProject('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const outDir = process.env.OUT_DIR || 'artifacts/ux';
const mode = process.argv[2] || 'all';
const widths = (process.env.WIDTHS || '360,390,412,768,1024,1280,1440,1920').split(',').map(Number);
const KEY = 'kasra-demo-v1';
const filled = {
  cart: [
    { productId: 'shomiz-01', colorId: 'cream', size: 'M', quantity: 1 },
    { productId: 'manto-03', colorId: 'sage', size: 'M', quantity: 2 }
  ],
  wishlist: ['shomiz-01', 'manto-03', 'tshirt-02']
};
const allRoutes = [
  ['home', '/'], ['shop', '/shop'], ['shop-filtered', '/shop?category=manto&color=black&sort=newest'],
  ['category', '/category/shomiz'], ['search-empty', '/search'], ['search-results', '/search?q=' + encodeURIComponent('شومیز سفید')],
  ['search-none', '/search?q=' + encodeURIComponent('کلمهبدوننتیجه')], ['product', '/product/shomiz-01'],
  ['cart-empty', '/cart'], ['cart-filled', '/cart', filled], ['checkout-empty', '/checkout'], ['checkout-filled', '/checkout', filled],
  ['confirmation', '/order-confirmation'], ['wishlist-empty', '/wishlist'], ['wishlist-filled', '/wishlist', filled],
  ['faq', '/faq'], ['contact', '/contact'], ['about', '/about'], ['shipping', '/shipping-and-returns'],
  ['size-guide', '/size-guide'], ['account', '/account'], ['not-found', '/this-page-does-not-exist']
];
const routeFilter = process.env.ROUTES ? new Set(process.env.ROUTES.split(',')) : null;
const routes = allRoutes.filter(([name]) => !routeFilter || routeFilter.has(name));

async function prepare(context, state) {
  await context.addInitScript(([key, value]) => {
    try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch { /* ignore */ }
  }, [KEY, state || null]);
}

async function quiet(page) {
  // Link prefetching on dynamic routes can keep the network busy; cap the idle wait.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}
async function open(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await quiet(page);
}

async function settle(page, full) {
  await page.evaluate(async () => { await document.fonts.ready; });
  if (full) {
    // Screenshot-only: start every lazy image now so full-page captures are not blank.
    await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach(img => { img.loading = 'eager'; }));
    // Walk the page so scroll-driven UI settles, then return to the top.
    await page.evaluate(async () => {
      const step = Math.max(300, innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
  }
  await page.evaluate(async () => {
    const pending = [...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }));
    await Promise.race([Promise.all(pending), new Promise(r => setTimeout(r, 4000))]);
  });
  await page.waitForTimeout(250);
}

async function newPage(browser, width, state) {
  const mobile = width <= 820;
  const context = await browser.newContext({
    viewport: { width, height: mobile ? (width <= 412 ? 844 : 1024) : (width >= 1920 ? 1080 : 900) },
    deviceScaleFactor: 1, hasTouch: mobile, isMobile: false, locale: 'fa-IR'
  });
  await prepare(context, state);
  return { context, page: await context.newPage() };
}

async function probe(page, width) {
  return page.evaluate((vw) => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
    };
    const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') +
      ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32) + '"';
    const interactive = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex]:not([tabindex="-1"])')]
      .filter(el => visible(el) && !el.closest('[inert],[aria-hidden=true]'));
    const small = interactive.map(el => {
      let r = el.getBoundingClientRect();
      // Visually hidden radio/checkbox inside a label: the label is the hit area.
      if ((el.type === 'radio' || el.type === 'checkbox') && el.closest('label')) r = el.closest('label').getBoundingClientRect();
      const inline = el.tagName === 'A' && el.closest('p,li,small') && getComputedStyle(el).display === 'inline';
      return { el: label(el), w: Math.round(r.width), h: Math.round(r.height), inline: Boolean(inline) };
    }).filter(x => x.w < 44 || x.h < 44);
    const tiny = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || seen.has(el) || !visible(el)) continue;
      seen.add(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) tiny.push({ el: label(el), size });
    }
    const layers = [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el);
      return (s.position === 'fixed' || s.position === 'sticky') && visible(el);
    }).map(el => ({ el: label(el), position: getComputedStyle(el).position, z: getComputedStyle(el).zIndex,
      top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom) }));
    const main = document.querySelector('main');
    const textBlocks = [...document.querySelectorAll('main p')].filter(visible).map(p => {
      const s = getComputedStyle(p);
      const chars = Math.round(p.getBoundingClientRect().width / (parseFloat(s.fontSize) * 0.5));
      return chars;
    });
    return {
      width: vw,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      h1: document.querySelectorAll('h1').length,
      title: document.title,
      mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null,
      pageHeight: document.documentElement.scrollHeight,
      smallTargets: small,
      tinyText: tiny.slice(0, 40),
      layers,
      maxMeasureApprox: textBlocks.length ? Math.max(...textBlocks) : null
    };
  }, width);
}

async function capturePages(browser) {
  const dir = path.join(outDir, 'pages');
  fs.mkdirSync(dir, { recursive: true });
  for (const width of widths) {
    for (const [name, route, state] of routes) {
      const { context, page } = await newPage(browser, width, state);
      try {
        await open(page, baseURL + route);
        await settle(page, true);
        await page.screenshot({ path: path.join(dir, name + '-' + width + '.png'), fullPage: true, animations: 'disabled' });
        await page.screenshot({ path: path.join(dir, name + '-' + width + '-fold.png'), fullPage: false, animations: 'disabled' });
      } catch (error) { console.error('page', name, width, error.message); }
      finally { await context.close(); }
    }
    console.log('pages done', width);
  }
}

async function captureProbe(browser) {
  const results = [];
  for (const width of widths) {
    for (const [name, route, state] of routes) {
      const { context, page } = await newPage(browser, width, state);
      try {
        await open(page, baseURL + route);
        await settle(page, false);
        results.push({ route: name, path: route, ...(await probe(page, width)) });
      } catch (error) { console.error('probe', name, width, error.message); }
      finally { await context.close(); }
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(results, null, 2));
  const summary = results.map(r => ({ route: r.route, width: r.width, overflow: r.overflow, h1: r.h1,
    small: r.smallTargets.filter(t => !t.inline).length, tiny: r.tinyText.length }));
  fs.writeFileSync(path.join(outDir, 'probe-summary.json'), JSON.stringify(summary, null, 2));
  console.log('probe rows', results.length, 'overflow', summary.filter(s => s.overflow).length);
}

async function shot(page, dir, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: false, animations: 'disabled' });
}

async function tryStep(label, fn) {
  try { await fn(); } catch (error) { console.error('state', label, error.message.split('\n')[0]); }
}

async function captureStates(browser) {
  const dir = path.join(outDir, 'states');
  fs.mkdirSync(dir, { recursive: true });
  for (const width of widths) {
    const mobile = width <= 820;
    const run = async (label, state, fn) => {
      const { context, page } = await newPage(browser, width, state);
      await tryStep(label + '-' + width, async () => { await fn(page); });
      await context.close();
    };
    if (mobile) {
      await run('menu', null, async page => {
        await page.goto(baseURL + '/', { waitUntil: 'load' }); await quiet(page);
        await page.getByRole('button', { name: /منو/ }).first().click();
        await shot(page, dir, 'menu-open-' + width);
      });
      await run('filters', null, async page => {
        await page.goto(baseURL + '/shop', { waitUntil: 'load' }); await quiet(page);
        await page.getByRole('button', { name: /فیلتر/ }).first().click();
        await shot(page, dir, 'filters-open-' + width);
      });
      await run('pdp-sticky', null, async page => {
        await page.goto(baseURL + '/product/shomiz-01', { waitUntil: 'load' }); await quiet(page);
        await shot(page, dir, 'pdp-sticky-' + width);
      });
    }
    await run('search', null, async page => {
      await page.goto(baseURL + '/', { waitUntil: 'load' }); await quiet(page);
      await page.getByRole('button', { name: /جستجو/ }).first().click();
      await shot(page, dir, 'search-open-' + width);
      await page.getByRole('combobox').fill('شومیز');
      await page.waitForTimeout(700);
      await page.keyboard.press('ArrowDown');
      await shot(page, dir, 'search-suggestions-' + width);
    });
    await run('size-guide', null, async page => {
      await page.goto(baseURL + '/product/shomiz-01', { waitUntil: 'load' }); await quiet(page);
      await page.getByRole('button', { name: 'راهنمای سایز' }).first().click();
      await shot(page, dir, 'size-guide-' + width);
    });
    await run('zoom', null, async page => {
      await page.goto(baseURL + '/product/shomiz-01', { waitUntil: 'load' }); await quiet(page);
      await page.getByRole('button', { name: /بزرگ‌نمایی تصویر/ }).first().click();
      await shot(page, dir, 'zoom-' + width);
    });
    await run('add-to-cart', null, async page => {
      await page.goto(baseURL + '/product/shomiz-01', { waitUntil: 'load' }); await quiet(page);
      await page.getByRole('button', { name: 'رنگ کرم' }).first().click();
      await page.getByRole('button', { name: 'سایز M' }).first().click();
      await page.getByRole('button', { name: /افزودن به سبد/ }).first().click();
      await shot(page, dir, 'pdp-added-' + width);
      const quick = page.getByRole('button', { name: /سبد سریع|مشاهده سبد سریع/ }).first();
      if (await quick.count()) { await quick.click(); await shot(page, dir, 'mini-cart-' + width); }
    });
    await run('checkout-errors', filled, async page => {
      await page.goto(baseURL + '/checkout', { waitUntil: 'load' }); await quiet(page);
      await page.getByRole('button', { name: /تأیید نمایشی سفارش|ثبت نمایشی/ }).first().click();
      await page.waitForTimeout(300);
      await shot(page, dir, 'checkout-errors-' + width);
    });
    if (!mobile) {
      await run('header-hover', null, async page => {
        await page.goto(baseURL + '/', { waitUntil: 'load' }); await quiet(page);
        const trigger = page.locator('.desktop-nav a, .desktop-nav button').nth(1);
        await trigger.hover();
        await shot(page, dir, 'nav-hover-' + width);
      });
    }
    console.log('states done', width);
  }
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    if (mode === 'pages' || mode === 'all') await capturePages(browser);
    if (mode === 'states' || mode === 'all') await captureStates(browser);
    if (mode === 'probe' || mode === 'all') await captureProbe(browser);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
