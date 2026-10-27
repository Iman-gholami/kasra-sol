import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZE, parseFilters, queryProducts } from '@/lib/catalog';
import { catalogHref, sortLabels } from '@/lib/catalog-url';
import { variantMatchesColorFamily } from '@/lib/shop-by-color';
import { rankProduct } from '@/lib/search';
import type { CatalogFilters, Product } from '@/types/store';
import { json, setEnv, stubFetch } from './helpers';

const demo = { BACKEND_INTERNAL_URL: undefined };

/** Every product matching the filters, across all pages. */
async function everything(filters: CatalogFilters) {
  const first = await queryProducts({ ...filters, page: 1 });
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page++) items.push(...(await queryProducts({ ...filters, page })).items);
  assert.equal(items.length, first.total);
  return items;
}
const sellable = (product: Product, filters: CatalogFilters) => product.variants.filter(v =>
  (!filters.size || v.size === filters.size) && (!filters.color || variantMatchesColorFamily(product, v.colorId, filters.color)));

describe('parseFilters (demo catalog)', () => {
  it('defaults to the featured sort on page one with no filters', t => {
    setEnv(t, demo);
    assert.deepEqual(parseFilters({}), {
      category: undefined, q: undefined, size: undefined, color: undefined, min: undefined, max: undefined,
      inStock: false, discounted: false, sort: 'featured', page: 1
    });
  });

  it('accepts only known categories, and a page category wins over the query string', t => {
    setEnv(t, demo);
    assert.equal(parseFilters({ category: 'manto' }).category, 'manto');
    assert.equal(parseFilters({ category: 'shoes' }).category, undefined);
    assert.equal(parseFilters({ category: 'manto' }, 'tshirt').category, 'tshirt');
  });

  it('trims the search text and caps it at 100 characters', t => {
    setEnv(t, demo);
    assert.equal(parseFilters({ q: '  لینن  ' }).q, 'لینن');
    assert.equal(parseFilters({ q: 'ا'.repeat(300) }).q?.length, 100);
  });

  it('accepts only sizes and color families that exist in the demo catalog', t => {
    setEnv(t, demo);
    assert.equal(parseFilters({ size: 'M' }).size, 'M');
    assert.equal(parseFilters({ size: 'XXL' }).size, undefined);
    assert.equal(parseFilters({ color: 'black' }).color, 'black');
    assert.equal(parseFilters({ color: 'gold' }).color, undefined);
  });

  it('reads prices typed with Persian digits and thousands separators, and drops nonsense', t => {
    setEnv(t, demo);
    assert.equal(parseFilters({ min: '۱٬۰۰۰٬۰۰۰' }).min, 1_000_000);
    assert.equal(parseFilters({ max: '1,500,000' }).max, 1_500_000);
    assert.equal(parseFilters({ min: '١٢٣' }).min, 123);
    for (const value of ['-5', 'abc', '1.5', '', '99999999999999999999'])
      assert.equal(parseFilters({ min: value }).min, undefined, value);
  });

  it('turns stock=1 and sale=1 into flags, and nothing else', t => {
    setEnv(t, demo);
    assert.equal(parseFilters({ stock: '1', sale: '1' }).inStock, true);
    assert.equal(parseFilters({ stock: '1', sale: '1' }).discounted, true);
    assert.equal(parseFilters({ stock: 'true', sale: 'yes' }).inStock, false);
    assert.equal(parseFilters({ stock: 'true', sale: 'yes' }).discounted, false);
  });

  it('falls back to the featured sort and clamps the page between 1 and 1000', t => {
    setEnv(t, demo);
    for (const sort of ['newest', 'price-asc', 'price-desc', 'featured'] as const)
      assert.equal(parseFilters({ sort }).sort, sort);
    assert.equal(parseFilters({ sort: 'random' }).sort, 'featured');
    assert.equal(parseFilters({ page: '3' }).page, 3);
    assert.equal(parseFilters({ page: '0' }).page, 1);
    assert.equal(parseFilters({ page: '۵' }).page, 5);
    assert.equal(parseFilters({ page: '50000' }).page, 1000);
    assert.equal(parseFilters({ page: 'last' }).page, 1);
  });

  it('uses the first value of a repeated parameter', t => {
    setEnv(t, demo);
    assert.equal(parseFilters({ category: ['manto', 'tshirt'], size: ['L', 'S'] }).category, 'manto');
    assert.equal(parseFilters({ category: ['manto', 'tshirt'], size: ['L', 'S'] }).size, 'L');
  });
});

