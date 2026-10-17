import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };
function allowed(path: string, method: string) {
  if (method === 'GET') return /^(auth\/me|products|products\/[a-zA-Z0-9_.-]{1,80}\/variants|orders|staff|audit)$/.test(path);
  if (method === 'POST') return /^(auth\/logout|staff)$/.test(path);
  if (method === 'PATCH') return /^(staff\/[a-f0-9-]{36}|products\/[a-zA-Z0-9_.-]{1,80}\/price|variants\/[a-f0-9-]{36}\/stock|orders\/[a-f0-9-]{36}\/status)$/.test(path);
  return false;
}
async function handle(request: NextRequest, context: Ctx) {
  const { path: segments } = await context.params;
  const path = segments.join('/');
  if (segments.some(segment => !/^[a-zA-Z0-9_.-]{1,100}$/.test(segment) || segment === '.' || segment === '..') ||
      !allowed(path, request.method)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (request.method !== 'GET') {
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;
    if (request.headers.get('origin') !== expectedOrigin)
      return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  }
  const token = request.cookies.get('kasra_admin')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  try {
    const body = request.method === 'GET' ? undefined : await request.text();
    if (body && body.length > 8192) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    const url = internal + '/v1/admin/' + path + (path === 'orders' ? request.nextUrl.search : '');
    const backend = await fetch(url, {
      method: request.method, body, headers: {
        Authorization: 'Bearer ' + token,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    const response = new NextResponse(await backend.text(), {
      status: backend.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
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
