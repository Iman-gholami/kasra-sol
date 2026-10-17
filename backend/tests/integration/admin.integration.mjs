// Real PostgreSQL + running API checks for the admin panel: authentication, RBAC escalation attempts,
// inventory concurrency, order lifecycle, payment safety, reports and uploads.
// Requires: API at API_BASE (TRUST_PROXY=true) after migrations, and DATABASE_URL for fixtures.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import pg from 'pg';

const base = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const run = randomBytes(3).toString('hex');
let clients = 0;
const nextIp = () => '10.66.' + Math.floor(++clients / 250) + '.' + (clients % 250 + 1);
const secret = () => randomBytes(18).toString('hex');
const hash = password => {
  const salt = randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + scryptSync(password, salt, 64).toString('hex');
};
async function api(path, { method = 'GET', body, token, ip = nextIp(), headers = {} } = {}) {
  const response = await fetch(base + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'X-Forwarded-For': ip, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
const login = async (username, password) => (await api('/v1/admin/auth/login', { method: 'POST', body: { username, password } }));
async function account(role, extra = {}) {
  const username = role + '_' + run + '_' + (++clients);
  const password = secret();
  await pool.query('INSERT INTO admin_users(username,display_name,password_hash,role,grants,revokes) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
    [username, 'تست ' + role, hash(password), role, JSON.stringify(extra.grants ?? []), JSON.stringify(extra.revokes ?? [])]);
  const session = await login(username, password);
  assert.equal(session.status, 200, 'fixture login ' + username);
  return { username, password, token: session.data.token, id: session.data.user.id };
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9focP0sAAAAASUVORK5CYII=', 'base64');
async function upload(token, body = png, type = 'image/png') {
  const response = await fetch(base + '/v1/admin/media', { method: 'POST', body,
    headers: { 'Content-Type': type, Authorization: 'Bearer ' + token, 'X-Forwarded-For': nextIp() } });
  return { status: response.status, data: await response.json().catch(() => null) };
}
const fields = { name: 'مشتری پنل', mobile: '09121112233', province: 'تهران', city: 'تهران',
  address: 'خیابان آزمایشی پنل، پلاک ۲', postal: '1234567890', notes: 'زنگ دوم' };
async function placeOrder(productId, { payment = 'cod', quantity = 1, size = 'M' } = {}) {
  const result = await api('/v1/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: {
    items: [{ productId, colorId: 'black', size, quantity }], fields,
    shipping: payment === 'cod' ? 'courier' : 'post', payment, code: '' } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}
const stockOf = async (productId, size = 'M') => (await pool.query(
  "SELECT stock FROM product_variants WHERE product_id=$1 AND color_id='black' AND size=$2", [productId, size])).rows[0].stock;

let owner, manager, staff, image;
const PRODUCT = 'it-admin-' + run;
const productBody = (overrides = {}) => ({
  id: PRODUCT, slug: PRODUCT, name: 'مانتو تست پنل', category: 'manto',
  description: 'محصول آزمایشی برای تست مدیریت', price: 900_000, compareAt: 1_200_000, images: [image],
  colors: [{ id: 'black', name: 'مشکی شب', hex: '#000000' }], sizes: ['M', 'L'],
  variants: [{ colorId: 'black', size: 'M', stock: 10 }, { colorId: 'black', size: 'L', stock: 2 }],
  material: 'کتان', fit: 'آزاد', care: 'شست‌وشو با آب سرد', featured: false, ...overrides
});
async function revision(token = owner.token) {
  const found = await api('/v1/admin/products/' + PRODUCT, { token });
  assert.equal(found.status, 200);
  return { etag: '"' + found.data.revision + '"', item: found.data.item };
}
const put = (token, body, etag) => api('/v1/admin/products/' + PRODUCT, { method: 'PUT', token, body, headers: { 'If-Match': etag } });

before(async () => {
  owner = await account('owner');
  manager = await account('manager');
  staff = await account('staff');
  image = (await upload(owner.token)).data.url;
  assert.match(image, /^\/api\/media\/[a-f0-9-]{36}\.png$/);
  assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token, body: productBody() })).status, 201);
  assert.equal((await api('/v1/admin/products/' + PRODUCT + '/visibility', { method: 'PATCH', token: owner.token,
    body: { active: true } })).status, 200);
});
after(() => pool.end());

