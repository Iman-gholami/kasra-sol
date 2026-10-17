import { readFileSync } from 'node:fs';
import { pool } from '../db/connection';
import { hashPassword } from './password';

// One-time owner bootstrap. Keep the password in an owner-readable file outside the repository.
// Usage (from backend/): npm run admin:create-owner -- owner-username /secure/password-file
const [username, file] = process.argv.slice(2);
async function main() {
  if (!username || !/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username) || !file)
    throw new Error('Usage: admin:create-owner <username> <owner-only-password-file>');
  const password = readFileSync(file, 'utf8').replace(/\r?\n$/, '');
  const hashed = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(490202603)');
    const owners = await client.query("SELECT 1 FROM admin_users WHERE role='owner' LIMIT 1");
    if (owners.rowCount) throw new Error('An owner already exists; refusing to bootstrap again');
    await client.query(
      "INSERT INTO admin_users(username,display_name,password_hash,role) VALUES($1,$2,$3,'owner')",
      [username, 'صاحب فروشگاه', hashed]);
    await client.query('COMMIT');
    console.log('Owner account created: ' + username);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Bootstrap failed'); process.exitCode = 1; });
