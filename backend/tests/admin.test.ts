import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectivePermissions, may, assignable } from '../src/admin/permissions';
import { hashPassword, verifyPassword } from '../src/admin/password';

test('owner always has all permissions', () => {
  assert.equal(may('owner', [], ['products:price'], 'products:price'), true);
  assert.equal(may('owner', [], [], 'staff:manage'), true);
});
test('staff cannot change prices without explicit owner grant', () => {
  assert.equal(may('staff', [], [], 'products:price'), false);
  assert.equal(may('staff', ['products:price'], [], 'products:price'), true);
  assert.equal(may('staff', ['products:price'], ['products:price'], 'products:price'), false);
});
test('owner-only permissions cannot be delegated through grant arrays', () => {
  assert.equal(assignable(['staff:manage']), false);
  assert.equal(assignable(['payments:configure']), false);
  assert.equal(assignable(['inventory:write', 'orders:fulfill']), true);
  assert.equal(effectivePermissions('manager', [], []).includes('staff:manage'), false);
  assert.equal(effectivePermissions('staff', ['staff:manage'], []).includes('staff:manage'), false);
});
test('password hashing uses random salts and rejects incorrect passwords', async () => {
  const first = await hashPassword('correct horse battery staple');
  const second = await hashPassword('correct horse battery staple');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('correct horse battery staple', first), true);
  assert.equal(await verifyPassword('wrong passphrase', first), false);
  assert.equal(await verifyPassword('anything', 'malformed'), false);
  await assert.rejects(hashPassword('short'));
});
test('bulk order export is a manager default and a staff opt-in', () => {
  assert.equal(may('manager', [], [], 'orders:export'), true);
  assert.equal(may('staff', [], [], 'orders:export'), false);
  assert.equal(may('staff', ['orders:export'], [], 'orders:export'), true);
  assert.equal(assignable(['orders:export']), true);
});