describe('authentication and sessions', () => {
  it('locks an account after repeated failures without revealing it, and an owner reset unlocks it', async () => {
    const victim = await account('staff');
    for (let i = 0; i < 10; i++) assert.equal((await login(victim.username, 'wrong-password-' + i)).status, 401);
    const locked = await login(victim.username, victim.password);
    assert.equal(locked.status, 401, 'correct password is refused while locked');
    assert.deepEqual(locked.data, { error: 'invalid_credentials' }, 'same answer as a wrong password');
    const unknown = await login('nobody_' + run, 'whatever-password-1');
    assert.deepEqual(unknown.data, locked.data);
    const audit = await pool.query("SELECT action FROM admin_audit_log WHERE target=$1 ORDER BY id", [victim.username]);
    assert.ok(audit.rows.some(r => r.action === 'auth.login_failed'));
    assert.ok(audit.rows.some(r => r.action === 'auth.login_locked'));
    const fresh = secret();
    assert.equal((await api('/v1/admin/staff/' + victim.id + '/password', { method: 'PUT', token: owner.token,
      body: { password: fresh } })).status, 200);
    assert.equal((await api('/v1/admin/auth/me', { token: victim.token })).status, 401, 'reset ends old sessions');
    assert.equal((await login(victim.username, fresh)).status, 200);
  });

  it('ends a session on logout and on expiry', async () => {
    const user = await account('staff');
    assert.equal((await api('/v1/admin/auth/me', { token: user.token })).status, 200);
    assert.equal((await api('/v1/admin/auth/logout', { method: 'POST', token: user.token })).status, 200);
    assert.equal((await api('/v1/admin/auth/me', { token: user.token })).status, 401);
    const again = (await login(user.username, user.password)).data.token;
    await pool.query("UPDATE admin_sessions SET expires_at=now() - interval '1 second' WHERE user_id=$1", [user.id]);
    assert.equal((await api('/v1/admin/auth/me', { token: again })).status, 401);
  });

  it('changes the own password only with the current one and ends the other sessions', async () => {
    const user = await account('manager');
    const other = (await login(user.username, user.password)).data.token;
    const next = secret();
    assert.equal((await api('/v1/admin/auth/password', { method: 'POST', token: user.token,
      body: { currentPassword: 'not-my-password', newPassword: next } })).status, 400);
    assert.equal((await api('/v1/admin/auth/password', { method: 'POST', token: user.token,
      body: { currentPassword: user.password, newPassword: next } })).status, 200);
    assert.equal((await api('/v1/admin/auth/me', { token: user.token })).status, 200, 'current session stays');
    assert.equal((await api('/v1/admin/auth/me', { token: other })).status, 401, 'other sessions end');
    assert.equal((await login(user.username, user.password)).status, 401);
    assert.equal((await login(user.username, next)).status, 200);
    const stored = await pool.query('SELECT password_hash FROM admin_users WHERE id=$1', [user.id]);
    assert.ok(!stored.rows[0].password_hash.includes(next), 'only a hash is stored');
  });

  it('immediately revokes the sessions of a deactivated employee', async () => {
    const user = await account('staff');
    assert.equal((await api('/v1/admin/staff/' + user.id, { method: 'PATCH', token: owner.token,
      body: { active: false } })).status, 200);
    assert.equal((await api('/v1/admin/orders', { token: user.token })).status, 401);
    assert.equal((await login(user.username, user.password)).status, 401);
  });
});

