import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;
  if (request.headers.get('origin') !== expectedOrigin)
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  // Public admin sessions must never be set over HTTP outside localhost.
  const site = new URL(expectedOrigin);
  const secure = site.protocol === 'https:';
  if (!secure && !['localhost', '127.0.0.1'].includes(site.hostname))
    return NextResponse.json({ error: 'https_required' }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 8192) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    const backend = await fetch(internal + '/v1/admin/auth/login', {
      method: 'POST', body, headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000), cache: 'no-store'
    });
    const result: { token?: string; user?: unknown; error?: string } = await backend.json();
    if (!backend.ok || !result.token || !/^[a-f0-9]{64}$/.test(result.token))
      return NextResponse.json({ error: 'invalid_credentials' }, { status: backend.ok ? 502 : backend.status });
    const response = NextResponse.json({ user: result.user });
    response.cookies.set('kasra_admin', result.token, {
      httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 });
  }
}
