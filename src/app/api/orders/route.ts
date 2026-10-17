import { NextRequest, NextResponse } from 'next/server';
import { forwardedFor, isSameOrigin, readTextLimited } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  // Orders are placed only from this site's checkout; other sites cannot submit them through a visitor's browser.
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  const base = process.env.BACKEND_INTERNAL_URL;
  if (!base) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  try {
    const body = await readTextLimited(request, 32768);
    if (body === null) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    const response = await fetch(base + '/v1/orders', {
      method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.headers.get('idempotency-key') ?? '',
        ...forwardedFor(request.headers) }
    });
    return new NextResponse(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 });
  }
}