describe('role-based access and escalation attempts', () => {
  it('denies employees every staff-management and owner-only action', async () => {
    for (const actor of [staff, manager]) {
      assert.equal((await api('/v1/admin/staff', { token: actor.token })).status, 403);
      assert.equal((await api('/v1/admin/audit', { token: actor.token })).status, 403);
      assert.equal((await api('/v1/admin/staff', { method: 'POST', token: actor.token, body: {
        username: 'evil_' + run + clients, displayName: 'نفوذی', password: secret(), role: 'manager' } })).status, 403);
      assert.equal((await api('/v1/admin/staff/' + actor.id, { method: 'PATCH', token: actor.token,
        body: { grants: ['products:price'] } })).status, 403, 'cannot raise own access');
      assert.equal((await api('/v1/admin/staff/' + owner.id + '/password', { method: 'PUT', token: actor.token,
        body: { password: secret() } })).status, 403);
    }
  });

  it('keeps owner-only permissions undelegatable and the owner account untouchable', async () => {
    assert.equal((await api('/v1/admin/staff/' + staff.id, { method: 'PATCH', token: owner.token,
      body: { grants: ['staff:manage'] } })).status, 400);
    assert.equal((await api('/v1/admin/staff/' + staff.id, { method: 'PATCH', token: owner.token,
      body: { grants: ['payments:configure'] } })).status, 400);
    assert.equal((await api('/v1/admin/staff', { method: 'POST', token: owner.token, body: {
      username: 'owner2_' + run, displayName: 'مالک دوم', password: secret(), role: 'owner' } })).status, 400);
    assert.equal((await api('/v1/admin/staff/' + owner.id, { method: 'PATCH', token: owner.token,
      body: { active: false } })).status, 403);
    const second = await account('owner');
    assert.equal((await api('/v1/admin/staff/' + second.id, { method: 'PATCH', token: owner.token,
      body: { active: false } })).status, 403, 'an owner account cannot be changed through the API');
  });

  it('blocks a default staff member from prices, stock, publishing, products, uploads and reports', async () => {
    const variant = (await pool.query("SELECT id,stock FROM product_variants WHERE product_id=$1 AND size='M'", [PRODUCT])).rows[0];
    const denied = [
      api('/v1/admin/products/' + PRODUCT + '/price', { method: 'PATCH', token: staff.token, body: { price: 1 } }),
      api('/v1/admin/variants/' + variant.id + '/stock', { method: 'PATCH', token: staff.token,
        body: { stock: 99, expectedStock: variant.stock } }),
      api('/v1/admin/products/' + PRODUCT + '/visibility', { method: 'PATCH', token: staff.token, body: { active: false } }),
      api('/v1/admin/products', { method: 'POST', token: staff.token, body: productBody({ id: 'x-' + run, slug: 'x-' + run }) }),
      api('/v1/admin/reports/overview', { token: staff.token }),
      upload(staff.token)
    ];
    for (const result of await Promise.all(denied)) assert.equal(result.status, 403);
    assert.equal((await api('/v1/admin/orders', { token: staff.token })).status, 200, 'staff can read orders');
    assert.equal(await stockOf(PRODUCT), 10);
  });

  it('lets a content editor edit descriptions but not prices or stock through the full editor', async () => {
    const editor = await account('staff', { grants: ['products:write'] });
    const { etag, item } = await revision(editor.token);
    const { status: _s, active: _a, ...current } = item;
    assert.equal((await put(editor.token, { ...current, price: 1 }, etag)).data.permission, 'products:price');
    const stockEdit = await put(editor.token, { ...current, variants: current.variants.map(v => ({ ...v, stock: 999 })) }, etag);
    assert.equal(stockEdit.status, 403);
    assert.equal(stockEdit.data.permission, 'inventory:write');
    const content = await put(editor.token, { ...current, description: 'توضیح جدید ویراستار محتوا برای محصول' }, etag);
    assert.equal(content.status, 200, JSON.stringify(content.data));
    const after = (await revision()).item;
    assert.equal(after.price, 900_000);
    assert.equal(after.description, 'توضیح جدید ویراستار محتوا برای محصول');
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='products.updated' AND target=$1 ORDER BY id DESC LIMIT 1", [PRODUCT]);
    assert.deepEqual(audit.rows[0].details.fields, ['description']);
  });
});

