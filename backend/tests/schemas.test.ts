import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { productInput } from '../src/admin/product-schema';
import { detectImage, MAX_IMAGE_BYTES } from '../src/admin/image-type';
import { cart, checkout } from '../src/validation';

const product = {
  id: 'test-01', slug: 'test-01', name: 'محصول تستی', category: 'manto', description: 'یک توضیح معتبر برای محصول',
  price: 250000, compareAt: 300000, images: ['/images/brand-preview/manto-cream.avif', '/api/media/0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.webp'],
  colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }, { id: 'navy', name: 'سرمه‌ای', hex: '#223355', familyId: 'blue' }],
  sizes: ['M', 'L'], variants: [{ colorId: 'black', size: 'M', stock: 2 }, { colorId: 'navy', size: 'L', stock: 0 }],
  material: 'نخ', fit: 'آزاد', care: 'شست‌وشوی دستی', featured: true
};
const valid = (change: object) => productInput.safeParse({ ...product, ...change }).success;

describe('product input', () => {
  it('accepts a complete product with local and uploaded photos and a color family', () => {
    assert.equal(valid({}), true);
    assert.equal(valid({ compareAt: product.price }), true, 'an original price equal to the sale price is allowed');
  });
  it('rejects malformed ids, slugs, colors and prices', () => {
    for (const change of [{ id: 'Test 01' }, { slug: '-test' }, { category: 'shoes' }, { price: -1 }, { price: 1.5 },
      { colors: [{ id: 'black', name: 'مشکی', hex: 'black' }] }, { colors: [] }, { name: 'x' }, { description: 'کوتاه' }])
      assert.equal(valid(change), false, JSON.stringify(change));
  });
  it('rejects repeated colors or sizes, and variants for an undeclared size', () => {
    assert.equal(valid({ colors: [product.colors[0], product.colors[0]], variants: [product.variants[0]] }), false);
    assert.equal(valid({ sizes: ['M', 'M'] }), false);
    assert.equal(valid({ variants: [{ colorId: 'black', size: 'XXL', stock: 1 }] }), false);
  });
  it('rejects fields it does not know, so nothing unexpected is written to the database', () => {
    assert.equal(valid({ active: true }), false);
    assert.equal(valid({ variants: [{ colorId: 'black', size: 'M', stock: 1, price: 1 }] }), false);
  });
  it('accepts at most eight photos', () => {
    assert.equal(valid({ images: Array(9).fill(product.images[0]) }), false);
  });
});

describe('image signatures', () => {
  const padded = (head: number[] | string) => Buffer.concat([Buffer.from(head as never), Buffer.alloc(32)]);
  it('recognizes JPEG and WebP by their bytes', () => {
    assert.equal(detectImage(padded([255, 216, 255, 224])), 'jpg');
    assert.equal(detectImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)])), 'webp');
  });
  it('rejects RIFF files that are not WebP, GIFs, tiny files and files at the size limit plus one', () => {
    assert.equal(detectImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(16)])), null);
    assert.equal(detectImage(padded('GIF89a')), null);
    assert.equal(detectImage(Buffer.from([255, 216, 255])), null);
    const atLimit = Buffer.alloc(MAX_IMAGE_BYTES);
    atLimit.set([255, 216, 255]);
    assert.equal(detectImage(atLimit), 'jpg');
    assert.equal(detectImage(Buffer.concat([atLimit, Buffer.alloc(1)])), null);
  });
});

describe('checkout input', () => {
  const line = { productId: 'manto-01', colorId: 'black', size: 'M', quantity: 1 };
  const order = { items: [line], shipping: 'post', payment: 'online',
    fields: { name: 'نام کامل', mobile: '09123456789', province: 'فارس', city: 'شیراز', address: 'خیابان زند، پلاک ۱۲', postal: '1234567890' } };

  it('fills in an empty note and an empty code, and trims names', () => {
    const parsed = checkout.parse({ ...order, fields: { ...order.fields, name: '  نام کامل  ' } });
    assert.equal(parsed.fields.notes, '');
    assert.equal(parsed.code, '');
    assert.equal(parsed.fields.name, 'نام کامل');
  });
  it('limits carts to 30 lines of at most 20 units', () => {
    const lines = (count: number) => Array.from({ length: count }, (_, i) => ({ ...line, size: 'S' + i }));
    assert.equal(cart.safeParse(lines(30)).success, true);
    assert.equal(cart.safeParse(lines(31)).success, false);
    assert.equal(cart.safeParse([{ ...line, quantity: 20 }]).success, true);
    assert.equal(cart.safeParse([{ ...line, quantity: 21 }]).success, false);
    assert.equal(cart.safeParse([{ ...line, quantity: 1.5 }]).success, false);
  });
  it('rejects Persian digits in the mobile and postal code: the storefront converts them first', () => {
    assert.equal(checkout.safeParse({ ...order, fields: { ...order.fields, mobile: '۰۹۱۲۳۴۵۶۷۸۹' } }).success, false);
    assert.equal(checkout.safeParse({ ...order, fields: { ...order.fields, postal: '12345 67890' } }).success, false);
  });
  it('rejects over-long notes and codes', () => {
    assert.equal(checkout.safeParse({ ...order, fields: { ...order.fields, notes: 'x'.repeat(501) } }).success, false);
    assert.equal(checkout.safeParse({ ...order, code: 'x'.repeat(33) }).success, false);
  });
});
