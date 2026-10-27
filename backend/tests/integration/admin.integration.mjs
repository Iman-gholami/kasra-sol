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
/** The PUT body: everything the editor sends, without read-only state. */
const editable = item => { const body = { ...item }; delete body.status; delete body.active; return body; };
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
  it('manages custom roles without escalating privileges or deleting assigned roles', async () => {
    const roleBody = { name: 'مسئول سفارش ' + run, permissions: ['orders:read'] };
    assert.equal((await api('/v1/admin/roles', { method: 'POST', token: manager.token, body: roleBody })).status, 403);
    assert.equal((await api('/v1/admin/roles', { method: 'POST', token: owner.token,
      body: { ...roleBody, permissions: ['staff:manage'] } })).status, 400);
    const made = await api('/v1/admin/roles', { method: 'POST', token: owner.token, body: roleBody });
    assert.equal(made.status, 201);
    const roleId = made.data.role.id;
    assert.equal((await api('/v1/admin/roles', { method: 'POST', token: owner.token, body: roleBody })).status, 409);
    const newUsername = 'role_' + run + '_' + clients;
    const newPassword = secret();
    const created = await api('/v1/admin/staff', { method: 'POST', token: owner.token, body: {
      username: newUsername, displayName: 'کارمند سفارش', password: newPassword, role: 'staff', customRoleId: roleId
    } });
    assert.equal(created.status, 201);
    assert.deepEqual(created.data.user.permissions, ['orders:read']);
    assert.equal(created.data.user.customRoleName, roleBody.name);
    const accountId = created.data.user.id;
    let token = (await login(newUsername, newPassword)).data.token;
    assert.equal((await api('/v1/admin/orders', { token })).status, 200);
    assert.equal((await api('/v1/admin/products', { token })).status, 403);
    assert.equal((await api('/v1/admin/roles/' + roleId, { method: 'DELETE', token: owner.token })).status, 409);
    assert.equal((await api('/v1/admin/roles/' + roleId, { method: 'PUT', token: owner.token,
      body: { ...roleBody, permissions: ['products:read'] } })).status, 200);
    assert.equal((await api('/v1/admin/auth/me', { token })).status, 401, 'role edits end assigned sessions');
    token = (await login(newUsername, newPassword)).data.token;
    assert.equal((await api('/v1/admin/products', { token })).status, 200);
    assert.equal((await api('/v1/admin/orders', { token })).status, 403);
    assert.equal((await api('/v1/admin/staff/' + accountId, { method: 'PATCH', token: owner.token,
      body: { role: 'staff', customRoleId: null } })).status, 200);
    assert.equal((await api('/v1/admin/roles/' + roleId, { method: 'DELETE', token: owner.token })).status, 200);
    assert.equal((await api('/v1/admin/roles/' + roleId, { method: 'DELETE', token: owner.token })).status, 404);
    const audit = await pool.query("SELECT action FROM admin_audit_log WHERE target=$1 ORDER BY id", [roleId]);
    assert.deepEqual(audit.rows.map(row => row.action), ['staff.role_created', 'staff.role_updated', 'staff.role_deleted']);
  });
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
    const current = editable(item);
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
  it('preserves SKUs reserved by open COD orders and refuses partial cancellation of missing SKUs', async () => {
    const id = 'it-reserved-' + run;
    assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token,
      body: productBody({ id, slug: id }) })).status, 201);
    await api('/v1/admin/products/' + id + '/visibility', { method: 'PATCH', token: owner.token, body: { active: true } });
    const order = await placeOrder(id);
    const latest = (await api('/v1/admin/products/' + id, { token: owner.token })).data;
    const withoutM = { ...editable(latest.item), sizes: ['L'], variants: latest.item.variants.filter(v => v.size === 'L') };
    const edit = await api('/v1/admin/products/' + id, { method: 'PUT', token: owner.token,
      headers: { 'If-Match': '"' + latest.revision + '"' }, body: withoutM });
    assert.equal(edit.status, 409);
    assert.equal(edit.data.error, 'variant_reserved_by_order');
    assert.equal(await stockOf(id), 9);
    // Simulate already-damaged legacy data in the disposable test database only.
    await pool.query("DELETE FROM product_variants WHERE product_id=$1 AND size='M'", [id]);
    const cancel = () => api('/v1/admin/orders/' + order.id + '/status', {
      method: 'PATCH', token: owner.token, body: { status: 'cancelled' } });
    assert.equal((await cancel()).data.error, 'restock_variant_missing');
    assert.equal((await api('/v1/admin/orders/' + order.id, { token: owner.token })).data.item.status, 'confirmed_cod');
    await pool.query("INSERT INTO product_variants(product_id,color_id,size,stock) VALUES($1,'black','M',9)", [id]);
    assert.equal((await cancel()).status, 200);
    assert.equal(await stockOf(id), 10);
    const fresh = (await api('/v1/admin/products/' + id, { token: owner.token })).data;
    assert.equal((await api('/v1/admin/products/' + id, { method: 'PUT', token: owner.token,
      headers: { 'If-Match': '"' + fresh.revision + '"' }, body: withoutM })).status, 200);
  });
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
    const current = editable(item);
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

  it('keeps a published product sellable: it never loses its last photo or becomes free', async () => {
    const { etag, item } = await revision();
    const current = editable(item);
    assert.deepEqual((await put(owner.token, { ...current, images: [] }, etag)).data, { error: 'image_required_to_publish' });
    assert.deepEqual((await put(owner.token, { ...current, price: 0, compareAt: null }, etag)).data,
      { error: 'price_required_to_publish' });
    const free = await api('/v1/admin/products/' + PRODUCT + '/price', { method: 'PATCH', token: owner.token, body: { price: 0 } });
    assert.deepEqual([free.status, free.data.error], [409, 'price_required_to_publish']);
    assert.equal((await revision()).etag, etag, 'refused edits change nothing');
    // A draft may be saved incomplete, but cannot be published until it has a photo and a price.
    const id = 'it-unpriced-' + run;
    assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token,
      body: productBody({ id, slug: id, images: [], price: 0, compareAt: null }) })).status, 201);
    const publish = () => api('/v1/admin/products/' + id + '/visibility', { method: 'PATCH', token: owner.token, body: { active: true } });
    assert.equal((await publish()).data.error, 'image_required_to_publish');
    const draft = await api('/v1/admin/products/' + id, { token: owner.token });
    assert.equal((await api('/v1/admin/products/' + id, { method: 'PUT', token: owner.token,
      body: { ...editable(draft.data.item), images: [image] }, headers: { 'If-Match': '"' + draft.data.revision + '"' } })).status, 200);
    assert.equal((await publish()).data.error, 'price_required_to_publish');
    assert.equal((await api('/v1/admin/products/' + id + '/price', { method: 'PATCH', token: owner.token, body: { price: 450_000 } })).status, 200);
    assert.equal((await publish()).data.status, 'active');
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
    const current = editable(item);
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

