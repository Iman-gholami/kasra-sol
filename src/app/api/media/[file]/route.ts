import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/.test(file))
    return new NextResponse(null, { status: 404 });
  const base = process.env.BACKEND_INTERNAL_URL;
  if (!base) return new NextResponse(null, { status: 503 });
  try {
    const image = await fetch(base + '/v1/media/' + file, { cache: 'force-cache',
      signal: AbortSignal.timeout(8000) });
    if (!image.ok) return new NextResponse(null, { status: image.status });
    return new NextResponse(image.body, {
      status: 200,
      headers: {
        'Content-Type': image.headers.get('content-type') ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public,max-age=31536000,immutable',
        'Content-Security-Policy': "default-src 'none'; sandbox"
      }
    });
  } catch { return new NextResponse(null, { status: 502 }); }
}
