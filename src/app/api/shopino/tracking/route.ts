import { NextRequest } from 'next/server';
import { shopinoTrackingProxy } from '@/lib/shopino-proxy';
export const dynamic = 'force-dynamic';
export function POST(request: NextRequest) { return shopinoTrackingProxy(request); }
