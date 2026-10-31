import { NextRequest, NextResponse } from 'next/server';
import { forwardedFor, readTextLimited } from '@/lib/backend-proxy';

/** Forward public catalog reads without exposing the internal backend address or caching stock. */
export async function shopinoCatalogProxy(request: NextRequest, id?: string) {
  if (id !== undefined && !/^[a-z0-9][a-z0-9-]{1,78}$/.test(id))
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const base = process.env.BACKEND_INTERNAL_URL;
  if (!base) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  const query = new URLSearchParams();
  if (id === undefined) {
    const incoming = request.nextUrl.searchParams;
    for (const key of ['page', 'per_page']) {
      const value = incoming.get(key);
      if (value !== null) query.set(key, value.slice(0, 20));
    }
  }
  const suffix = id === undefined ? (query.size ? '?' + query.toString() : '') : '/' + id;
  try {
    const response = await fetch(base + '/v1/shopino/products' + suffix, {
      cache: 'no-store', signal: AbortSignal.timeout(10000), headers: forwardedFor(request.headers)
    });
    return new NextResponse(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch { return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 }); }
}

/** Partner-to-server endpoint: forward only its bearer credential and a bounded JSON body. */
export async function shopinoTrackingProxy(request: NextRequest) {
  const base = process.env.BACKEND_INTERNAL_URL;
  if (!base) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  try {
    const body = await readTextLimited(request, 32768);
    if (body === null) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    const response = await fetch(base + '/v1/shopino/tracking', {
      method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: request.headers.get('authorization') ?? '',
        ...forwardedFor(request.headers) }
    });
    return new NextResponse(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch { return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 }); }
}
