// Real PostgreSQL + running API checks for money, stock and payment-state safety.
// Requires: API at API_BASE (started with TRUST_PROXY=true) and DATABASE_URL for fixtures/assertions.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const base = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PRODUCT = 'it-orders-01';
const PRICE = 500_000;
let clientNumber = 0;
// Every request gets its own client address so per-client rate limits don't couple unrelated tests.
const nextClient = () => '10.77.' + Math.floor(++clientNumber / 250) + '.' + (clientNumber % 250 + 1);

const fields = {
  name: 'مشتری تست یکپارچگی', mobile: '09120000000', province: 'تهران', city: 'تهران',
  address: 'خیابان آزمایشی، کوچه تست، پلاک ۱', postal: '1234567890', notes: ''
};
const cod = (quantity = 1, size = 'M') => ({
  items: [{ productId: PRODUCT, colorId: 'black', size, quantity }],
  fields, shipping: 'courier', payment: 'cod', code: ''
});
async function order(body, { key = randomUUID(), client = nextClient() } = {}) {
  const response = await fetch(base + '/v1/orders', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'X-Forwarded-For': client }
  });
  return { status: response.status, body: await response.json() };
}
async function setStock(size, stock) {
  await pool.query('UPDATE product_variants SET stock=$1 WHERE product_id=$2 AND color_id=$3 AND size=$4',
    [stock, PRODUCT, 'black', size]);
}
async function stockOf(size) {
  const { rows } = await pool.query(
    'SELECT stock FROM product_variants WHERE product_id=$1 AND color_id=$2 AND size=$3', [PRODUCT, 'black', size]);
  return rows[0].stock;
}

before(async () => {
  await pool.query(
    'INSERT INTO products(id,slug,name,category,description,price,compare_at,images,colors,sizes,material,fit,care,featured,search_text) ' +
    "VALUES($1,$1,'محصول تست سفارش','manto','محصول آزمایشی برای تست یکپارچگی سفارش',$2,NULL,'[\"/images/test.jpg\"]'::jsonb," +
    "'[{\"id\":\"black\",\"name\":\"مشکی\",\"hex\":\"#000000\"}]'::jsonb,'[\"M\",\"L\"]'::jsonb,'نخ','آزاد','دستی',false,'test') " +
    'ON CONFLICT (id) DO UPDATE SET price=EXCLUDED.price', [PRODUCT, PRICE]);
  for (const size of ['M', 'L']) await pool.query(
    "INSERT INTO product_variants(product_id,color_id,size,stock) VALUES($1,'black',$2,0) " +
    'ON CONFLICT (product_id,color_id,size) DO NOTHING', [PRODUCT, size]);
});
after(() => pool.end());

describe('inventory under concurrency', () => {
  it('waits for a concurrent archive and refuses the now-inactive product', async () => {
    await setStock('M', 5);
    const client = await pool.connect();
    let pending;
    try {
      await client.query('BEGIN');
      await client.query('UPDATE products SET active=false WHERE id=$1', [PRODUCT]);
      pending = order(cod());
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const result = await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query ILIKE '%for share%'");
        waiting = result.rowCount > 0;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 30));
      }
      assert.ok(waiting, 'checkout must wait for the product writer before reading its state');
      await client.query('COMMIT');
      assert.equal((await pending).status, 422);
      assert.equal(await stockOf('M'), 5);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      if (pending) await pending;
      await pool.query('UPDATE products SET active=true WHERE id=$1', [PRODUCT]);
    }
  });
  it('never oversells when many COD orders race for the last units', async () => {
    await setStock('M', 3);
    const results = await Promise.all(Array.from({ length: 12 }, () => order(cod())));
    const created = results.filter(r => r.status === 201);
    assert.equal(created.length, 3, JSON.stringify(results.map(r => r.status)));
    assert.ok(results.every(r => r.status === 201 || r.status === 409), 'losers get a clean stock conflict');
    assert.equal(await stockOf('M'), 0);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM orders WHERE id = ANY($1::uuid[])',
      [created.map(r => r.body.id)]);
    assert.equal(rows[0].n, 3);
  });

  it('creates exactly one order and one stock decrement for parallel retries of one idempotency key', async () => {
    await setStock('L', 5);
    const key = 'it-retry-' + randomUUID();
    const results = await Promise.all(Array.from({ length: 6 }, () => order(cod(1, 'L'), { key })));
    assert.ok(results.every(r => r.status === 201), JSON.stringify(results.map(r => r.status)));
    assert.equal(new Set(results.map(r => r.body.id)).size, 1);
    assert.equal(await stockOf('L'), 4);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1', [key]);
    assert.equal(rows[0].n, 1);
  });

  it('rejects reuse of an idempotency key for a different cart', async () => {
    await setStock('L', 5);
    const key = 'it-reuse-' + randomUUID();
    assert.equal((await order(cod(1, 'L'), { key })).status, 201);
    const reused = await order(cod(2, 'L'), { key });
    assert.equal(reused.status, 409);
    assert.equal(await stockOf('L'), 4);
  });

  it('refuses quantities above available stock for online and COD checkout alike', async () => {
    await setStock('M', 1);
    assert.equal((await order(cod(2))).status, 409);
    assert.equal((await order({ ...cod(2), shipping: 'post', payment: 'online' })).status, 409);
    assert.equal(await stockOf('M'), 1);
  });
});

