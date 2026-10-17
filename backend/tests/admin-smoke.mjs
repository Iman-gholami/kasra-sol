import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const base = 'http://127.0.0.1:4000';
async function call(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method, headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}
const temporary = mkdtempSync(join(tmpdir(), 'kasra-admin-ci-'));
const ownerPassword = randomBytes(32).toString('hex');
const staffPassword = randomBytes(24).toString('hex');
try {
  const file = join(temporary, 'owner-pass');
  writeFileSync(file, ownerPassword + '\n', { mode: 0o600 });
  const bootstrap = spawnSync(process.execPath, ['dist/admin/bootstrap.js', 'owner_ci', file], { encoding: 'utf8' });
  assert.equal(bootstrap.status, 0, 'Owner bootstrap failed: ' + bootstrap.stderr);
  assert.equal((await call('/v1/admin/staff')).status, 401);
  assert.equal((await call('/v1/admin/products')).status, 401);
  assert.equal((await call('/v1/admin/stock', 'PUT', { productId: 'manto-01' })).status, 404,
    'Legacy API-key inventory route should be disabled by default');

  const ownerLogin = await call('/v1/admin/auth/login', 'POST', { username: 'owner_ci', password: ownerPassword });
  assert.equal(ownerLogin.status, 200);
  const owner = ownerLogin.data.token;
  assert.match(owner, /^[a-f0-9]{64}$/);
  assert.equal(ownerLogin.data.user.role, 'owner');

  const created = await call('/v1/admin/staff', 'POST', {
    username: 'staff_ci', displayName: 'کارمند آزمایشی', password: staffPassword, role: 'staff'
  }, owner);
  assert.equal(created.status, 201);
  const staffId = created.data.user.id;

  const staffLogin = await call('/v1/admin/auth/login', 'POST', { username: 'staff_ci', password: staffPassword });
  assert.equal(staffLogin.status, 200);
  const staff = staffLogin.data.token;
  assert.equal((await call('/v1/admin/staff', 'GET', undefined, staff)).status, 403);
  assert.equal((await call('/v1/admin/products/manto-01/price', 'PATCH', { price: 1000 }, staff)).status, 403);
  assert.equal((await call('/v1/admin/orders', 'GET', undefined, staff)).status, 200);

  const elevated = await call('/v1/admin/staff/' + staffId, 'PATCH', {
    grants: ['products:price']
  }, owner);
  assert.equal(elevated.status, 200);
  assert.equal((await call('/v1/admin/auth/me', 'GET', undefined, staff)).status, 401,
    'Changing employee access must revoke existing sessions');

  const newLogin = await call('/v1/admin/auth/login', 'POST', { username: 'staff_ci', password: staffPassword });
  assert.equal(newLogin.status, 200);
  const currentPrice = (await call('/v1/admin/products', 'GET', undefined, owner)).data.items
    .find(item => item.id === 'manto-01').price;
  const priceChange = await call('/v1/admin/products/manto-01/price', 'PATCH', { price: currentPrice + 1 }, newLogin.data.token);
  assert.equal(priceChange.status, 200);
  // Restore the original value on the ephemeral CI database.
  assert.equal((await call('/v1/admin/products/manto-01/price', 'PATCH', { price: currentPrice }, owner)).status, 200);
  const audit = await call('/v1/admin/audit', 'GET', undefined, owner);
  assert.equal(audit.status, 200);
  assert.ok(audit.data.items.some(entry => entry.action === 'products.price'));

  const disabled = await call('/v1/admin/staff/' + staffId, 'PATCH', { active: false }, owner);
  assert.equal(disabled.status, 200);
  assert.equal((await call('/v1/admin/auth/login', 'POST', { username: 'staff_ci', password: staffPassword })).status, 401);
  console.log('Admin RBAC, password sessions, price guard and audit smoke test passed');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
