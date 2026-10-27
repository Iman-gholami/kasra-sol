import { it } from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, assignable, effectivePermissions, may, type Permission } from '../src/admin/permissions';

const OWNER_ONLY: Permission[] = ['staff:manage', 'payments:configure'];

it('gives each role its documented defaults', () => {
  assert.deepEqual(effectivePermissions('owner').sort(), [...PERMISSIONS].sort());
  assert.deepEqual(effectivePermissions('manager').sort(), ['inventory:read', 'inventory:write', 'orders:export',
    'orders:fulfill', 'orders:read', 'products:price', 'products:read', 'products:write', 'reports:read']);
  assert.deepEqual(effectivePermissions('staff').sort(), ['inventory:read', 'orders:read', 'products:read']);
});
it('never lets a manager or staff member hold an owner-only permission, whatever their grants', () => {
  for (const role of ['manager', 'staff'] as const)
    for (const permission of OWNER_ONLY) assert.equal(may(role, [...PERMISSIONS], [], permission), false, role + ' ' + permission);
});
it('applies a revoke over both the defaults and a grant', () => {
  assert.equal(may('manager', [], ['products:price'], 'products:price'), false);
  assert.equal(may('staff', ['reports:read'], ['reports:read'], 'reports:read'), false);
  assert.equal(may('owner', [], [...PERMISSIONS], 'staff:manage'), true, 'the owner cannot be locked out');
});
it('lets the owner grant every permission except owner-only ones, and nothing unknown', () => {
  for (const permission of PERMISSIONS) assert.equal(assignable([permission]), !OWNER_ONLY.includes(permission), permission);
  assert.equal(assignable([]), true);
  assert.equal(assignable(['orders:delete']), false);
  assert.equal(assignable(['orders:read', 'staff:manage']), false);
});
it('does not repeat permissions', () => {
  const all = effectivePermissions('staff', ['orders:read', 'orders:read', 'reports:read'], []);
  assert.equal(new Set(all).size, all.length);
});
