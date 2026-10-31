import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { json, setEnv, stubFetch } from './helpers';
import { indexingEnabled, PRIVATE_PATHS, robotsMeta, siteUrl } from '@/lib/seo';
import robots from '@/app/robots';

// The sitemap is built from the live catalog; the loaders read BACKEND_INTERNAL_URL when their module loads.
process.env.BACKEND_INTERNAL_URL = 'http://api.test';
let sitemap: typeof import('@/app/sitemap').default;
before(async () => { sitemap = (await import('@/app/sitemap')).default; });

const LAUNCHED = { NEXT_PUBLIC_SITE_URL: 'https://kasraboutique.ir', NEXT_PUBLIC_SITE_INDEXABLE: 'true' };

describe('the launch switch for search engines', () => {
  it('opens only a release built with SITE_INDEXABLE=true for an HTTPS domain', () => {
    assert.equal(indexingEnabled(LAUNCHED), true);
    for (const env of [
      { ...LAUNCHED, NEXT_PUBLIC_SITE_INDEXABLE: undefined }, { ...LAUNCHED, NEXT_PUBLIC_SITE_INDEXABLE: 'false' },
      { ...LAUNCHED, NEXT_PUBLIC_SITE_INDEXABLE: 'yes' }, { ...LAUNCHED, NEXT_PUBLIC_SITE_URL: 'http://kasraboutique.ir' },
      { ...LAUNCHED, NEXT_PUBLIC_SITE_URL: 'https://185.10.20.30' }, { ...LAUNCHED, NEXT_PUBLIC_SITE_URL: 'https://localhost:3000' },
      { ...LAUNCHED, NEXT_PUBLIC_SITE_URL: 'https://[2001:db8::1]' }, { ...LAUNCHED, NEXT_PUBLIC_SITE_URL: undefined }
    ]) assert.equal(indexingEnabled(env), false, JSON.stringify(env));
  });

  it('keeps robots.txt and every page closed together until launch', t => {
    setEnv(t, { ...LAUNCHED, NEXT_PUBLIC_SITE_INDEXABLE: undefined });
    assert.deepEqual(robots(), { rules: { userAgent: '*', disallow: '/' } });
    assert.deepEqual(robotsMeta(), { index: false, follow: false }, 'the robots meta tag of src/app/layout.tsx');
  });

  it('opens robots.txt and every page together at launch, and points to the sitemap', t => {
    setEnv(t, LAUNCHED);
    const opened = robots();
    assert.deepEqual(opened.rules, { userAgent: '*', allow: ['/', '/api/media/'], disallow: PRIVATE_PATHS });
    assert.equal(opened.sitemap, 'https://kasraboutique.ir/sitemap.xml');
    assert.deepEqual(robotsMeta(), { index: true, follow: true });
    for (const path of ['/admin', '/cart', '/checkout', '/search', '/api/']) assert.ok(PRIVATE_PATHS.includes(path), path);
  });

  it('builds absolute addresses from the configured site URL', t => {
    setEnv(t, { NEXT_PUBLIC_SITE_URL: 'https://kasraboutique.ir/' });
    assert.equal(siteUrl(), 'https://kasraboutique.ir');
  });
});

describe('the sitemap', () => {
  const item = (slug: string) => ({ id: slug, slug, images: ['/api/media/' + slug + '.webp', '/api/media/second.webp'] });

  it('lists the published products the API returns now, page by page, with their first photo', async t => {
    setEnv(t, { NEXT_PUBLIC_SITE_URL: 'https://kasraboutique.ir' });
    const calls = stubFetch(t, url => {
      const page = Number(new URL(url).searchParams.get('page'));
      return json({ items: page === 1 ? [item('new-dress-01'), item('linen-shirt')] : [item('last-one')], pages: 2 });
    });
    const entries = await sitemap();
    const urls = entries.map(entry => entry.url);
    assert.deepEqual(calls.map(call => new URL(call.url).searchParams.get('page')), ['1', '2']);
    for (const slug of ['new-dress-01', 'linen-shirt', 'last-one'])
      assert.ok(urls.includes('https://kasraboutique.ir/product/' + slug), slug);
    assert.ok(!urls.includes('https://kasraboutique.ir/product/manto-01'), 'demo products the API does not return are left out');
    assert.deepEqual(entries.find(entry => entry.url.endsWith('/product/new-dress-01'))?.images,
      ['https://kasraboutique.ir/api/media/new-dress-01.webp']);
    for (const path of ['', '/shop', '/category/manto', '/category/shomiz', '/category/tshirt', '/about', '/faq', '/size-guide'])
      assert.ok(urls.includes('https://kasraboutique.ir' + path), path || '/');
    assert.equal(new Set(urls).size, urls.length, 'no duplicates');
    assert.ok(!urls.some(url => PRIVATE_PATHS.some(path => new URL(url).pathname.startsWith(path))), 'no private pages');
  });

  it('fails instead of publishing an empty sitemap when the catalog API is down', async t => {
    stubFetch(t, () => json({ error: 'down' }, { status: 503 }));
    await assert.rejects(sitemap(), /503/);
  });
});