describe('parseFilters (live catalog)', () => {
  it('accepts any reasonable size and slug-shaped color, which the demo data may not contain', t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    assert.equal(parseFilters({ size: ' 38 ' }).size, '38');
    assert.equal(parseFilters({ size: 'x'.repeat(21) }).size, undefined);
    assert.equal(parseFilters({ color: 'navy-blue' }).color, 'navy-blue');
    for (const color of ['Navy', '-navy', 'a', 'navy blue', '<script>'])
      assert.equal(parseFilters({ color }).color, undefined, color);
  });
});

describe('queryProducts (demo catalog)', () => {
  it('pages twelve products at a time and clamps a page past the end', async t => {
    setEnv(t, demo);
    const first = await queryProducts(parseFilters({}));
    assert.deepEqual([first.total, first.page, first.pages, first.items.length], [36, 1, 3, PAGE_SIZE]);
    const beyond = await queryProducts(parseFilters({ page: '99' }));
    assert.equal(beyond.page, 3);
    assert.equal(beyond.items.length, PAGE_SIZE);
    const empty = await queryProducts({ q: 'qwertyuiop', page: 1 });
    assert.deepEqual([empty.total, empty.page, empty.pages, empty.items.length], [0, 1, 1, 0]);
  });

  it('never shows a product twice or loses one across pages', async t => {
    setEnv(t, demo);
    const all = await everything({ sort: 'featured' });
    assert.equal(new Set(all.map(p => p.id)).size, 36);
  });

  const cases: [string, CatalogFilters, (p: Product, f: CatalogFilters) => boolean][] = [
    ['category', { category: 'manto' }, p => p.category === 'manto'],
    ['price range', { min: 1_000_000, max: 1_500_000 }, p => p.price >= 1_000_000 && p.price <= 1_500_000],
    ['on sale', { discounted: true }, p => (p.compareAt ?? 0) > p.price],
    ['size', { size: 'S' }, (p, f) => sellable(p, f).length > 0],
    ['color family', { color: 'cream' }, (p, f) => sellable(p, f).length > 0],
    ['in stock in that size and color', { size: 'S', color: 'black', inStock: true },
      (p, f) => sellable(p, f).some(v => v.stock > 0)],
    ['search', { q: 'لینن' }, p => rankProduct(p, 'لینن') !== null]
  ];
  for (const [name, filters, matches] of cases) {
    it('filters by ' + name + ': every match and only matches', async t => {
      setEnv(t, demo);
      const { products } = await import('@/data/products');
      const found = await everything(filters);
      assert.ok(found.length > 0, 'the demo data should exercise this filter');
      assert.deepEqual(found.map(p => p.id).sort(), products.filter(p => matches(p, filters)).map(p => p.id).sort());
    });
  }

  it('hides a product whose chosen color and size is sold out only when in-stock is required', async t => {
    setEnv(t, demo);
    const { products } = await import('@/data/products');
    const product = products.find(p => p.variants.some(v => v.stock === 0))!;
    const { colorId, size } = product.variants.find(v => v.stock === 0)!;
    assert.ok((await everything({ size, color: colorId })).some(p => p.id === product.id));
    assert.ok(!(await everything({ size, color: colorId, inStock: true })).some(p => p.id === product.id));
  });

  it('sorts by price, by date and by featured-then-newest', async t => {
    setEnv(t, demo);
    const prices = (await everything({ sort: 'price-asc' })).map(p => p.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    const descending = (await everything({ sort: 'price-desc' })).map(p => p.price);
    assert.deepEqual(descending, [...prices].reverse());
    const dates = (await everything({ sort: 'newest' })).map(p => p.createdAt);
    assert.deepEqual(dates, [...dates].sort().reverse());
    const featured = await everything({ sort: 'featured' });
    const firstPlain = featured.findIndex(p => !p.featured);
    assert.ok(firstPlain > 0 && featured.slice(firstPlain).every(p => !p.featured), 'featured products come first');
  });

  it('puts the best name matches first when searching', async t => {
    setEnv(t, demo);
    const found = await everything({ q: 'لینن', sort: 'featured' });
    const scores = found.map(p => rankProduct(p, 'لینن')!);
    assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
    assert.equal(scores[0], 20);
  });
});

describe('queryProducts (live catalog)', () => {
  it('forwards every filter to the API and returns its answer', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const answer = { items: [], total: 0, page: 2, pages: 2 };
    const calls = stubFetch(t, () => json(answer));
    const result = await queryProducts({ category: 'manto', q: 'لینن', size: 'M', color: 'black', min: 0, max: 900,
      inStock: true, discounted: true, sort: 'price-asc', page: 2 });
    assert.deepEqual(result, answer);
    const url = new URL(calls[0].url);
    assert.equal(url.origin + url.pathname, 'http://api.test/v1/products');
    assert.deepEqual(Object.fromEntries(url.searchParams), { category: 'manto', q: 'لینن', size: 'M', color: 'black',
      min: '0', max: '900', stock: '1', sale: '1', sort: 'price-asc', page: '2' });
    assert.equal(calls[0].init.cache, 'no-store');
  });

  it('sends only the filters that are set, and page 1 by default', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const calls = stubFetch(t, () => json({ items: [], total: 0, page: 1, pages: 1 }));
    await queryProducts({});
    assert.equal(new URL(calls[0].url).search, '?page=1');
  });

  it('fails loudly when the API is unavailable, so the error page is shown instead of an empty shop', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    stubFetch(t, () => json({ error: 'down' }, { status: 503 }));
    await assert.rejects(queryProducts({}), /503/);
  });
});