describe('order export and history filters', () => {
  const download = (query, token) => fetch(base + '/v1/admin/orders/export?' + query,
    { headers: { Authorization: 'Bearer ' + token, 'X-Forwarded-For': nextIp() } });

  it('exports the filtered orders as an audited, formula-safe CSV only with orders:export', async () => {
    const name = '=HYPERLINK("http://evil.example","x") ' + run;
    const placed = await api('/v1/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: {
      items: [{ productId: PRODUCT, colorId: 'black', size: 'M', quantity: 1 }], fields: { ...fields, name },
      shipping: 'courier', payment: 'cod', code: '' } });
    assert.equal(placed.status, 201);
    const response = await download('status=all&period=today&q=' + encodeURIComponent(run), manager.token);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/csv/);
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="kasra-orders-\d{4}-\d{2}-\d{2}\.csv"$/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM for Excel');
    const lines = bytes.toString('utf8').slice(1).trimEnd().split('\r\n');
    assert.equal(lines.length, 2, 'header and the one matching order');
    assert.ok(lines[1].includes(placed.data.id));
    assert.ok(lines[1].includes(`"'=HYPERLINK(""http://evil.example"",""x"") ${run}"`), 'formula neutralised');
    assert.ok(lines[1].includes('="09121112233"'));
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='orders.exported' ORDER BY id DESC LIMIT 1");
    assert.deepEqual(audit.rows[0].details, { count: 1, status: 'all', period: 'today', search: true });
    assert.equal((await download('status=all', staff.token)).status, 403, 'default staff cannot bulk-export customers');
    const granted = await account('staff', { grants: ['orders:export'] });
    assert.equal((await download('status=all&period=today', granted.token)).status, 200);
    assert.equal((await download('period=year', manager.token)).status, 400);
  });

  it('filters orders by Tehran period without hiding older ones from «all»', async () => {
    const order = await placeOrder(PRODUCT);
    const list = query => api('/v1/admin/orders?status=all&q=' + order.id.slice(0, 8) + '&' + query, { token: staff.token });
    assert.equal((await list('period=today')).data.total, 1);
    await pool.query("UPDATE orders SET created_at=now() - interval '40 days' WHERE id=$1", [order.id]);
    assert.equal((await list('period=30d')).data.total, 0);
    assert.equal((await list('period=7d')).data.total, 0);
    assert.equal((await list('period=all')).data.total, 1);
    assert.equal((await list('')).data.total, 1);
  });

  it('filters the activity history by event group and by account, and names what each entry is about', async () => {
    const byGroup = await api('/v1/admin/audit?group=orders', { token: owner.token });
    assert.equal(byGroup.status, 200);
    assert.ok(byGroup.data.items.length > 0);
    assert.ok(byGroup.data.items.every(item => item.action.startsWith('orders.')));
    const byActor = await api('/v1/admin/audit?actor=' + manager.id, { token: owner.token });
    assert.ok(byActor.data.items.length > 0);
    assert.ok(byActor.data.items.every(item => item.actor === manager.username));
    const price = byActor.data.items.find(item => item.action === 'products.price');
    assert.equal(price.targetName, (await revision()).item.name);
    const login = (await api('/v1/admin/audit?group=auth&actor=' + manager.id, { token: owner.token })).data.items
      .find(item => item.action === 'auth.login');
    assert.equal(login.targetName, 'تست manager');
    assert.equal((await api('/v1/admin/audit?group=secrets', { token: owner.token })).status, 400);
    assert.equal((await api('/v1/admin/audit?group=orders', { token: manager.token })).status, 403);
  });
});