describe('inventory and pricing integrity', () => {
  it('rejects a stock edit based on a stale value instead of overwriting sold units', async () => {
    const variant = (await pool.query("SELECT id,stock FROM product_variants WHERE product_id=$1 AND size='L'", [PRODUCT])).rows[0];
    const seen = variant.stock;
    await placeOrder(PRODUCT, { size: 'L' });
    const stale = await api('/v1/admin/variants/' + variant.id + '/stock', { method: 'PATCH', token: manager.token,
      body: { stock: seen + 5, expectedStock: seen } });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.stock, seen - 1);
    assert.equal((await api('/v1/admin/variants/' + variant.id + '/stock', { method: 'PATCH', token: manager.token,
      body: { stock: seen + 5, expectedStock: seen - 1 } })).status, 200);
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='inventory.stock' AND target=$1 ORDER BY id DESC LIMIT 1", [variant.id]);
    assert.deepEqual([audit.rows[0].details.from, audit.rows[0].details.to], [seen - 1, seen + 5]);
  });

  it('rejects stale full-product edits and sale prices above the original price', async () => {
    const { etag, item } = await revision();
    const { status: _s, active: _a, ...current } = item;
    await placeOrder(PRODUCT);
    assert.equal((await put(owner.token, { ...current, name: 'نام قدیمی' }, etag)).status, 412);
    assert.equal((await api('/v1/admin/products/' + PRODUCT + '/price', { method: 'PATCH', token: manager.token,
      body: { price: 1_300_000 } })).status, 409);
    const changed = await api('/v1/admin/products/' + PRODUCT + '/price', { method: 'PATCH', token: manager.token, body: { price: 950_000 } });
    assert.equal(changed.status, 200);
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='products.price' AND target=$1 ORDER BY id DESC LIMIT 1", [PRODUCT]);
    assert.deepEqual(audit.rows[0].details, { from: 900_000, to: 950_000 });
    await api('/v1/admin/products/' + PRODUCT + '/price', { method: 'PATCH', token: owner.token, body: { price: 900_000 } });
  });
});

