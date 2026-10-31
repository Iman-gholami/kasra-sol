import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { shopinoCatalogRoutes, type CatalogProduct, type CatalogStore } from '../src/shopino-catalog';

const fixture: CatalogProduct = {
  id: 'manto-01', slug: 'manto-01', name: 'مانتو', category: 'manto',
  description: 'پارچه نخی <عالی> & زیبا', price: 200_000, compareAt: 250_000,
  images: ['/images/coat.jpg'], colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }],
  material: 'نخ', fit: 'آزاد', care: 'شست‌وشوی دستی',
  variants: [
    { id: '3f1e4b46-1161-4f92-a6de-e527a55c6e35', colorId: 'black', size: 'M', stock: 3 },
    { id: 'e38542d2-2a88-49e8-8391-c92f90660dcc', colorId: 'black', size: 'L', stock: 0 }
  ]
};

function setup(siteUrl = 'https://kasra.example') {
  const calls: unknown[] = [];
  const store: CatalogStore = {
    async list(page, perPage) { calls.push({ page, perPage }); return page === 1 ? [fixture] : []; },
    async get(id) { calls.push(id); return id === fixture.id ? fixture : null; }
  };
  const app = Fastify();
  app.register(shopinoCatalogRoutes, { store, siteUrl });
  return { app, calls };
}

describe('Shopino catalog', () => {
  it('returns the required product, prices, stock and distinct variant IDs', async () => {
    const { app, calls } = setup();
    try {
      const response = await app.inject('/v1/shopino/products?page=1&per_page=20');
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.deepEqual(calls, [{ page: 1, perPage: 20 }]);
      const [product] = response.json();
      assert.equal(product.id, 'manto-01');
      assert.equal(product.title, 'مانتو');
      assert.deepEqual(product.categories, ['مانتو']);
      assert.equal(product.url, 'https://kasra.example/product/manto-01');
      assert.deepEqual(product.images, ['https://kasra.example/images/coat.jpg']);
      assert.equal(product.description, 'پارچه نخی &lt;عالی&gt; &amp; زیبا');
      assert.deepEqual(product.specs.find((spec: { name: string }) => spec.name === 'جنس'), { name: 'جنس', value: 'نخ' });
      assert.equal(product.variations.length, 2);
      assert.deepEqual(product.variations[0], {
        id: '3f1e4b46-1161-4f92-a6de-e527a55c6e35', price: 250_000, discounted_price: 200_000,
        stock_quantity: 3, images: [], attributes: [
          { key: 'size', name: 'سایز', value: 'M' },
          { key: 'color', name: 'رنگ', value: 'مشکی' }
        ]
      });
      assert.equal(product.variations[1].stock_quantity, 0);
    } finally { await app.close(); }
  });

  it('fetches the same shape by product ID and does not treat a missing product as available', async () => {
    const { app } = setup();
    try {
      const list = (await app.inject('/v1/shopino/products')).json();
      const detail = await app.inject('/v1/shopino/products/manto-01');
      assert.deepEqual(detail.json(), list[0]);
      assert.equal((await app.inject('/v1/shopino/products/missing')).statusCode, 404);
    } finally { await app.close(); }
  });

  it('returns an empty last page and rejects invalid pagination before querying', async () => {
    const { app, calls } = setup();
    try {
      assert.deepEqual((await app.inject('/v1/shopino/products?page=2')).json(), []);
      assert.equal((await app.inject('/v1/shopino/products?page=0')).statusCode, 400);
      assert.equal((await app.inject('/v1/shopino/products?per_page=101')).statusCode, 400);
      assert.equal(calls.length, 1);
    } finally { await app.close(); }
  });

  it('fails closed if the store URL is not configured', async () => {
    const { app, calls } = setup('');
    try {
      assert.equal((await app.inject('/v1/shopino/products')).statusCode, 503);
      assert.equal(calls.length, 0);
    } finally { await app.close(); }
  });
});
