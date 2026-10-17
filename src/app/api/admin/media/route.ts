import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;
  if (request.headers.get('origin') !== expectedOrigin)
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  const token = request.cookies.get('kasra_admin')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return NextResponse.json({ error: 'backend_not_configured' }, { status: 503 });
  const contentType = request.headers.get('content-type');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType ?? ''))
    return NextResponse.json({ error: 'invalid_image_type' }, { status: 415 });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 2 * 1024 * 1024) return NextResponse.json({ error: 'image_too_large' }, { status: 413 });
  try {
    const data = await request.arrayBuffer();
    if (data.byteLength > 2 * 1024 * 1024)
      return NextResponse.json({ error: 'image_too_large' }, { status: 413 });
    const response = await fetch(internal + '/v1/admin/media', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': contentType!, Authorization: 'Bearer ' + token },
      body: data
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 });
  }
}
