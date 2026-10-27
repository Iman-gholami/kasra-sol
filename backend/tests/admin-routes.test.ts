// Every admin endpoint checks a session and a permission before it touches data. These tests run the real
// route handlers with Fastify's inject() against an in-memory database stand-in, so a new or changed endpoint
// that forgets its permission check fails here, without needing PostgreSQL.
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { database, queries, type Query } from './support/fake-db';
import { PERMISSIONS, assignable, type Permission, type Role } from '../src/admin/permissions';
import { hashPassword } from '../src/admin/password';

const { adminRoutes } = await import('../src/admin/routes');

const UUID = '0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e';
const TOKEN = 'c'.repeat(64);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const isSessionLookup = (query: Query) => query.text.includes('FROM admin_sessions s JOIN admin_users u');
const grantable = PERMISSIONS.filter(p => assignable([p]));

// The permission each endpoint requires. A new admin endpoint must be added here (see the coverage test).
const ENDPOINTS: [method: string, route: string, permission: Permission][] = [
  ['GET', '/v1/admin/staff', 'staff:manage'],
  ['POST', '/v1/admin/staff', 'staff:manage'],
  ['PATCH', '/v1/admin/staff/:id', 'staff:manage'],
  ['PUT', '/v1/admin/staff/:id/password', 'staff:manage'],
  ['GET', '/v1/admin/audit', 'staff:manage'],
  ['GET', '/v1/admin/products', 'products:read'],
  ['GET', '/v1/admin/products/:id', 'products:read'],
  ['GET', '/v1/admin/products/:id/variants', 'inventory:read'],
  ['POST', '/v1/admin/products', 'products:write'],
  ['PUT', '/v1/admin/products/:id', 'products:write'],
  ['PATCH', '/v1/admin/products/:id/price', 'products:price'],
  ['PATCH', '/v1/admin/products/:id/visibility', 'products:write'],
  ['PATCH', '/v1/admin/variants/:id/stock', 'inventory:write'],
  ['GET', '/v1/admin/orders', 'orders:read'],
  ['GET', '/v1/admin/orders/export', 'orders:export'],
  ['GET', '/v1/admin/orders/:id', 'orders:read'],
  ['PATCH', '/v1/admin/orders/:id/status', 'orders:fulfill'],
  ['POST', '/v1/admin/media', 'products:write'],
  ['GET', '/v1/admin/reports/overview', 'reports:read'],
  ['GET', '/v1/admin/reports/traffic', 'reports:read'],
  ['GET', '/v1/admin/home-slider', 'products:read'],
  ['PUT', '/v1/admin/home-slider', 'products:write']
];
// Session endpoints work for any signed-in account; the public image route needs no session.
const SESSION_ONLY = ['POST /v1/admin/auth/login', 'GET /v1/admin/auth/me', 'POST /v1/admin/auth/logout',
  'POST /v1/admin/auth/password', 'GET /v1/media/:file'];
const concrete = (route: string) => route.replace('/products/:id', '/products/manto-01').replace(':id', UUID);

type Account = { id?: string; role: Role; grants?: Permission[]; revokes?: Permission[] };
/** Signs `account` in under TOKEN; every other query gets `rest` (default: an error, i.e. "past the guard"). */
function signedIn(account: Account, rest?: (query: Query) => { rows: unknown[]; rowCount?: number }) {
  database(query => {
    if (isSessionLookup(query)) return { rows: query.values[0] === sha256(TOKEN) ? [{ id: account.id ?? 'user-1',
      username: 'someone', display_name: 'کاربر', role: account.role, grants: account.grants ?? [],
      revokes: account.revokes ?? [], active: true }] : [] };
    if (rest) return rest(query);
    throw new Error('reached the data layer');
  });
}
const send = (app: FastifyInstance, method: string, url: string, payload: unknown = {}, token: string | null = TOKEN) =>
  app.inject({ method: method as 'GET', url, headers: token ? { authorization: 'Bearer ' + token } : {},
    ...(method === 'GET' ? {} : { payload: payload as object }) });

let app: FastifyInstance;
const registered: string[] = [];
beforeEach(async () => {
  if (app) return;
  app = Fastify();
  app.addHook('onRoute', route => { if (route.method !== 'HEAD') registered.push(route.method + ' ' + route.url); });
  await app.register(adminRoutes, {});
  await app.ready();
});

