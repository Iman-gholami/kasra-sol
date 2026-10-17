// Values copied from .env.example must never protect a running store.
const PLACEHOLDER = /replace|change-?me|example|placeholder/i;

export function isUsableSecret(value: string | undefined): value is string {
  return typeof value === 'string' && value.length >= 32 && !PLACEHOLDER.test(value);
}

export function requireSecret(name: string, value: string | undefined): string {
  if (!isUsableSecret(value))
    throw new Error('Set ' + name + ' to a random secret of at least 32 characters (example placeholders are rejected)');
  return value;
}

/** In production the database password must not be the .env.example value either. */
export function assertProductionDatabaseUrl(url: string | undefined) {
  if (!url) return;
  let password = '';
  try { password = decodeURIComponent(new URL(url).password); } catch { return; }
  if (PLACEHOLDER.test(password)) throw new Error('POSTGRES_PASSWORD is still the .env.example placeholder');
}

/** Fastify `trustProxy`: "true" or a comma-separated list of trusted proxy IPs/CIDRs; off by default. */
export function trustProxySetting(value: string | undefined): boolean | string {
  const raw = value?.trim();
  if (!raw || raw === 'false') return false;
  return raw === 'true' ? true : raw;
}