describe('order lifecycle', () => {
  const status = (id, next, token = manager.token) => api('/v1/admin/orders/' + id + '/status',
    { method: 'PATCH', token, body: { status: next } });

  it('walks a COD order through fulfilment with a readable history and no skipped steps', async () => {
    const order = await placeOrder(PRODUCT);
    const detail = await api('/v1/admin/orders/' + order.id, { token: staff.token });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.item.address.mobile, fields.mobile);
    assert.equal(detail.data.item.items[0].colorName, 'مشکی شب');
    assert.deepEqual(detail.data.item.nextStatuses, ['preparing', 'cancelled']);
    assert.equal((await status(order.id, 'preparing', staff.token)).status, 403, 'default staff cannot fulfil');
    assert.equal((await status(order.id, 'delivered')).status, 409);
    for (const next of ['preparing', 'shipped', 'delivered']) assert.equal((await status(order.id, next)).status, 200);
    assert.equal((await status(order.id, 'cancelled')).status, 409, 'a delivered order cannot be cancelled');
    const history = (await api('/v1/admin/orders/' + order.id, { token: manager.token })).data.item.history;
    assert.deepEqual(history.map(h => h.to), ['confirmed_cod', 'preparing', 'shipped', 'delivered']);
    assert.equal(history[1].actor, 'تست manager');
    assert.equal((await pool.query('SELECT payment_status FROM orders WHERE id=$1', [order.id])).rows[0].payment_status, 'unpaid',
      'a delivered COD order is still not recorded as paid');
  });

  it('records exactly one transition when two employees click at the same time', async () => {
    const order = await placeOrder(PRODUCT);
    const results = await Promise.all([status(order.id, 'preparing'), status(order.id, 'preparing', owner.token)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const rows = await pool.query("SELECT COUNT(*)::int AS n FROM order_status_history WHERE order_id=$1 AND to_status='preparing'", [order.id]);
    assert.equal(rows.rows[0].n, 1);
  });

  it('returns stock when a COD order is cancelled, exactly once', async () => {
    const before = await stockOf(PRODUCT);
    const order = await placeOrder(PRODUCT, { quantity: 2 });
    assert.equal(await stockOf(PRODUCT), before - 2);
    assert.equal((await status(order.id, 'preparing')).status, 200);
    const cancelled = await api('/v1/admin/orders/' + order.id + '/status', { method: 'PATCH', token: manager.token,
      body: { status: 'cancelled', note: 'انصراف مشتری تلفنی' } });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.restocked, 2);
    assert.equal(await stockOf(PRODUCT), before);
    assert.equal((await status(order.id, 'cancelled')).status, 409);
    assert.equal(await stockOf(PRODUCT), before);
    const history = (await api('/v1/admin/orders/' + order.id, { token: manager.token })).data.item.history;
    assert.equal(history.at(-1).note, 'انصراف مشتری تلفنی');
  });

  it('never lets an unpaid online order be confirmed, shipped or delivered', async () => {
    const before = await stockOf(PRODUCT);
    const order = await placeOrder(PRODUCT, { payment: 'online' });
    for (const next of ['preparing', 'shipped', 'delivered']) {
      const refused = await status(order.id, next, owner.token);
      assert.equal(refused.status, 409, next);
    }
    assert.equal((await api('/v1/admin/orders/' + order.id + '/status', { method: 'PATCH', token: owner.token,
      body: { status: 'paid' } })).status, 400);
    const listed = await api('/v1/admin/orders?status=pending_payment', { token: owner.token });
    const row = listed.data.items.find(item => item.id === order.id);
    assert.equal(row.paymentStatus, 'unpaid');
    assert.deepEqual(row.nextStatuses, ['cancelled']);
    assert.equal((await status(order.id, 'cancelled', owner.token)).status, 200);
    assert.equal(await stockOf(PRODUCT), before, 'online orders never reserved stock, so nothing is returned');
  });

  it('keeps what was ordered after the product is renamed, recoloured and archived', async () => {
    const order = await placeOrder(PRODUCT);
    const { etag, item } = await revision();
    const { status: _s, active: _a, ...current } = item;
    assert.equal((await put(owner.token, { ...current, name: 'نام تازه', colors: [{ ...current.colors[0], name: 'زغالی' }] }, etag)).status, 200);
    assert.equal((await api('/v1/admin/products/' + PRODUCT + '/visibility', { method: 'PATCH', token: owner.token,
      body: { active: false } })).data.status, 'archived');
    const detail = (await api('/v1/admin/orders/' + order.id, { token: owner.token })).data.item;
    assert.equal(detail.items[0].name, 'مانتو تست پنل');
    assert.equal(detail.items[0].colorName, 'مشکی شب');
    assert.equal(detail.items[0].productActive, false);
    const receipt = await fetch(base + '/v1/orders/' + order.id, { headers: { Authorization: 'Bearer ' + order.accessToken } });
    assert.equal((await receipt.json()).items[0].name, 'مانتو تست پنل');
    assert.equal((await api('/v1/admin/products/' + PRODUCT + '/visibility', { method: 'PATCH', token: owner.token,
      body: { active: true } })).data.status, 'active');
  });

  it('searches and pages orders by customer mobile, including Persian digits', async () => {
    const found = await api('/v1/admin/orders?q=' + encodeURIComponent('۰۹۱۲۱۱۱') + '&limit=2', { token: staff.token });
    assert.equal(found.status, 200);
    assert.equal(found.data.items.length, 2);
    assert.ok(found.data.total >= 2);
    assert.equal(found.data.items[0].mobile, undefined, 'the list does not expose mobile numbers');
  });
});