describe('admin endpoint permissions', () => {
  it('lists the required permission of every registered admin endpoint', () => {
    const known = [...ENDPOINTS.map(([method, route]) => method + ' ' + route), ...SESSION_ONLY];
    assert.deepEqual([...registered].sort(), [...known].sort());
  });

  it('answers 401 without a session, before reading anything', async () => {
    for (const [method, route] of ENDPOINTS) {
      database();
      const response = await send(app, method, concrete(route), {}, null);
      assert.equal(response.statusCode, 401, method + ' ' + route);
      assert.deepEqual(response.json(), { error: 'unauthorized' });
      assert.equal(queries.length, 0, method + ' ' + route + ' queried the database');
    }
  });

  it('answers 401 for an unknown or malformed session token', async () => {
    signedIn({ role: 'owner' });
    assert.equal((await send(app, 'GET', '/v1/admin/products', {}, 'd'.repeat(64))).statusCode, 401);
    assert.equal((await send(app, 'GET', '/v1/admin/products', {}, 'not-hex')).statusCode, 401);
  });

  it('answers 403 to an account that has every other permission, before reading anything else', async () => {
    for (const [method, route, permission] of ENDPOINTS) {
      // Owner-only permissions cannot be granted, so a manager with every grant still lacks them.
      signedIn({ role: 'manager', grants: grantable, revokes: [permission] });
      const response = await send(app, method, concrete(route));
      assert.equal(response.statusCode, 403, method + ' ' + route + ' without ' + permission);
      assert.deepEqual(response.json(), { error: 'forbidden' });
      assert.equal(queries.filter(q => !isSessionLookup(q)).length, 0, method + ' ' + route + ' read data first');
    }
  });

  it('lets an account with just that permission past the check', async () => {
    for (const [method, route, permission] of ENDPOINTS) {
      signedIn(assignable([permission]) ? { role: 'staff', grants: [permission] } : { role: 'owner' });
      const response = await send(app, method, concrete(route));
      assert.ok(![401, 403].includes(response.statusCode), method + ' ' + route + ' refused ' + permission);
    }
  });

  it('accepts the session token in either letter case', async () => {
    signedIn({ role: 'owner' });
    const response = await send(app, 'GET', '/v1/admin/auth/me', {}, TOKEN.toUpperCase());
    assert.equal(response.statusCode, 200);
  });
});

describe('the signed-in account', () => {
  it('describes itself with its effective permissions and never its password hash', async () => {
    signedIn({ role: 'staff', grants: ['orders:export'], revokes: ['inventory:read'] });
    const { user } = (await send(app, 'GET', '/v1/admin/auth/me')).json();
    assert.deepEqual(user.permissions.sort(), ['orders:export', 'orders:read', 'products:read']);
    assert.ok(!JSON.stringify(user).includes('password'));
  });

  it('cannot change its own role, permissions or password through staff management', async () => {
    signedIn({ id: UUID, role: 'owner' });
    const patched = await send(app, 'PATCH', '/v1/admin/staff/' + UUID, { active: false });
    assert.equal(patched.statusCode, 403);
    assert.deepEqual(patched.json(), { error: 'cannot_modify_self' });
    const reset = await send(app, 'PUT', '/v1/admin/staff/' + UUID + '/password', { password: 'a new long password' });
    assert.deepEqual(reset.json(), { error: 'use_own_password_change' });
  });

  it('cannot give an employee owner-only permissions', async () => {
    signedIn({ role: 'owner' });
    for (const grant of ['staff:manage', 'payments:configure']) {
      const response = await send(app, 'POST', '/v1/admin/staff', { username: 'new.staff', displayName: 'کارمند',
        password: 'a long enough password', role: 'staff', grants: [grant] });
      assert.equal(response.statusCode, 400, grant);
    }
  });
});