describe('server-authoritative totals', () => {
  it('returns 422 for oversized totals without creating an order or decrementing stock', async () => {
    await setStock('M', 10);
    const key = randomUUID();
    await pool.query('UPDATE products SET price=1000000000 WHERE id=$1', [PRODUCT]);
    try {
      const result = await order(cod(3), { key });
      assert.equal(result.status, 422);
      assert.equal(await stockOf('M'), 10);
      assert.equal((await pool.query('SELECT id FROM orders WHERE idempotency_key=$1', [key])).rowCount, 0);
    } finally {
      await pool.query('UPDATE products SET price=$1 WHERE id=$2', [PRICE, PRODUCT]);
    }
  });

  it('only includes actual price reductions in the sale filter', async () => {
    try {
      for (const [compareAt, expected] of [[PRICE, false], [PRICE + 1, true], [null, false]]) {
        await pool.query('UPDATE products SET compare_at=$1 WHERE id=$2', [compareAt, PRODUCT]);
        // Distinct query strings avoid the optional catalog cache between fixtures.
        const response = await fetch(base + '/v1/products?sale=1&q=test&min=' + PRICE + '&max=' + PRICE +
          '&limit=' + (expected ? 47 : compareAt === null ? 46 : 48),
          { headers: { 'X-Forwarded-For': nextClient() } });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).items.some(item => item.id === PRODUCT), expected);
      }
    } finally {
      await pool.query('UPDATE products SET compare_at=NULL WHERE id=$1', [PRODUCT]);
    }
  });
  it('ignores client-supplied prices and totals', async () => {
    await setStock('M', 5);
    const body = cod(2);
    const tampered = { ...body, total: 1, subtotal: 1, items: [{ ...body.items[0], price: 1, unitPrice: 1 }] };
    const placed = await order(tampered);
    assert.equal(placed.status, 201);
    assert.deepEqual(placed.body.totals, { subtotal: 2 * PRICE, discount: 0, shipping: 120_000, total: 2 * PRICE + 120_000 });
    const { rows } = await pool.query('SELECT unit_price FROM order_items WHERE order_id=$1', [placed.body.id]);
    assert.equal(rows[0].unit_price, PRICE);
  });

  it('applies discount codes on the server, including Persian digits, and rejects invalid ones', async () => {
    await setStock('M', 5);
    const discounted = await order({ ...cod(1), code: 'kasra ۱۰' });
    assert.equal(discounted.status, 201);
    assert.equal(discounted.body.totals.discount, 50_000);
    assert.equal(discounted.body.totals.total, PRICE - 50_000 + 120_000);
    assert.equal((await order({ ...cod(1), code: 'FREE100' })).status, 422);
    assert.equal((await order({ ...cod(1), code: 'WELCOME' })).status, 422, 'WELCOME needs a 1.5M subtotal');
  });

  it('enforces courier and cash-on-delivery restrictions', async () => {
    await setStock('M', 5);
    assert.equal((await order({ ...cod(1), fields: { ...fields, province: 'فارس', city: 'شیراز' } })).status, 422);
    assert.equal((await order({ ...cod(1), shipping: 'post' })).status, 422);
  });
});

