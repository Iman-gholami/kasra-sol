/** Helpers shared by the Next.js routes that forward browser requests to the internal Fastify API. */

const IP = /^[0-9a-fA-F:.]{2,45}$/;

/** The visitor's address as recorded by the closest proxy: Nginx appends `$remote_addr` as the LAST
 * X-Forwarded-For entry (earlier entries are client-controlled) and Next.js fills in the socket address
 * when it is reached directly. Assumes at most one trusted reverse proxy in front of Next.js. */
export function clientAddress(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')?.split(',').map(part => part.trim()).filter(Boolean);
  const candidate = forwarded?.at(-1) ?? headers.get('x-real-ip')?.trim();
  return candidate && IP.test(candidate) ? candidate : undefined;
}

/** Lets the API rate-limit each visitor instead of treating the whole storefront as one client. */
export function forwardedFor(headers: Headers): Record<string, string> {
  const address = clientAddress(headers);
  return address ? { 'X-Forwarded-For': address } : {};
}

/** CSRF guard for state-changing requests: the browser-set Origin must be this site, either the
 * configured public URL or the Host the request was addressed to (Nginx forwards `Host $host`).
 * A cross-site page can set neither; X-Forwarded-Host is ignored because clients can send it. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return false; }
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site && new URL(site).origin === parsed.origin) return true;
  const host = request.headers.get('host');
  return Boolean(host) && parsed.host === host;
}

/** Reads at most `limit` bytes of the body; returns null as soon as the stream exceeds it, so an oversized
 * or endless chunked upload is never buffered in memory. */
export async function readBodyLimited(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > limit) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function readTextLimited(request: Request, limit: number): Promise<string | null> {
  const body = await readBodyLimited(request, limit);
  return body === null ? null : new TextDecoder().decode(body);
}
