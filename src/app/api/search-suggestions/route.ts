import { NextRequest, NextResponse } from 'next/server';
import { products, categories } from '@/data/products';
import { rankProduct } from '@/lib/search';
import { normalizePersian } from '@/lib/format';
import { forwardedFor } from '@/lib/backend-proxy';

export const dynamic = 'force-dynamic';

/** Capped payload: search and ranking stay server-side even as the catalog grows. */
export async function GET(request: NextRequest) {
  if (process.env.BACKEND_INTERNAL_URL) {
    const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
    try {
      const response = await fetch(process.env.BACKEND_INTERNAL_URL + '/v1/search/suggestions?q=' + encodeURIComponent(q),
        { cache: 'no-store', headers: forwardedFor(request.headers), signal: AbortSignal.timeout(8000) });
      if (!response.ok) return NextResponse.json({ error: 'Search unavailable' }, { status: 502 });
      return NextResponse.json(await response.json(), { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ error: 'Search unavailable' }, { status: 502 });
    }
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (!normalizePersian(q)) return NextResponse.json({ products: [], categories: [], count: 0 });
  const ranked = products.flatMap(product => {
    const score = rankProduct(product, q);
    return score === null ? [] : [{ product, score }];
  }).sort((a,b) => a.score - b.score || a.product.name.localeCompare(b.product.name, 'fa'));
  const matchingCategories = categories.filter(c =>
    normalizePersian(c.title).includes(normalizePersian(q)) ||
    normalizePersian(q).includes(normalizePersian(c.title))
  );
  return NextResponse.json({
    products: ranked.slice(0, 4).map(({product}) => ({
      id: product.id, name: product.name, category: categories.find(c => c.slug === product.category)?.title ?? '',
      image: product.images[0], price: product.price, href: '/product/' + product.slug
    })),
    categories: matchingCategories.slice(0, 3).map(c => ({
      slug: c.slug, title: c.title, href: '/category/' + c.slug
    })),
    count: ranked.length
  }, {headers: {'Cache-Control':'no-store'}});
}
