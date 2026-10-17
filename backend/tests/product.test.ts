import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productInput } from '../src/admin/product-schema';
import { detectImage } from '../src/admin/image-type';

const sample = {
  id: 'test-01', slug: 'test-01', name: 'محصول تستی',
  category: 'shomiz', description: 'یک توضیح معتبر برای محصول تستی',
  price: 250000, compareAt: null, images: [],
  colors: [{id:'black',name:'مشکی',hex:'#000000'}], sizes: ['M'],
  variants: [{colorId:'black',size:'M',stock:2}],
  material: 'نخ', fit: 'آزاد', care: 'شست‌وشوی دستی', featured: false
};
test('valid unpublished product accepts an empty image gallery', () => {
  assert.equal(productInput.safeParse(sample).success, true);
});
test('product validation rejects orphan and duplicate SKU variants', () => {
  assert.equal(productInput.safeParse({
    ...sample, variants: [...sample.variants, ...sample.variants]
  }).success, false);
  assert.equal(productInput.safeParse({
    ...sample, variants: [{colorId:'white',size:'M',stock:2}]
  }).success, false);
});
test('reject external image URLs, SVG and traversal', () => {
  for (const value of ['https://evil.test/pic.png', '/api/media/../secret.png', '/images/../../secret.png', '/images/malware.svg']) {
    assert.equal(productInput.safeParse({...sample, images:[value]}).success, false, value);
  }
});
test('reject a discounted price exceeding original price', () => {
  assert.equal(productInput.safeParse({...sample, compareAt:200000}).success, false);
});
test('detect binary image signatures, reject fake types and oversized files', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9focP0sAAAAASUVORK5CYII=', 'base64');
  assert.equal(detectImage(png), 'png');
  assert.equal(detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(detectImage(Buffer.alloc(2*1024*1024+1,0)), null);
});
