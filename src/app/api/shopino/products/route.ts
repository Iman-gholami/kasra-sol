import { NextRequest } from 'next/server';
import { shopinoCatalogProxy } from '@/lib/shopino-proxy';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) { return shopinoCatalogProxy(request); }
