import { NextRequest } from 'next/server';
import { shopinoCatalogProxy } from '@/lib/shopino-proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return shopinoCatalogProxy(request, (await context.params).id);
}
