const STORAGE_KEY = 'kasra-order-attempt-v1';
type Attempt = { fingerprint: string; key: string };
let memory: Attempt | null = null;

/** Keep uncertain submissions retryable after a reload or a return to the payment step.
 * Store only a digest and an opaque key, never the address or cart payload. */
export async function orderAttempt(payload: string): Promise<Attempt> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const fingerprint = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  let previous = memory;
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored && typeof stored === 'object' && 'fingerprint' in stored && 'key' in stored &&
        typeof stored.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(stored.fingerprint) &&
        typeof stored.key === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(stored.key)) {
      previous = stored as Attempt;
    }
  } catch { /* Storage may be unavailable; retain retries for the current page in memory. */ }
  memory = previous?.fingerprint === fingerprint ? previous : { fingerprint, key: crypto.randomUUID() };
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch { /* See above. */ }
  return memory;
}

/** Only a confirmed response ends an attempt; a timeout may have committed on the server. */
export function clearOrderAttempt() {
  memory = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage unavailable. */ }
}
