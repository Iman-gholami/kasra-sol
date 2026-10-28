// Real PostgreSQL + running API checks for the shared shop/website stock: receiving goods with barcodes, label
// barcodes, and counter sales that scan them, racing online orders for the same units.
// Requires: API at API_BASE (TRUST_PROXY=true) after migrations, and DATABASE_URL for fixtures.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import pg from 'pg';

const base = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const run = randomBytes(3).toString('hex');
let clients = 0;
const nextIp = () => '10.77.' + Math.floor(++clients / 250) + '.' + (clients % 250 + 1);
const hash = password => {
  const salt = randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + scryptSync(password, salt, 64).toString('hex');
};
async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'X-Forwarded-For': nextIp(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function account(role, grants = []) {
  const username = 'store_' + role + '_' + run + '_' + (++clients);
  const password = randomBytes(18).toString('hex');
  await pool.query('INSERT INTO admin_users(username,display_name,password_hash,role,grants) VALUES($1,$2,$3,$4,$5::jsonb)',
    [username, 'فروشگاه ' + role, hash(password), role, JSON.stringify(grants)]);
  const session = await api('/v1/admin/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(session.status, 200, 'fixture login ' + username);
  return { token: session.data.token, id: session.data.user.id };
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9focP0sAAAAASUVORK5CYII=', 'base64');
const stockOf = async (productId, size = 'M') => (await pool.query(
  "SELECT stock FROM product_variants WHERE product_id=$1 AND color_id='black' AND size=$2", [productId, size])).rows[0]?.stock;
/** The PUT body: everything the editor sends, without read-only state. */
const editable = item => { const body = { ...item }; delete body.status; delete body.active; return body; };
const isEan13 = code => /^\d{13}$/.test(code) &&
  (10 - [...code.slice(0, 12)].reduce((sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10) % 10 === Number(code[12]);

let owner, manager, staff, image;
const PRICE = 850_000;
async function product(suffix, stock = { M: 0, L: 0 }, publish = false) {
  const id = 'it-store-' + suffix + '-' + run;
  const created = await api('/v1/admin/products', { method: 'POST', token: owner.token, body: {
    id, slug: id, name: 'شومیز فروشگاهی ' + suffix, category: 'shomiz', description: 'محصول آزمایشی برای فروش حضوری',
    price: PRICE, compareAt: null, images: [image], colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }], sizes: ['M', 'L'],
    variants: [{ colorId: 'black', size: 'M', stock: stock.M }, { colorId: 'black', size: 'L', stock: stock.L }],
    material: 'نخ', fit: 'آزاد', care: 'شست‌وشو با آب سرد', featured: false } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  if (publish) assert.equal((await api('/v1/admin/products/' + id + '/visibility', { method: 'PATCH', token: owner.token,
    body: { active: true } })).status, 200);
  return id;
}
const receive = (token, lines, clientRef = randomUUID()) =>
  api('/v1/admin/stock-receipts', { method: 'POST', token, body: { clientRef, lines } });
const sell = (token, lines, extra = {}) =>
  api('/v1/admin/store-sales', { method: 'POST', token, body: { clientRef: randomUUID(), payment: 'card', lines, ...extra } });
const barcodes = async (productId, token = staff.token) => {
  const result = await api('/v1/admin/products/' + productId + '/barcodes', { method: 'POST', token });
  assert.equal(result.status, 200);
  return Object.fromEntries(result.data.items.map(item => [item.size, item.code]));
};
const order = (productId, quantity = 1) => api('/v1/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() },
  body: { items: [{ productId, colorId: 'black', size: 'M', quantity }], shipping: 'courier', payment: 'cod', code: '',
    fields: { name: 'مشتری سایت', mobile: '09121112233', province: 'تهران', city: 'تهران', address: 'خیابان آزمایشی، پلاک ۳',
      postal: '1234567890', notes: '' } } });

before(async () => {
  owner = await account('owner');
  manager = await account('manager');
  staff = await account('staff');
  const uploaded = await fetch(base + '/v1/admin/media', { method: 'POST', body: png,
    headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + owner.token, 'X-Forwarded-For': nextIp() } });
  image = (await uploaded.json()).url;
});
after(() => pool.end());

describe('receiving goods', () => {
  it('adds received units to the shared stock once, with a store barcode per color and size', async () => {
    const id = await product('receive');
    const ref = randomUUID();
    const lines = [{ productId: id, colorId: 'black', size: 'M', quantity: 5 }, { productId: id, colorId: 'black', size: 'L', quantity: 2 }];
    const [first, retry] = await Promise.all([receive(manager.token, lines, ref), receive(manager.token, lines, ref)]);
    assert.deepEqual([first.status, retry.status].sort(), [200, 201], 'a double click records one receipt');
    assert.equal(retry.data.receipt.id, first.data.receipt.id);
    assert.equal(await stockOf(id, 'M'), 5);
    assert.equal(await stockOf(id, 'L'), 2);
    const items = first.data.receipt.items;
    assert.deepEqual(items.map(item => [item.size, item.quantity, item.price, item.colorName]), [['M', 5, PRICE, 'مشکی'], ['L', 2, PRICE, 'مشکی']]);
    for (const item of items) assert.ok(item.code.startsWith('20') && isEan13(item.code), item.code);
    assert.notEqual(items[0].code, items[1].code);
    assert.deepEqual(await barcodes(id), { M: items[0].code, L: items[1].code }, 'labels reuse the receipt barcodes');
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='inventory.received' AND target=$1",
      [String(first.data.receipt.id)]);
    assert.equal(audit.rows[0].details.units, 7);
    const listed = await api('/v1/admin/stock-receipts', { token: staff.token });
    assert.equal(listed.status, 200, 'staff may read receipts to reprint labels');
    assert.ok(listed.data.items.some(row => row.id === first.data.receipt.id && row.units === 7 && row.lines === 2));
  });

  it('refuses the whole receipt when one line is not a defined color/size, and refuses default staff', async () => {
    const id = await product('partial');
    const lines = [{ productId: id, colorId: 'black', size: 'M', quantity: 3 }, { productId: id, colorId: 'black', size: 'XXL', quantity: 1 }];
    const refused = await receive(manager.token, lines);
    assert.equal(refused.status, 409);
    assert.deepEqual([refused.data.error, refused.data.size], ['variant_not_found', 'XXL']);
    assert.equal(await stockOf(id, 'M'), 0, 'no line of a refused receipt is applied');
    assert.equal((await receive(staff.token, lines.slice(0, 1))).status, 403);
    const granted = await account('staff', ['inventory:write']);
    assert.equal((await receive(granted.token, lines.slice(0, 1))).status, 201);
    assert.equal(await stockOf(id, 'M'), 3);
  });

  it('keeps a printed barcode when the product editor removes a size and restores it', async () => {
    const id = await product('restore', { M: 1, L: 1 });
    const before = await barcodes(id);
    assert.deepEqual(await barcodes(id), before, 'asking again creates no new codes');
    const latest = (await api('/v1/admin/products/' + id, { token: owner.token })).data;
    const edit = (item, revision) => api('/v1/admin/products/' + id, { method: 'PUT', token: owner.token,
      headers: { 'If-Match': '"' + revision + '"' }, body: editable(item) });
    const withoutL = { ...latest.item, sizes: ['M'], variants: latest.item.variants.filter(v => v.size === 'M') };
    assert.equal((await edit(withoutL, latest.revision)).status, 200);
    const lookup = await api('/v1/admin/barcodes/' + before.L, { token: staff.token });
    assert.deepEqual([lookup.status, lookup.data.error], [409, 'variant_removed']);
    const again = (await api('/v1/admin/products/' + id, { token: owner.token })).data;
    assert.equal((await edit({ ...again.item, sizes: ['M', 'L'], variants: [...again.item.variants,
      { colorId: 'black', size: 'L', stock: 0 }] }, again.revision)).status, 200);
    assert.deepEqual(await barcodes(id), before);
  });
});

describe('counter sales', () => {
  it('sells scanned items at the catalog price and takes them from the shared stock exactly once', async () => {
    const id = await product('sell', { M: 4, L: 1 });
    const codes = await barcodes(id);
    const scanned = await api('/v1/admin/barcodes/' + codes.M, { token: staff.token });
    assert.equal(scanned.status, 200);
    assert.deepEqual([scanned.data.item.productId, scanned.data.item.size, scanned.data.item.price, scanned.data.item.stock,
      scanned.data.item.active], [id, 'M', PRICE, 4, false], 'a product not on the website is still sold in the shop');
    const ref = randomUUID();
    const body = { clientRef: ref, payment: 'cash', lines: [{ code: codes.M, quantity: 1 }, { code: codes.L, quantity: 1 },
      { code: codes.M, quantity: 1 }] };
    const [first, retry] = await Promise.all([api('/v1/admin/store-sales', { method: 'POST', token: staff.token, body }),
      api('/v1/admin/store-sales', { method: 'POST', token: staff.token, body })]);
    assert.deepEqual([first.status, retry.status].sort(), [200, 201]);
    const sale = first.status === 201 ? first.data.sale : retry.data.sale;
    assert.deepEqual([sale.subtotal, sale.discount, sale.total, sale.payment], [3 * PRICE, 0, 3 * PRICE, 'cash']);
    assert.deepEqual(sale.items.map(item => [item.size, item.quantity, item.unitPrice]).sort(), [['L', 1, PRICE], ['M', 2, PRICE]]);
    assert.equal(sale.cashier, 'فروشگاه staff');
    assert.equal(await stockOf(id, 'M'), 2);
    assert.equal(await stockOf(id, 'L'), 0);
    const today = await api('/v1/admin/store-sales', { token: staff.token });
    assert.equal(today.status, 200);
    assert.ok(today.data.items.some(row => row.id === sale.id));
    assert.equal((await api('/v1/admin/store-sales?date=2026-02-30', { token: staff.token })).status, 400, 'not a calendar day');
    assert.equal((await api('/v1/admin/store-sales?date=2020-01-01', { token: staff.token })).data.summary.sales, 0);
  });

  it('refuses a sale the stock cannot cover without taking any of its lines', async () => {
    const id = await product('short', { M: 3, L: 1 });
    const codes = await barcodes(id);
    const refused = await sell(staff.token, [{ code: codes.M, quantity: 2 }, { code: codes.L, quantity: 2 }]);
    assert.equal(refused.status, 409);
    assert.equal(refused.data.error, 'insufficient_stock');
    assert.deepEqual(refused.data.items.map(item => [item.size, item.requested, item.available]), [['L', 2, 1]]);
    assert.equal(await stockOf(id, 'M'), 3);
    const unknown = await sell(staff.token, [{ code: codes.M, quantity: 1 }, { code: '2099999999998', quantity: 1 }]);
    assert.deepEqual([unknown.status, unknown.data.error], [404, 'barcode_not_found']);
    assert.equal((await api('/v1/admin/barcodes/2000000000016', { token: staff.token })).status, 400, 'wrong check digit');
    assert.equal(await stockOf(id, 'M'), 3);
  });

  it('lets only staff with the price permission give a discount, never above the subtotal', async () => {
    const id = await product('discount', { M: 5, L: 0 });
    const { M } = await barcodes(id);
    const denied = await sell(staff.token, [{ code: M, quantity: 1 }], { discount: 50_000 });
    assert.deepEqual([denied.status, denied.data.permission], [403, 'products:price']);
    assert.equal((await sell(manager.token, [{ code: M, quantity: 1 }], { discount: PRICE + 1 })).status, 422);
    const given = await sell(manager.token, [{ code: M, quantity: 1 }], { discount: 50_000, payment: 'transfer' });
    assert.equal(given.status, 201);
    assert.equal(given.data.sale.total, PRICE - 50_000);
    assert.equal(await stockOf(id), 4);
  });

  it('never sells the same last units both at the counter and on the website', async () => {
    const id = await product('race', { M: 3, L: 0 }, true);
    const { M } = await barcodes(id);
    const results = await Promise.all([
      ...Array.from({ length: 4 }, () => sell(staff.token, [{ code: M, quantity: 1 }])),
      ...Array.from({ length: 3 }, () => order(id))
    ]);
    const sold = results.filter(result => result.status === 201).length;
    assert.equal(sold, 3, results.map(result => result.status).join(','));
    assert.equal(await stockOf(id), 0);
    const counter = results.slice(0, 4).filter(result => result.status === 201).length;
    const units = await pool.query('SELECT COALESCE(SUM(i.quantity),0)::int AS n FROM store_sale_items i WHERE i.product_id=$1', [id]);
    assert.equal(units.rows[0].n, counter);
  });

  it('gives an online order’s cancelled units back to the counter', async () => {
    const id = await product('handoff', { M: 1, L: 0 }, true);
    const { M } = await barcodes(id);
    const placed = await order(id);
    assert.equal(placed.status, 201);
    const blocked = await sell(staff.token, [{ code: M, quantity: 1 }]);
    assert.deepEqual([blocked.status, blocked.data.items?.[0]?.available], [409, 0]);
    assert.equal((await api('/v1/admin/orders/' + placed.data.id + '/status', { method: 'PATCH', token: manager.token,
      body: { status: 'cancelled' } })).status, 200);
    assert.equal((await sell(staff.token, [{ code: M, quantity: 1 }])).status, 201);
    assert.equal(await stockOf(id), 0);
  });

  it('voids a counter sale once, returning its units, and leaves it out of the day totals', async () => {
    const id = await product('void', { M: 2, L: 0 });
    const { M } = await barcodes(id);
    const sale = (await sell(staff.token, [{ code: M, quantity: 2 }], { payment: 'cash' })).data.sale;
    assert.equal(await stockOf(id), 0);
    const totals = async () => (await api('/v1/admin/store-sales', { token: manager.token })).data.summary;
    const before = await totals();
    const path = '/v1/admin/store-sales/' + sale.id + '/void';
    assert.equal((await api(path, { method: 'POST', token: staff.token, body: {} })).status, 403);
    const [one, two] = await Promise.all([api(path, { method: 'POST', token: manager.token, body: { reason: 'مرجوعی' } }),
      api(path, { method: 'POST', token: owner.token, body: {} })]);
    assert.deepEqual([one.status, two.status].sort(), [200, 409]);
    assert.equal(await stockOf(id), 2);
    const now = await totals();
    assert.equal(BigInt(before.total) - BigInt(now.total), BigInt(2 * PRICE));
    assert.equal(BigInt(before.cash) - BigInt(now.cash), BigInt(2 * PRICE));
    assert.equal(before.units - now.units, 2);
    const listed = (await api('/v1/admin/store-sales', { token: staff.token })).data.items.find(row => row.id === sale.id);
    assert.ok(listed.voidedAt);
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='sales.voided' AND target=$1", [sale.id]);
    assert.deepEqual([audit.rows.length, audit.rows[0].details.restocked], [1, 2]);
  });
});

describe('held carts', () => {
  const hold = (token, lines, note) => api('/v1/admin/store-holds', { method: 'POST', token, body: { lines, ...(note ? { note } : {}) } });
  const held = async id => (await api('/v1/admin/store-holds', { token: staff.token })).data.items.find(item => item.id === id);

  it('holds a cart without touching stock and gives it back to exactly one cashier at current prices', async () => {
    const id = await product('hold', { M: 3, L: 1 });
    const { M, L } = await barcodes(id);
    const parked = await hold(staff.token, [{ code: M, quantity: 2 }, { code: L, quantity: 1 }], 'خانم کت چرم، اتاق پرو');
    assert.equal(parked.status, 201);
    assert.equal(parked.data.hold.total, 3 * PRICE);
    assert.equal(parked.data.hold.cashier, 'فروشگاه staff');
    assert.equal(await stockOf(id, 'M'), 3, 'a held cart reserves nothing');
    assert.equal((await api('/v1/admin/products/' + id + '/price', { method: 'PATCH', token: owner.token, body: { price: PRICE + 10_000 } })).status, 200);
    const listed = await held(parked.data.hold.id);
    assert.equal(listed.note, 'خانم کت چرم، اتاق پرو');
    assert.equal(listed.total, 3 * (PRICE + 10_000), 'shown at the current price');
    const path = '/v1/admin/store-holds/' + parked.data.hold.id + '/resume';
    const [one, two] = await Promise.all([api(path, { method: 'POST', token: staff.token }), api(path, { method: 'POST', token: manager.token })]);
    assert.deepEqual([one.status, two.status].sort(), [200, 404]);
    const taken = one.status === 200 ? one.data.hold : two.data.hold;
    assert.deepEqual(taken.items.map(item => [item.size, item.quantity, item.price, item.stock]),
      [['M', 2, PRICE + 10_000, 3], ['L', 1, PRICE + 10_000, 1]]);
    assert.equal((one.status === 404 ? one : two).data.error, 'held_sale_gone');
    assert.equal(await held(parked.data.hold.id), undefined);
  });

  it('refuses unknown labels, lets staff discard a held cart, and leaves out sizes removed meanwhile', async () => {
    const id = await product('hold-edit', { M: 1, L: 1 });
    const { M, L } = await barcodes(id);
    assert.deepEqual((await hold(staff.token, [{ code: '2099999999998', quantity: 1 }])).data.error, 'barcode_not_found');
    const gone = (await hold(staff.token, [{ code: M, quantity: 1 }])).data.hold;
    assert.equal((await api('/v1/admin/store-holds/' + gone.id, { method: 'DELETE', token: staff.token })).status, 200);
    assert.equal((await api('/v1/admin/store-holds/' + gone.id, { method: 'DELETE', token: staff.token })).status, 404);
    const kept = (await hold(staff.token, [{ code: M, quantity: 1 }, { code: L, quantity: 1 }])).data.hold;
    const latest = (await api('/v1/admin/products/' + id, { token: owner.token })).data;
    assert.equal((await api('/v1/admin/products/' + id, { method: 'PUT', token: owner.token,
      headers: { 'If-Match': '"' + latest.revision + '"' },
      body: editable({ ...latest.item, sizes: ['M'], variants: latest.item.variants.filter(v => v.size === 'M') }) })).status, 200);
    const back = (await api('/v1/admin/store-holds/' + kept.id + '/resume', { method: 'POST', token: staff.token })).data.hold;
    assert.deepEqual([back.items.map(item => item.size), back.missing], [['M'], 1]);
  });
});
