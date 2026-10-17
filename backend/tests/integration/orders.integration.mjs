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
