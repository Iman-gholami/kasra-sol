import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:4000';
async function call(path, options = {}) {
  const res = await fetch(base + path, options);
  return { status: res.status, body: await res.json() };
}
const list = await call('/v1/products?limit=12&sort=newest');
assert.equal(list.status, 200);
assert.equal(list.body.total, 36);
assert.equal(list.body.items.length, 12);
const p = (await call('/v1/products/manto-01')).body;
assert.equal(p.slug, 'manto-01');
const v = p.variants.find(x => x.stock >= 2);
assert.ok(v, 'Expected in-stock seed variant');
const data = {
  items: [{ productId: p.id, colorId: v.colorId, size: v.size, quantity: 1 }],
  fields: { name: 'مشتری آزمایشی', mobile: '09123456789', province: 'تهران', city: 'تهران',
    address: 'خیابان آزادی پلاک آزمایشی ۱۲', postal: '1234567890', notes: '' },
  shipping: 'courier', payment: 'cod', code: ''
};
const options = { method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'ci-idempotency-0000001' },
  body: JSON.stringify(data) };
const quote = await call('/v1/checkout/quote', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: options.body });
assert.equal(quote.status, 200);
assert.equal(quote.body.total, p.price + 120000);
const first = await call('/v1/orders', options);
assert.equal(first.status, 201);
assert.equal(first.body.status, 'confirmed_cod');
const second = await call('/v1/orders', options);
assert.equal(second.body.id, first.body.id);
const after = (await call('/v1/products/manto-01')).body;
const vAfter = after.variants.find(x => x.colorId === v.colorId && x.size === v.size);
assert.equal(vAfter.stock, v.stock - 1);
const receipt = await call('/v1/orders/' + first.body.id, { headers: { Authorization:'Bearer ' + first.body.accessToken } });
assert.equal(receipt.status, 200);
assert.equal(receipt.body.items.length, 1);
const forbidden = await call('/v1/orders/' + first.body.id);
assert.equal(forbidden.status, 404);
const bad = await call('/v1/orders', { ...options, body: JSON.stringify({ ...data, code:'KASRA10' }) });
assert.equal(bad.status, 409);
console.log('Backend database smoke test passed');
