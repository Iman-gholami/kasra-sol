import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { json, stubFetch } from './helpers';

// The loaders read BACKEND_INTERNAL_URL once, when the module loads; this file covers the live-catalog mode.
// (The demo mode is exercised by the storefront end-to-end tests, which run without an API.)
process.env.BACKEND_INTERNAL_URL = 'http://api.test';
let loaders: typeof import('@/lib/backend-products');
before(async () => { loaders = await import('@/lib/backend-products'); });

const product = (id: string) => ({ id, slug: id });

describe('server-side catalog loaders (live API)', () => {
  it('loads one product by its encoded slug, without the Next.js data cache', async t => {
    const calls = stubFetch(t, () => json(product('manto-01')));
    assert.deepEqual(await loaders.getProductBySlug('manto 01/..'), product('manto-01'));
    assert.equal(calls[0].url, 'http://api.test/v1/products/manto%2001%2F..');
    assert.equal(calls[0].init.cache, 'no-store');
  });

  it('answers undefined for a missing product (the page shows 404) and throws when the API fails', async t => {
    let status = 404;
    stubFetch(t, () => json({ error: 'x' }, { status }));
    assert.equal(await loaders.getProductBySlug('missing-01'), undefined);
    status = 500;
    await assert.rejects(loaders.getProductBySlug('missing-02'), /500/);
  });

  it('loads the newest products for the home page', async t => {
    const calls = stubFetch(t, () => json({ items: [product('a-01')], pages: 1 }));
    assert.deepEqual(await loaders.getHomeProducts(), [product('a-01')]);
    assert.equal(calls[0].url, 'http://api.test/v1/products?limit=48&sort=newest');
  });

  it('loads the owner’s home slider pick', async t => {
    const calls = stubFetch(t, () => json({ items: [product('b-01'), product('c-01')] }));
    assert.deepEqual((await loaders.getHomeSlides()).map(p => p.id), ['b-01', 'c-01']);
    assert.equal(calls[0].url, 'http://api.test/v1/home/slider');
  });

  it('collects every catalog page, and stops after ten', async t => {
    let pages = 3;
    const calls = stubFetch(t, url => json({ items: [product('p-' + new URL(url).searchParams.get('page'))], pages }));
    assert.deepEqual((await loaders.getCatalogProducts()).map(p => p.id), ['p-1', 'p-2', 'p-3']);
    assert.equal(calls.length, 3);
    pages = 50;
    assert.equal((await loaders.getCatalogProducts()).length, 10, 'capped at 10 API pages');
  });

  it('throws when any catalog request fails, instead of rendering an incomplete store', async t => {
    stubFetch(t, () => json({}, { status: 503 }));
    await assert.rejects(loaders.getHomeProducts(), /503/);
    await assert.rejects(loaders.getHomeSlides(), /503/);
    await assert.rejects(loaders.getCatalogProducts(), /503/);
  });

  it('sends no visitor address when called outside a request', async () => {
    assert.deepEqual(await loaders.visitorHeaders(), {});
  });
});
