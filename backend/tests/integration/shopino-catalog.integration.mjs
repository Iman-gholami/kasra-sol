// Real PostgreSQL + running Fastify: the exported variants use the live inventory, not a catalog cache.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const api = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const productId = 'it-shopino-' + randomUUID();
const draftId = 'it-shopino-draft-' + randomUUID();
let variantId;

before(async () => {
  for (const [id, active] of [[productId, true], [draftId, false]]) {
    await pool.query(
      'INSERT INTO products(id,slug,name,category,description,price,compare_at,images,colors,sizes,' +
      'material,fit,care,featured,active,search_text) ' +
      "VALUES($1,$1,'محصول شاپینو','manto','توضیحات تستی',200000,250000, " +
      "'[\"/images/test.jpg\"]'::jsonb,'[{\"id\":\"black\",\"name\":\"مشکی\",\"hex\":\"#000000\"}]'::jsonb," +
      "'[\"M\"]'::jsonb,'نخ','آزاد','دستی',false,$2,'shopino test')", [id, active]);
  }
  const inserted = await pool.query(
    "INSERT INTO product_variants(product_id,color_id,size,stock) VALUES($1,'black','M',2) RETURNING id", [productId]);
  variantId = inserted.rows[0].id;
});
after(async () => {
  await pool.query('DELETE FROM products WHERE id=ANY($1::varchar[])', [[productId, draftId]]);
  await pool.end();
});

describe('Shopino live catalog', () => {
  it('publishes the product with the real variant ID, toman prices and current stock', async () => {
    const detail = await fetch(api + '/v1/shopino/products/' + productId);
    assert.equal(detail.status, 200);
    const product = await detail.json();
    assert.equal(product.id, productId);
    assert.equal(product.url, 'https://kasra.example/product/' + productId);
    assert.deepEqual(product.images, ['https://kasra.example/images/test.jpg']);
    assert.equal(product.variations[0].id, variantId);
    assert.equal(product.variations[0].price, 250000);
    assert.equal(product.variations[0].discounted_price, 200000);
    assert.equal(product.variations[0].stock_quantity, 2);

    await pool.query('UPDATE product_variants SET stock=0 WHERE id=$1', [variantId]);
    const refreshed = await (await fetch(api + '/v1/shopino/products/' + productId)).json();
    assert.equal(refreshed.variations[0].stock_quantity, 0);
  });

  it('does not return draft products and lists the active product', async () => {
    assert.equal((await fetch(api + '/v1/shopino/products/' + draftId)).status, 404);
    let found = false;
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(api + '/v1/shopino/products?page=' + page + '&per_page=100');
      assert.equal(response.status, 200);
      const products = await response.json();
      assert.ok(!products.some(product => product.id === draftId));
      found ||= products.some(product => product.id === productId);
      if (products.length < 100) break;
    }
    assert.ok(found, 'active product appears in the catalog');
  });
});
