import { NextRequest, NextResponse } from 'next/server';
import { forwardedFor, isSameOrigin, readTextLimited } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };
const PRODUCT = '[a-z0-9][a-z0-9-]{1,78}';
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const SERIAL = '[1-9][0-9]{0,15}';
// Only these admin endpoints are reachable from the browser; the API checks the session's permissions on each.
const ROUTES: Record<string, RegExp> = {
  GET: new RegExp('^(auth/me|reports/overview|reports/traffic|products|products/' + PRODUCT + '|products/' + PRODUCT + '/variants|' +
    'orders|orders/export|orders/' + UUID + '|staff|roles|audit|home-slider|barcodes/[0-9]{13}|stock-receipts|stock-receipts/' + SERIAL +
    '|store-sales|store-holds)$'),
  POST: new RegExp('^(auth/logout|auth/password|staff|roles|products|products/' + PRODUCT + '/barcodes|stock-receipts|store-sales|' +
    'store-sales/' + SERIAL + '/void|store-holds|store-holds/' + SERIAL + '/resume)$'),
  PATCH: new RegExp('^(staff/' + UUID + '|products/' + PRODUCT + '/(price|visibility)|variants/' + UUID + '/stock|' +
    'orders/' + UUID + '/status)$'),
  PUT: new RegExp('^(products/' + PRODUCT + '|staff/' + UUID + '/password|roles/' + UUID + '|home-slider)$'),
  DELETE: new RegExp('^(staff/' + UUID + '|roles/' + UUID + '|store-holds/' + SERIAL + ')$')
};
// List endpoints accept these query parameters; anything else is dropped rather than forwarded.
const QUERY: Record<string, string[]> = {
  products: ['q', 'status', 'stock', 'page', 'limit'], orders: ['q', 'status', 'period', 'page', 'limit'],
  'orders/export': ['q', 'status', 'period'], audit: ['before', 'group', 'actor'],
  'reports/traffic': ['days'], 'stock-receipts': ['page'], 'store-sales': ['date']
};

async function handle(request: NextRequest, context: Ctx) {
  const { path: segments } = await context.params;
  const path = segments.join('/');
  if (!ROUTES[request.method]?.test(path)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (request.method !== 'GET' && !isSameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  const token = request.cookies.get('kasra_admin')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  try {
    const body = request.method === 'GET' ? undefined : await readTextLimited(request, 65536);
    if (body === null) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    const query = new URLSearchParams();
    for (const key of QUERY[path] ?? []) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null) query.set(key, value.slice(0, 200));
    }
    const ifMatch = request.headers.get('if-match');
    const backend = await fetch(internal + '/v1/admin/' + path + (query.size ? '?' + query : ''), {
      method: request.method, body: body || undefined, headers: {
        Authorization: 'Bearer ' + token, ...forwardedFor(request.headers),
        ...(ifMatch ? { 'If-Match': ifMatch } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    // Only the order export answers with a file; everything else is JSON, whatever the backend claims.
    const csv = path === 'orders/export' && backend.ok;
    // Raw bytes for the file: text() would drop the byte-order mark Excel needs to read Persian as UTF-8.
    const response = new NextResponse(csv ? await backend.arrayBuffer() : await backend.text(), {
      status: backend.status, headers: {
        'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store',
        ...(csv ? { 'Content-Disposition': backend.headers.get('content-disposition') ?? 'attachment; filename="orders.csv"',
          'X-Content-Type-Options': 'nosniff' } : {})
      }
    });
    if (path === 'auth/logout' || backend.status === 401)
      response.cookies.set('kasra_admin', '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
