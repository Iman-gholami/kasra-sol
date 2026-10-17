import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const base = process.env.BACKEND_INTERNAL_URL;
  if (!base) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 32768) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    const response = await fetch(base + '/v1/orders', {
      method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.headers.get('idempotency-key') ?? '' }
    });
    return new NextResponse(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 });
  }
}
