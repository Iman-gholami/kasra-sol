import { expect, test, type APIRequestContext } from '@playwright/test';
import { products } from '../src/data/products';

// What a messenger sees when a customer pastes a link: these are the agents of the link-preview fetchers (Bale's,
// Eitaa's and others' are not published, so plain HTTP clients stand in for them). Many read only <head>, and all of
// them show JPEG; the storefront's photos are AVIF/WebP. A real preview check in the apps is in docs/SEO.md.
const FETCHERS = {
  telegram: 'TelegramBot (like TwitterBot)',
  whatsapp: 'WhatsApp/2.24.20.80 A',
  instagram: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'android app (okhttp)': 'okhttp/4.12.0',
  'flutter app': 'Dart/3.5 (dart:io)',
  curl: 'curl/8.9.1'
};
const product = products.find(item => item.compareAt)!;

function head(html: string) {
  const end = html.indexOf('</head>');
  expect(end, 'the page has a head').toBeGreaterThan(0);
  const part = html.slice(0, end);
  const meta = (key: string) => new RegExp('<meta (?:property|name)="' + key + '" content="([^"]*)"').exec(part)?.[1];
  return { meta, canonical: /<link rel="canonical" href="([^"]+)"/.exec(part)?.[1] };
}

/** The share image a previewer would download: a 1200×630 JPEG under WhatsApp's ~300 KB limit. */
async function expectShareImage(request: APIRequestContext, url: string | undefined) {
  expect(url, 'og:image').toMatch(/^https?:\/\//);
  const response = await request.get(new URL(url!).pathname);
  expect(response.status(), url).toBe(200);
  expect(response.headers()['content-type']).toBe('image/jpeg');
  const bytes = await response.body();
  expect(bytes.length).toBeLessThanOrEqual(280 * 1024);
  let at = 2;
  while (at < bytes.length && !(bytes[at + 1] >= 0xc0 && bytes[at + 1] <= 0xc3)) at += 2 + bytes.readUInt16BE(at + 2);
  expect({ width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) }).toEqual({ width: 1200, height: 630 });
}

for (const [name, agent] of Object.entries(FETCHERS)) {
  test('a ' + name + ' preview of the home page shows its card and text', async ({ request }) => {
    const { meta, canonical } = head(await (await request.get('/', { headers: { 'User-Agent': agent } })).text());
    expect(meta('og:title')).toBe('کسری بوتیک | استایل هر روزت، به سبک خودت');
    expect(meta('og:description')).toContain('شومیز، مانتو و تیشرت زنانه');
    expect(meta('og:site_name')).toBe('کسری بوتیک');
    expect(meta('og:locale')).toBe('fa_IR');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(new URL(meta('og:url')!).pathname).toBe('/');
    expect(new URL(canonical!).pathname).toBe('/');
    expect(meta('og:image')).toMatch(/\/images\/share\/kasra-boutique\.jpg$/);
    await expectShareImage(request, meta('og:image'));
  });

  test('a ' + name + ' preview of a product shows its name and a JPEG of its photo', async ({ request }) => {
    const html = await (await request.get('/product/' + product.slug, { headers: { 'User-Agent': agent } })).text();
    const { meta, canonical } = head(html);
    expect(meta('og:title')).toBe(product.name + ' | کسری بوتیک');
    expect(meta('og:description')).toBe(product.description);
    expect(new URL(canonical!).pathname).toBe('/product/' + product.slug);
    expect(new URL(meta('og:url')!).pathname).toBe('/product/' + product.slug);
    expect(meta('og:image'), 'not the AVIF photo').toMatch(/\.jpg$/);
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    await expectShareImage(request, meta('og:image'));
  });
}

test('gives the main pages their canonical address, without filters, sorting or paging', async ({ request }) => {
  const cases = { '/shop?sort=newest&page=2': '/shop', '/category/manto?color=black&size=M': '/category/manto', '/about': '/about',
    '/faq': '/faq', '/contact': '/contact', '/size-guide': '/size-guide', '/shipping-and-returns': '/shipping-and-returns',
    ['/product/' + product.slug]: '/product/' + product.slug };
  for (const [path, canonical] of Object.entries(cases)) {
    const html = await (await request.get(path, { headers: { 'User-Agent': FETCHERS.curl } })).text();
    expect(new URL(head(html).canonical ?? 'http://x/missing').pathname, path).toBe(canonical);
  }
  const cart = await (await request.get('/cart', { headers: { 'User-Agent': FETCHERS.curl } })).text();
  expect(head(cart).canonical, 'private pages have none').toBeUndefined();
});

test('describes a product as a schema.org Product with an Offer from its data', async ({ request }) => {
  const html = await (await request.get('/product/' + product.slug)).text();
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  const data = scripts.find(item => item['@type'] === 'Product');
  expect(data, 'Product JSON-LD').toBeTruthy();
  expect(data.name).toBe(product.name);
  expect(data.sku).toBe(product.id);
  expect(data.offers).toMatchObject({ '@type': 'Offer', price: product.price * 10, priceCurrency: 'IRR',
    availability: 'https://schema.org/InStock' });
  expect(data.offers.priceSpecification[1].price).toBe(product.compareAt! * 10);
  expect(new URL(data.url).pathname).toBe('/product/' + product.slug);
  for (const image of data.image) expect(image).toMatch(/^https?:\/\/[^/]+\/images\//);
});
