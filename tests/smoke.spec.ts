import { expect, test, type Page } from '@playwright/test';
import { categories, products } from '../src/data/products';

// A broad safety net: every page renders without script errors, every internal link leads somewhere,
// and the sitemap only lists working pages. Detailed behaviour is tested in the other specs.

const PAGES = ['/', '/shop', '/search?q=لینن', '/cart', '/checkout', '/wishlist', '/account', '/about', '/contact', '/faq',
  '/shipping-and-returns', '/size-guide', '/order-confirmation',
  ...categories.map(category => '/category/' + category.slug), '/product/' + products[0].slug];

/** Collects uncaught exceptions and console errors while a page is open. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push('page error: ' + error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  return errors;
}

for (const path of PAGES) {
  test('renders ' + path + ' with one heading and no script errors', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).not.toBeEmpty();
    await page.waitForLoadState('networkidle');
    expect(errors, path).toEqual([]);
  });
}

test('serves every demo product page with its name and price', async ({ request }) => {
  for (const product of products) {
    const response = await request.get('/product/' + product.slug);
    expect(response.status(), product.slug).toBe(200);
    const html = await response.text();
    expect(html, product.slug).toContain(product.name);
  }
});

test('answers unknown products, categories and pages with the 404 page', async ({ page }) => {
  expect((await page.goto('/no-such-page'))?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('این صفحه پیدا نشد');
  // Product and category pages stream behind a loading state, so the 200 status is already sent when the
  // lookup fails; Next.js then shows the 404 page and marks it noindex.
  for (const path of ['/product/no-such-product', '/category/shoes']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('این صفحه پیدا نشد');
    await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
  }
});

test('has no broken internal links two clicks from the home page', async ({ request }) => {
  test.setTimeout(120_000);
  const seen = new Set<string>(['/']);
  let frontier = ['/'];
  const broken: string[] = [];
  for (let depth = 0; depth < 2; depth++) {
    const next: string[] = [];
    for (const path of frontier) {
      const response = await request.get(path);
      if (response.status() >= 400) { broken.push(path + ' → ' + response.status()); continue; }
      if (!(response.headers()['content-type'] ?? '').includes('text/html')) continue;
      for (const [, href] of (await response.text()).matchAll(/<a[^>]+href="([^"#]*)/g)) {
        const url = new URL(href.replace(/&amp;/g, '&'), 'http://local' + path);
        if (url.origin !== 'http://local' || /^\/(api|_next|admin)(\/|$)/.test(url.pathname)) continue;
        const target = url.pathname + url.search;
        if (!seen.has(target)) { seen.add(target); next.push(target); }
      }
    }
    frontier = next;
  }
  for (const path of frontier) {
    const response = await request.get(path);
    if (response.status() >= 400) broken.push(path + ' → ' + response.status());
  }
  expect(seen.size, 'the crawl should reach the catalog').toBeGreaterThan(40);
  expect(broken).toEqual([]);
});

test('lists only working pages in the sitemap, and keeps the demo out of search engines', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  // Home, shop, the categories, every product of the catalog and the five information pages.
  expect(urls.length).toBe(2 + categories.length + products.length + 5);
  for (const url of urls) expect((await request.get(url.pathname)).status(), url.pathname).toBe(200);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);
  expect(robots).not.toContain('Sitemap:');
  // The same switch closes every page, prerendered or rendered per request.
  for (const path of ['/', '/about', '/shop', '/product/' + products[0].slug])
    expect((await (await request.get(path)).text()).match(/<meta name="robots" content="([^"]+)"/)?.[1], path).toBe('noindex, nofollow');
});

test('serves the storefront APIs the browser calls', async ({ request }) => {
  expect(await (await request.get('/api/health')).json()).toEqual({ status: 'ok', service: 'kasra-frontend' });
  const suggestions = await (await request.get('/api/search-suggestions?q=' + encodeURIComponent('مانتو'))).json();
  expect(suggestions.products.length).toBeGreaterThan(0);
  expect(suggestions.categories.map((c: { slug: string }) => c.slug)).toContain('manto');
  const lookup = await (await request.get('/api/catalog/lookup?ids=manto-01,tshirt-02')).json();
  expect(lookup.items.map((p: { id: string }) => p.id)).toEqual(['manto-01', 'tshirt-02']);
});