describe('product and order edits', () => {
  const product = { id: 'new-01', slug: 'new-01', name: 'محصول تازه', category: 'manto', description: 'توضیح کافی برای محصول',
    price: 900_000, compareAt: null, images: [], colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }], sizes: ['M'],
    variants: [{ colorId: 'black', size: 'M', stock: 0 }], material: 'نخ', fit: 'آزاد', care: 'دستی', featured: false };

  it('needs the price permission to create a product, and the inventory permission for opening stock', async () => {
    signedIn({ role: 'staff', grants: ['products:write'] });
    assert.equal((await send(app, 'POST', '/v1/admin/products', product)).statusCode, 403);
    signedIn({ role: 'staff', grants: ['products:write', 'products:price'] });
    const stocked = { ...product, variants: [{ colorId: 'black', size: 'M', stock: 5 }] };
    assert.equal((await send(app, 'POST', '/v1/admin/products', stocked)).statusCode, 403);
  });

  it('creates a product as an unpublished draft and records who did it', async () => {
    signedIn({ id: 'editor-1', role: 'staff', grants: ['products:write', 'products:price'] }, () => ({ rows: [] }));
    const response = await send(app, 'POST', '/v1/admin/products', product);
    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), { ok: true, id: 'new-01', active: false });
    const insert = queries.find(q => q.text.startsWith('INSERT INTO products'))!;
    assert.match(insert.text, /false,\$15\)/, 'inserted with active=false');
    const audit = queries.find(q => q.text.includes('admin_audit_log'))!;
    assert.deepEqual(audit.values.slice(0, 3), ['editor-1', 'products.created', 'new-01']);
    assert.ok(queries.some(q => q.text === 'COMMIT'));
  });

  it('refuses a full edit whose body describes a different product than the URL', async () => {
    signedIn({ role: 'owner' });
    const response = await send(app, 'PUT', '/v1/admin/products/manto-01', product);
    assert.equal(response.statusCode, 400);
  });

  it('cannot mark an order paid: staff may only record fulfilment steps', async () => {
    signedIn({ role: 'owner' });
    for (const status of ['paid', 'pending_payment', 'confirmed_cod'])
      assert.equal((await send(app, 'PATCH', '/v1/admin/orders/' + UUID + '/status', { status })).statusCode, 400, status);
  });
});

describe('login', () => {
  const owner = { id: UUID, username: 'owner', display_name: 'صاحب', role: 'owner', grants: [], revokes: [], active: true };
  let passwordHash = '';
  const login = (password: string, username = 'owner') =>
    app.inject({ method: 'POST', url: '/v1/admin/auth/login', payload: { username, password } });
  function accounts(rows: object[]) {
    database(query => query.text.startsWith('SELECT * FROM admin_users') ? { rows } : { rows: [] });
  }
  beforeEach(async () => { passwordHash ||= await hashPassword('the correct password'); });

  it('rejects a malformed request without looking anyone up', async () => {
    database();
    const response = await app.inject({ method: 'POST', url: '/v1/admin/auth/login', payload: { username: 'x', password: '' } });
    assert.equal(response.statusCode, 400);
    assert.equal(queries.length, 0);
  });

  it('gives the same answer for an unknown user, a wrong password, a disabled and a locked account', async () => {
    const answers = [];
    accounts([]);
    answers.push(await login('the correct password', 'nobody'));
    accounts([{ ...owner, password_hash: passwordHash }]);
    answers.push(await login('a wrong password!'));
    accounts([{ ...owner, active: false, password_hash: passwordHash }]);
    answers.push(await login('the correct password'));
    accounts([{ ...owner, password_hash: passwordHash, locked_until: new Date(Date.now() + 60_000) }]);
    answers.push(await login('the correct password'));
    for (const response of answers) {
      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), { error: 'invalid_credentials' });
    }
    assert.ok(!queries.some(q => q.text.includes('INSERT INTO admin_sessions')), 'no session for a locked account');
  });

  it('counts a wrong password towards locking the account, and audits the failure', async () => {
    accounts([{ ...owner, password_hash: passwordHash }]);
    await login('a wrong password!');
    assert.ok(queries.some(q => q.text.startsWith('UPDATE admin_users SET failed_logins=failed_logins+1')));
    assert.ok(queries.some(q => q.text.includes('admin_audit_log') && q.values[1] === 'auth.login_failed'));
  });

  it('issues a random token but stores only its hash', async () => {
    accounts([{ ...owner, password_hash: passwordHash }]);
    const response = await login('the correct password');
    assert.equal(response.statusCode, 200);
    const { token, user } = response.json();
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(user).includes(passwordHash));
    const stored = queries.find(q => q.text.startsWith('INSERT INTO admin_sessions'))!;
    assert.equal(stored.values[0], sha256(token));
    assert.ok(!JSON.stringify(queries.map(q => q.values)).includes(token), 'the raw token never reaches the database');
  });
});
