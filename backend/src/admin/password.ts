import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const derive = async (password: string, salt: string) => (await scrypt(password, salt, 64)) as Buffer;

// Passwords are never stored, logged, or returned in plaintext. Keep scrypt format versioned.
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) throw new Error('Password must be 12-256 characters');
  const salt = randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + (await derive(password, salt)).toString('hex');
}
export async function verifyPassword(password: string, saved: string): Promise<boolean> {
  const parts = saved.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) ||
      !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const actual = await derive(password, parts[1]);
  return timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
}
export const dummyPasswordHash = 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64);