describe('catalogHref', () => {
  it('writes the catalog query contract and omits defaults', () => {
    assert.equal(catalogHref('/shop', {}), '/shop');
    assert.equal(catalogHref('/shop', { sort: 'featured' }), '/shop');
    assert.equal(catalogHref('/shop', { category: 'manto', q: 'لینن', size: 'M', color: 'black', min: 0, max: 900,
      inStock: true, discounted: true, sort: 'newest' }),
    '/shop?category=manto&q=%D9%84%DB%8C%D9%86%D9%86&size=M&color=black&min=0&max=900&stock=1&sale=1&sort=newest');
  });

  it('leaves the category out on a category page, where it is part of the path', () => {
    assert.equal(catalogHref('/category/manto', { category: 'manto', size: 'L' }, true), '/category/manto?size=L');
  });

  it('applies overrides last: a value replaces, null removes', () => {
    const filters: CatalogFilters = { category: 'manto', size: 'M', sort: 'price-asc' };
    assert.equal(catalogHref('/shop', filters, false, { page: '2', size: null }), '/shop?category=manto&sort=price-asc&page=2');
  });

  it('round-trips through parseFilters', t => {
    setEnv(t, demo);
    const filters: CatalogFilters = { category: 'tshirt', q: 'پنبه', size: 'XL', color: 'white', min: 100, max: 5_000_000,
      inStock: true, discounted: true, sort: 'price-desc', page: 4 };
    const href = catalogHref('/shop', filters, false, { page: '4' });
    assert.deepEqual(parseFilters(Object.fromEntries(new URL(href, 'http://x').searchParams)), filters);
  });

  it('has a Persian label for every sort option', () => {
    assert.deepEqual(Object.keys(sortLabels).sort(), ['featured', 'newest', 'price-asc', 'price-desc']);
  });
});