describe('catalog management', () => {
  it('pages, searches and separates drafts from archived products on the server', async () => {
    const page = await api('/v1/admin/products?limit=5&page=2', { token: staff.token });
    assert.equal(page.status, 200);
    assert.equal(page.data.items.length, 5);
    assert.ok(page.data.total >= 37);
    const draftId = 'it-draft-' + run;
    assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token,
      body: productBody({ id: draftId, slug: draftId, name: 'پیش‌نویس تست' }) })).status, 201);
    const drafts = await api('/v1/admin/products?status=draft&q=' + draftId, { token: owner.token });
    assert.deepEqual(drafts.data.items.map(i => [i.id, i.status]), [[draftId, 'draft']]);
    assert.equal((await api('/v1/admin/products?status=archived&q=' + draftId, { token: owner.token })).data.total, 0);
    const search = await api('/v1/admin/products?q=' + encodeURIComponent('پیش‌نویس تست'), { token: owner.token });
    assert.ok(search.data.items.some(i => i.id === draftId), 'Persian name search');
  });
});

describe('reports', () => {
  it('reports real database counts in Tehran days and the current Persian month', async () => {
    const first = (await api('/v1/admin/reports/overview', { token: manager.token })).data;
    assert.equal(first.period.calendar, 'persian');
    assert.match(first.period.monthStart, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(first.paymentVerificationAvailable, false);
    assert.equal(first.trend.length, 7);
    const cod = await placeOrder(PRODUCT);
    const online = await placeOrder(PRODUCT, { payment: 'online' });
    const second = (await api('/v1/admin/reports/overview', { token: manager.token })).data;
    assert.equal(second.orders.today, first.orders.today + 2);
    assert.equal(second.orders.month, first.orders.month + 2);
    assert.equal(second.orders.pendingOnline, first.orders.pendingOnline + 1);
    assert.equal(BigInt(second.orders.pendingOnlineValue) - BigInt(first.orders.pendingOnlineValue), BigInt(online.totals.total));
    assert.equal(second.trend.at(-1).orders, first.trend.at(-1).orders + 2);
    for (const next of ['cancelled']) await api('/v1/admin/orders/' + online.id + '/status', { method: 'PATCH', token: owner.token, body: { status: next } });
    for (const next of ['preparing', 'shipped', 'delivered']) await api('/v1/admin/orders/' + cod.id + '/status', { method: 'PATCH', token: owner.token, body: { status: next } });
    const third = (await api('/v1/admin/reports/overview', { token: manager.token })).data;
    assert.equal(third.orders.today, first.orders.today + 1, 'cancelled orders are not counted');
    assert.equal(third.orders.pendingOnline, first.orders.pendingOnline);
    assert.equal(third.delivered.todayOrders, second.delivered.todayOrders + 1);
    assert.equal(BigInt(third.delivered.monthValue) - BigInt(second.delivered.monthValue), BigInt(cod.totals.total));
    const products = third.products;
    assert.equal(products.active + products.draft + products.archived, products.total);
  });
});

describe('image uploads', () => {
  it('accepts only real JPEG/PNG/WebP images up to 2 MiB and never serves paths outside the store', async () => {
    assert.equal((await upload(owner.token, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/png')).status, 415);
    assert.equal((await upload(owner.token, png, 'image/svg+xml')).status, 415);
    assert.equal((await upload(owner.token, png, 'image/webp')).status, 415);
    assert.equal((await upload(owner.token, Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]))).status, 413);
    for (const path of ['/v1/media/..%2F..%2Fetc%2Fpasswd', '/v1/media/' + randomUUID() + '.png', '/v1/media/x.svg'])
      assert.equal((await fetch(base + path)).status, 404, path);
    const served = await fetch(base + '/v1/media/' + image.split('/').at(-1));
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    assert.match(served.headers.get('content-security-policy'), /sandbox/);
  });
});