describe('catalog management', () => {
  it('matches color families and size/stock on the same SKU in the live catalog', async () => {
    const id = 'it-color-' + run;
    const body = productBody({ id, slug: id, sizes: ['XXL', 'XXXL'],
      colors: [{ id: 'night', familyId: 'midnight', name: 'شب', hex: '#111111' }],
      variants: [{ colorId: 'night', size: 'XXL', stock: 2 }, { colorId: 'night', size: 'XXXL', stock: 0 }] });
    assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token, body })).status, 201);
    await api('/v1/admin/products/' + id + '/visibility', { method: 'PATCH', token: owner.token, body: { active: true } });
    for (const [size, expected] of [['XXL', true], ['XXXL', false]]) {
      const result = await api('/v1/products?color=midnight&size=' + size + '&stock=1');
      assert.equal(result.status, 200);
      assert.equal(result.data.items.some(item => item.id === id), expected);
    }
  });
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

describe('home page slider', () => {
  const save = (token, productIds) => api('/v1/admin/home-slider', { method: 'PUT', token, body: { productIds } });
  const shown = async () => (await api('/v1/home/slider')).data.items.map(item => item.id);

  it('lets managers order published products and refuses staff, duplicates and unpublished picks', async () => {
    const pick = ['manto-03', 'shomiz-01', PRODUCT];
    assert.equal((await save(staff.token, pick)).status, 403);
    assert.equal((await save(manager.token, ['manto-03', 'manto-03'])).status, 400);
    assert.equal((await save(manager.token, Array.from({ length: 6 }, (_, i) => 'manto-0' + (i + 1)))).status, 400);
    const draftId = 'it-slide-draft-' + run;
    assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token,
      body: productBody({ id: draftId, slug: draftId }) })).status, 201);
    const unpublished = await save(manager.token, ['manto-03', draftId]);
    assert.deepEqual([unpublished.status, unpublished.data.error], [409, 'slide_unavailable']);

    const saved = await save(manager.token, pick);
    assert.equal(saved.status, 200);
    assert.deepEqual(await shown(), pick, 'public order follows the pick');
    const listed = await api('/v1/admin/home-slider', { token: staff.token });
    assert.equal(listed.status, 200, 'staff may read the pick');
    assert.deepEqual(listed.data.items.map(item => item.id), pick);
    const audit = await pool.query("SELECT details FROM admin_audit_log WHERE action='products.home_slider' AND actor_id=$1",
      [manager.id]);
    assert.deepEqual(audit.rows.at(-1).details.to, pick);
  });

  it('drops archived products from the public slider and accepts an empty pick', async () => {
    const id = 'it-slide-' + run;
    assert.equal((await api('/v1/admin/products', { method: 'POST', token: owner.token,
      body: productBody({ id, slug: id }) })).status, 201);
    await api('/v1/admin/products/' + id + '/visibility', { method: 'PATCH', token: owner.token, body: { active: true } });
    assert.equal((await save(owner.token, [id, 'shomiz-01'])).status, 200);
    assert.deepEqual(await shown(), [id, 'shomiz-01']);
    await api('/v1/admin/products/' + id + '/visibility', { method: 'PATCH', token: owner.token, body: { active: false } });
    assert.deepEqual(await shown(), ['shomiz-01'], 'archived product leaves the slider');
    const listed = await api('/v1/admin/home-slider', { token: owner.token });
    assert.deepEqual(listed.data.items.map(item => [item.id, item.status]), [[id, 'archived'], ['shomiz-01', 'active']]);
    assert.equal((await save(owner.token, [])).status, 200);
    assert.deepEqual(await shown(), []);
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

describe('traffic statistics', () => {
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const view = (path, { ua = CHROME, ip = nextIp(), referrer } = {}) => fetch(base + '/v1/analytics/view', {
    method: 'POST', body: JSON.stringify({ path, ...(referrer ? { referrer } : {}) }),
    headers: { 'Content-Type': 'application/json', 'User-Agent': ua, 'X-Forwarded-For': ip } });
  const traffic = async (token = manager.token) => (await api('/v1/admin/reports/traffic?days=7', { token })).data;

  it('includes more than 50 referring hosts in source totals while bounding the displayed list', async () => {
    const before = await traffic();
    for (let index = 0; index < 55; index++) {
      assert.equal((await view('/shop', { referrer: `https://audit-${run}-${index}.example/page` })).status, 204);
    }
    const after = await traffic();
    assert.equal(after.totals.views - before.totals.views, 55);
    assert.equal(after.sources.reduce((sum, source) => sum + source.views, 0), after.totals.views);
    assert.equal(after.sources.find(source => source.source === 'other').views -
      before.sources.find(source => source.source === 'other').views, 55);
    assert.ok(after.referrers.length <= 8);
  });

  it('counts real page views and daily visitors, ignores bots and back-office pages, and reports them', async () => {
    const before = await traffic();
    const phone = nextIp(), desk = nextIp();
    for (const [path, ua, ip, referrer] of [
      ['/product/' + PRODUCT, IPHONE, phone, 'https://www.google.com/search?q=private'], ['/shop?q=09121112233', IPHONE, phone],
      ['/product/' + PRODUCT, CHROME, desk, 'https://l.instagram.com/x'], ['/', CHROME, desk]
    ]) assert.equal((await view(path, { ua, ip, referrer })).status, 204);
    assert.equal((await view('/admin', { ip: desk })).status, 204);
    assert.equal((await view('/', { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' })).status, 204);
    assert.equal((await view('/', { ua: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/130.0 Safari/537.36' })).status, 204);
    const after = await traffic();
    assert.equal(after.today.views - before.today.views, 4, 'bots and /admin are not counted');
    assert.equal(after.today.visitors - before.today.visitors, 2, 'one visitor per address and browser per day');
    assert.ok(after.live >= 2);
    const product = after.products.find(p => p.slug === PRODUCT);
    assert.equal(product.views - (before.products.find(p => p.slug === PRODUCT)?.views ?? 0), 2);
    assert.equal(product.name, (await revision()).item.name);
    const sources = Object.fromEntries(after.sources.map(s => [s.source, s.views]));
    const was = Object.fromEntries(before.sources.map(s => [s.source, s.views]));
    assert.equal(sources.search - was.search, 1);
    assert.equal(sources.social - was.social, 1);
    assert.equal(sources.direct - was.direct, 2);
    const devices = Object.fromEntries(after.devices.map(d => [d.device, d.views]));
    const hadDevices = Object.fromEntries(before.devices.map(d => [d.device, d.views]));
    assert.equal(devices.mobile - hadDevices.mobile, 2);
    assert.equal(devices.desktop - hadDevices.desktop, 2);
    assert.equal(after.daily.length, 7);
    assert.equal(after.hours.length, 24);
    assert.ok(after.pages.some(p => p.path === '/shop'), 'query strings are dropped');
  });

  it('stores no address, browser string, query or referrer path, and is reserved for report readers', async () => {
    const columns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='page_views'")).rows
      .map(row => row.column_name).sort();
    assert.deepEqual(columns, ['day', 'device', 'id', 'path', 'product_slug', 'referrer_host', 'viewed_at', 'visitor']);
    const leaked = await pool.query("SELECT COUNT(*)::int AS n FROM page_views WHERE path LIKE '%?%' OR referrer_host LIKE '%/%' OR visitor !~ '^[a-f0-9]{32}$'");
    assert.equal(leaked.rows[0].n, 0);
    assert.equal((await api('/v1/admin/reports/traffic?days=7', { token: staff.token })).status, 403);
    assert.equal((await api('/v1/admin/reports/traffic?days=7')).status, 401);
    assert.equal((await api('/v1/admin/reports/traffic?days=5', { token: owner.token })).status, 400);
    assert.equal((await api('/v1/admin/reports/traffic?days=90', { token: owner.token })).data.daily.length, 90);
  });
});