describe('payment status safety', () => {
  it('records online orders as unpaid pending payment without reserving stock', async () => {
    await setStock('M', 2);
    const placed = await order({ ...cod(1), shipping: 'post', payment: 'online' });
    assert.equal(placed.status, 201);
    assert.equal(placed.body.status, 'pending_payment');
    assert.equal(placed.body.paymentStatus, 'unpaid');
    assert.equal(await stockOf('M'), 2);
    const receipt = await fetch(base + '/v1/orders/' + placed.body.id, {
      headers: { Authorization: 'Bearer ' + placed.body.accessToken } });
    assert.equal(receipt.status, 200);
    assert.equal((await receipt.json()).paymentStatus, 'unpaid');
  });

  it('cannot mark any order paid or move an unpaid online order into fulfilment, even with direct SQL', async () => {
    await setStock('M', 2);
    const online = await order({ ...cod(1), shipping: 'post', payment: 'online' });
    const local = await order(cod(1));
    const violation = { code: '23514' };
    await assert.rejects(pool.query("UPDATE orders SET payment_status='paid' WHERE id=$1", [local.body.id]), violation);
    await assert.rejects(pool.query("UPDATE orders SET status='preparing' WHERE id=$1", [online.body.id]), violation);
    await assert.rejects(pool.query("UPDATE orders SET status='delivered' WHERE id=$1", [online.body.id]), violation);
    await assert.rejects(pool.query("UPDATE orders SET status='pending_payment' WHERE id=$1", [local.body.id]), violation);
    await assert.rejects(pool.query('UPDATE orders SET total=total-1 WHERE id=$1', [local.body.id]), violation);
    await assert.rejects(pool.query("UPDATE orders SET status='paid' WHERE id=$1", [local.body.id]), violation);
  });

  it('keeps receipts private to the holder of the HMAC token', async () => {
    await setStock('M', 2);
    const placed = await order(cod(1));
    const url = base + '/v1/orders/' + placed.body.id;
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + 'a'.repeat(64) } })).status, 404);
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + placed.body.accessToken } })).status, 200);
  });
});

