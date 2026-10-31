import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { products } from '@/data/products';
import { HOME_SHARE, pageMetadata, SITE_NAME } from '@/lib/seo';
import { HOME_SHARE_IMAGE, shareImageFor, SHARE_SIZE } from '@/lib/share-image';
import { jsonLd, productJsonLd } from '@/lib/structured-data';
import type { Product } from '@/types/store';

const PUBLIC = join(import.meta.dirname, '..', 'public');
/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(bytes: Buffer) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'a JPEG file');
  for (let at = 2; at < bytes.length;) {
    const marker = bytes.readUInt16BE(at), length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  throw new Error('no frame header');
}

describe('share images for messenger link previews', () => {
  it('uses the JPEG the API stores next to each uploaded WebP, and keeps older JPEG/PNG uploads as they are', () => {
    const id = '0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e';
    assert.deepEqual(shareImageFor('/api/media/' + id + '.webp'), { url: '/api/media/' + id + '.jpg', card: true });
    assert.deepEqual(shareImageFor('/api/media/' + id + '.jpg'), { url: '/api/media/' + id + '.jpg', card: false });
    assert.deepEqual(shareImageFor('/api/media/' + id + '.png'), { url: '/api/media/' + id + '.png', card: false });
    for (const other of [undefined, '', '/images/hero.svg', 'https://evil.test/x.avif', '/api/media/../x.webp'])
      assert.equal(shareImageFor(other), undefined, String(other));
  });

  it('has a committed 1200×630 JPEG, small enough for WhatsApp, for the photo of every demo product and the home page', () => {
    const files = new Set([HOME_SHARE_IMAGE, ...products.map(product => shareImageFor(product.images[0])!.url)]);
    assert.ok(files.size > 1);
    for (const file of files) {
      assert.ok(existsSync(join(PUBLIC, file)), file + ' is missing: run npx tsx scripts/share-images.mts');
      const bytes = readFileSync(join(PUBLIC, file));
      assert.deepEqual(jpegSize(bytes), SHARE_SIZE, file);
      assert.ok(bytes.length <= 280 * 1024, file + ' is ' + bytes.length + ' bytes');
    }
  });
});

describe('canonical address and link-preview tags of a main page', () => {
  it('give the page its canonical address and the complete set of Open Graph tags', () => {
    const meta = pageMetadata({ path: '/shop', title: 'همه محصولات | ' + SITE_NAME });
    assert.deepEqual(meta.alternates, { canonical: '/shop' });
    assert.deepEqual(meta.openGraph, { type: 'website', siteName: SITE_NAME, locale: 'fa_IR', url: '/shop',
      title: 'همه محصولات | ' + SITE_NAME, description: HOME_SHARE.description,
      images: [{ url: HOME_SHARE_IMAGE, ...SHARE_SIZE, alt: SITE_NAME }] });
    assert.equal((meta.twitter as { card: string }).card, 'summary_large_image');
  });

  it('use the share image they are given', () => {
    const image = { url: '/images/share/lookbook-manto-black.jpg', ...SHARE_SIZE, alt: 'مانتو' };
    const meta = pageMetadata({ path: '/product/manto-01', title: 'مانتو', description: 'توضیح', image });
    assert.deepEqual((meta.openGraph as { images: unknown[] }).images, [image]);
    assert.equal((meta.openGraph as { description: string }).description, 'توضیح');
  });
});

describe('Product structured data', () => {
  const base = 'https://kasraboutique.ir';
  const product: Product = { ...products.find(item => item.compareAt)!, id: 'manto-01', slug: 'manto-01', price: 1_090_000,
    compareAt: 1_310_000, images: ['/api/media/0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.webp', '/images/lookbook/manto-sage.avif'] };

  it('describes the product with its real data, absolute photo addresses and the brand', () => {
    const data = productJsonLd(product, base, 'مانتو');
    assert.equal(data['@type'], 'Product');
    assert.equal(data.url, base + '/product/manto-01');
    assert.equal(data.name, product.name);
    assert.equal(data.description, product.description);
    assert.equal(data.sku, 'manto-01');
    assert.equal(data.category, 'مانتو');
    assert.deepEqual(data.image, [base + '/api/media/0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.webp', base + '/images/lookbook/manto-sage.avif']);
    assert.deepEqual(data.brand, { '@type': 'Brand', name: SITE_NAME });
    assert.equal(data.color, product.colors.map(color => color.name).join('، '));
  });

  it('offers it in rial (ISO 4217; the store keeps toman), with the crossed-out price of a discount', () => {
    const { offers } = productJsonLd(product, base);
    assert.equal(offers['@type'], 'Offer');
    assert.equal(offers.price, 10_900_000);
    assert.equal(offers.priceCurrency, 'IRR');
    assert.equal(offers.url, base + '/product/manto-01');
    assert.equal(offers.itemCondition, 'https://schema.org/NewCondition');
    assert.deepEqual(offers.priceSpecification?.[1], { '@type': 'UnitPriceSpecification', price: 13_100_000, priceCurrency: 'IRR',
      priceType: 'https://schema.org/StrikethroughPrice' });
    assert.equal(productJsonLd({ ...product, compareAt: undefined }, base).offers.priceSpecification, undefined);
  });

  it('is in stock while any colour and size has units left', () => {
    assert.equal(productJsonLd(product, base).offers.availability, 'https://schema.org/InStock');
    const soldOut = { ...product, variants: product.variants.map(variant => ({ ...variant, stock: 0 })) };
    assert.equal(productJsonLd(soldOut, base).offers.availability, 'https://schema.org/OutOfStock');
  });

  it('cannot be broken out of its script element by a product name', () => {
    const script = jsonLd(productJsonLd({ ...product, name: '</script><script>alert(1)</script>' }, base));
    assert.ok(!script.includes('</script>'));
    assert.equal(JSON.parse(script).name, '</script><script>alert(1)</script>');
  });
});
