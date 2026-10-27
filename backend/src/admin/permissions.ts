export const PERMISSIONS = [
  'products:read', 'products:write', 'products:price',
  'inventory:read', 'inventory:write',
  'orders:read', 'orders:fulfill', 'orders:export', 'reports:read',
  'staff:manage', 'payments:configure'
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Role = 'owner' | 'manager' | 'staff';

const DEFAULTS: Record<Exclude<Role, 'owner'>, Permission[]> = {
  manager: ['products:read', 'products:write', 'products:price', 'inventory:read', 'inventory:write',
    'orders:read', 'orders:fulfill', 'orders:export', 'reports:read'],
  // Staff see one order at a time; a bulk file of customer phones and addresses needs an explicit grant.
  staff: ['products:read', 'inventory:read', 'orders:read']
};
const OWNER_ONLY: Permission[] = ['staff:manage', 'payments:configure'];

export function assignable(permissions: string[]): permissions is Permission[] {
  return permissions.every(p => PERMISSIONS.includes(p as Permission) && !OWNER_ONLY.includes(p as Permission));
}
export function effectivePermissions(role: Role, grants: Permission[] = [], revokes: Permission[] = [],
  customPermissions?: Permission[] | null): Permission[] {
  if (role === 'owner') return [...PERMISSIONS];
  const base = customPermissions ?? DEFAULTS[role];
  const allowed = new Set<Permission>([...base, ...grants].filter(p => PERMISSIONS.includes(p) && !OWNER_ONLY.includes(p)));
  for (const item of revokes) allowed.delete(item);
  return [...allowed];
}
export function may(role: Role, grants: Permission[], revokes: Permission[], permission: Permission,
  customPermissions?: Permission[] | null) {
  return effectivePermissions(role, grants, revokes, customPermissions).includes(permission);
}