describe('rate limiting behind the storefront proxy', () => {
  it('limits each client separately and answers 429, not a server error', async () => {
    const send = client => fetch(base + '/v1/orders', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': client } });
    const statuses = [];
    for (let i = 0; i < 13; i++) statuses.push((await send('10.88.0.1')).status);
    assert.deepEqual(statuses.slice(0, 12), Array(12).fill(400));
    assert.equal(statuses[12], 429);
    assert.equal((await send('10.88.0.2')).status, 400, 'another visitor is not affected');
  });
});

// The last-piece discount: a variant whose own stock is exactly 1 sells at the owner's percent off (here 20%, so the
// 500,000 test product's last piece is 400,000), in the product data, the «تخفیف‌دارها» filter, the quote and the order.
describe('last-piece discount per variant', () => {
  const setDiscount = (enabled, percent = 20) =>
    pool.query('UPDATE last_piece_discount SET enabled=$1, percent=$2 WHERE id=1', [enabled, percent]);
  // The lookup is never cached, so it shows each fixture's stock at once.
  const variantsNow = async () => {
    const response = await fetch(base + '/v1/products/lookup?ids=' + PRODUCT, { headers: { 'X-Forwarded-For': nextClient() } });
    assert.equal(response.status, 200);
    return Object.fromEntries((await response.json()).items[0].variants.map(v => [v.size, v]));
  };
  let listing = 0;
  const onSale = async () => {
    // A distinct query string per call avoids the optional catalog cache between fixtures.
    const response = await fetch(base + '/v1/products?sale=1&q=test&min=' + PRICE + '&max=' + PRICE + '&limit=' + (30 + ++listing),
      { headers: { 'X-Forwarded-For': nextClient() } });
    assert.equal(response.status, 200);
    return (await response.json()).items.some(item => item.id === PRODUCT);
  };
  const unitPrices = async orderId =>
    (await pool.query('SELECT size, unit_price FROM order_items WHERE order_id=$1 ORDER BY size', [orderId])).rows
      .map(row => [row.size, row.unit_price]);
  before(() => setDiscount(true));
  after(async () => { await setDiscount(false); await setStock('M', 0); await setStock('L', 0); });

  it('M:1 L:5 — only M is discounted, in the product data, the sale filter and a COD order', async () => {
    await setStock('M', 1);
    await setStock('L', 5);
    const v = await variantsNow();
    assert.deepEqual([v.M.price, v.M.compareAt], [400_000, PRICE]);
    assert.equal(v.L.price, undefined);
    assert.equal(await onSale(), true);
    const m = await order(cod(1, 'M'));
    assert.equal(m.status, 201);
    assert.equal(m.body.totals.subtotal, 400_000);
    assert.deepEqual(await unitPrices(m.body.id), [['M', 400_000]]);
    const l = await order(cod(1, 'L'));
    assert.equal(l.status, 201);
    assert.equal(l.body.totals.subtotal, PRICE);
  });

  it('M:1 L:1 — both combinations are discounted, and one order of both charges both at the last-piece price', async () => {
    await setStock('M', 1);
    await setStock('L', 1);
    const v = await variantsNow();
    assert.deepEqual([v.M.price, v.L.price], [400_000, 400_000]);
    const both = await order({ ...cod(1, 'M'), items: [cod(1, 'M').items[0], cod(1, 'L').items[0]] });
    assert.equal(both.status, 201);
    assert.equal(both.body.totals.subtotal, 800_000);
    assert.deepEqual(await unitPrices(both.body.id), [['L', 400_000], ['M', 400_000]]);
  });

  it('an expensive product (30,000,000) with M:1 is on sale without overflowing the price arithmetic', async () => {
    const expensive = 30_000_000;
    await setStock('M', 1);
    await pool.query('UPDATE products SET price=$1 WHERE id=$2', [expensive, PRODUCT]);
    try {
      const response = await fetch(base + '/v1/products?sale=1&q=test&min=' + expensive + '&max=' + expensive + '&limit=' + (30 + ++listing),
        { headers: { 'X-Forwarded-For': nextClient() } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).items.some(item => item.id === PRODUCT), true);
    } finally { await pool.query('UPDATE products SET price=$1 WHERE id=$2', [PRICE, PRODUCT]); }
  });

  it('refuses an order whose shown subtotal is out of date (price_changed) without creating it or moving stock', async () => {
    await setStock('M', 1);
    // The shopper loaded M at the catalog price; it has since dropped to its last unit and its last-piece price.
    const stale = await order({ ...cod(1, 'M'), expectedSubtotal: PRICE });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'price_changed');
    assert.equal(stale.body.subtotal, 400_000);
    assert.equal(await stockOf('M'), 1);
    const fresh = await order({ ...cod(1, 'M'), expectedSubtotal: 400_000 });
    assert.equal(fresh.status, 201);
    assert.equal(fresh.body.totals.subtotal, 400_000);
    assert.equal(await stockOf('M'), 0);
  });

  it('refuses an order whose lines were shown at other prices, even when the subtotal still matches', async () => {
    // M dropped to its last unit (400,000) while L, at 5, stayed at 500,000; the shopper saw them the other way round.
    await setStock('M', 1);
    await setStock('L', 5);
    const swapped = { ...cod(1, 'M'), expectedSubtotal: 900_000,
      items: [{ ...cod(1, 'M').items[0], expectedPrice: PRICE }, { ...cod(1, 'L').items[0], expectedPrice: 400_000 }] };
    const stale = await order(swapped);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'price_changed');
    assert.deepEqual([await stockOf('M'), await stockOf('L')], [1, 5]);
    const fresh = await order({ ...swapped,
      items: [{ ...swapped.items[0], expectedPrice: 400_000 }, { ...swapped.items[1], expectedPrice: PRICE }] });
    assert.equal(fresh.status, 201);
    assert.deepEqual(await unitPrices(fresh.body.id), [['L', PRICE], ['M', 400_000]]);
  });

  it('M:2 L:0 — no discount, and the product is not on sale', async () => {
    await setStock('M', 2);
    await setStock('L', 0);
    const v = await variantsNow();
    assert.equal(v.M.price, undefined);
    assert.equal(await onSale(), false);
  });

  it('M:1 then restocked to 3 — the API and a new quote are back at the catalog price', async () => {
    await setStock('M', 1);
    assert.equal((await variantsNow()).M.price, 400_000);
    await setStock('M', 3);
    assert.equal((await variantsNow()).M.price, undefined);
    const quote = await fetch(base + '/v1/checkout/quote', { method: 'POST', body: JSON.stringify(cod(1, 'M')),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextClient() } });
    assert.equal(quote.status, 200);
    assert.equal((await quote.json()).subtotal, PRICE);
  });

  it('setting off — M:1 sells at the catalog price and is not on sale', async () => {
    await setDiscount(false);
    try {
      await setStock('M', 1);
      assert.equal((await variantsNow()).M.price, undefined);
      assert.equal(await onSale(), false);
      const quote = await fetch(base + '/v1/checkout/quote', { method: 'POST', body: JSON.stringify(cod(1, 'M')),
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextClient() } });
      assert.equal((await quote.json()).subtotal, PRICE);
    } finally { await setDiscount(true); }
  });
});
