import { NextRequest, NextResponse } from 'next/server';

const NOVA_API_KEY = process.env.NOVA_API_KEY;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');

  if (!pathname.startsWith('/api/nova')) return res;

  if (!NOVA_API_KEY) {
    console.warn('[Nova] NOVA_API_KEY not set — API routes unprotected!');
    return res;
  }

  const authHeader = req.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.headers.get('x-api-key');

  if (!provided || provided !== NOVA_API_KEY) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return res;
}

export const config = { matcher: ['/api/nova/:path*'] };
