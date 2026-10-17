import { expect, test as setup } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACCOUNTS_FILE, API, type Accounts } from './helpers';

// The owner is created with the real one-time bootstrap CLI; employees are created by the owner through the API.
setup('bootstrap the owner and create manager and staff accounts', async ({ request }) => {
  const owner = { username: 'owner_e2e', password: randomBytes(18).toString('hex') };
  const dir = mkdtempSync(join(tmpdir(), 'kasra-e2e-'));
  try {
    const file = join(dir, 'owner-password');
    writeFileSync(file, owner.password + '\n', { mode: 0o600 });
    const run = spawnSync(process.execPath, ['dist/admin/bootstrap.js', owner.username, file],
      { cwd: 'backend', encoding: 'utf8', env: process.env });
    expect(run.status, 'bootstrap needs a database without an owner: ' + run.stderr).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const login = await request.post(API + '/v1/admin/auth/login', { data: owner, headers: { 'X-Forwarded-For': '10.210.0.1' } });
  expect(login.status()).toBe(200);
  const { token } = await login.json() as { token: string };
  const accounts: Accounts = { owner, manager: { username: 'manager_e2e', password: randomBytes(18).toString('hex') },
    staff: { username: 'staff_e2e', password: randomBytes(18).toString('hex') } };
  for (const role of ['manager', 'staff'] as const) {
    const created = await request.post(API + '/v1/admin/staff', {
      headers: { Authorization: 'Bearer ' + token, 'X-Forwarded-For': '10.210.0.1' },
      data: { ...accounts[role], displayName: role === 'manager' ? 'مدیر آزمایشی' : 'کارمند آزمایشی', role }
    });
    expect(created.status()).toBe(201);
  }
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts), { mode: 0o600 });
});
