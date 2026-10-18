import { NextRequest, NextResponse } from 'next/server';
import { forwardedFor, isSameOrigin, readTextLimited } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';

/** Page-view beacon from the storefront. Answers 204 in every case: the browser never waits on statistics. */
export async function POST(request: NextRequest) {
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal || !isSameOrigin(request)) return new NextResponse(null, { status: 204 });
  try {
    const body = await readTextLimited(request, 2048);
    if (body === null) return new NextResponse(null, { status: 204 });
    const { path, referrer } = JSON.parse(body) as { path?: unknown; referrer?: unknown };
    // A referrer from this same site is navigation, not a traffic source.
    let external: string | undefined;
    if (typeof referrer === 'string' && referrer) {
      try { if (new URL(referrer).host !== request.headers.get('host')) external = referrer.slice(0, 1000); } catch { /* ignore */ }
    }
    await fetch(internal + '/v1/analytics/view', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(3000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': request.headers.get('user-agent') ?? '',
        ...forwardedFor(request.headers) },
      body: JSON.stringify({ path: typeof path === 'string' ? path.slice(0, 600) : '', ...(external ? { referrer: external } : {}) })
    });
  } catch { /* statistics are best effort */ }
  return new NextResponse(null, { status: 204 });
}
