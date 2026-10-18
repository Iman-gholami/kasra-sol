import { NextRequest, NextResponse } from 'next/server';
import { byId } from '@/data/products';
import { forwardedFor } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const idsRaw = request.nextUrl.searchParams.get('ids') ?? '';
  if (idsRaw.length > 6000) return NextResponse.json({ error: 'invalid_ids' }, { status: 400 });
  const ids = [...new Set(idsRaw.split(',').filter(Boolean))];
  if (ids.length > 80 || ids.some(id => !/^[a-z0-9][a-z0-9-]{1,78}$/.test(id)))
    return NextResponse.json({ error: 'invalid_ids' }, { status: 400 });
  if (!ids.length) return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return NextResponse.json({ items: ids.flatMap(id => {
    const found = byId(id);
    return found ? [found] : [];
  }) }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const response = await fetch(internal + '/v1/products/lookup?ids=' + encodeURIComponent(ids.join(',')), {
      cache: 'no-store', signal: AbortSignal.timeout(10000), headers: forwardedFor(request.headers)
    });
    return new NextResponse(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 });
  }
}
