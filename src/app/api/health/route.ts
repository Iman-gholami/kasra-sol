import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'kasra-frontend' }, { headers: { 'Cache-Control': 'no-store' } });
}
