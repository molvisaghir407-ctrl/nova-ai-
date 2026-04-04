import { NextRequest, NextResponse } from 'next/server';

const NOVA_API_KEY = process.env.NOVA_API_KEY ?? '';

// Simple in-memory rate limit tracking (resets on cold start — acceptable for basic protection)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // requests per minute
const WINDOW_MS = 60_000;

function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: WINDOW_MS };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetIn: record.resetAt - now };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Security headers on every response
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!pathname.startsWith('/api/nova')) return res;

  // Rate limiting
  const ip = getClientIP(req);
  const rateResult = checkRateLimit(ip);

  if (!rateResult.allowed) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT', retryAfter: Math.ceil(rateResult.resetIn / 1000) }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rateResult.resetIn / 1000)) } }
    );
  }

  // API key validation (skip health check)
  if (pathname !== '/api/nova/health' && NOVA_API_KEY) {
    const authHeader = req.headers.get('authorization');
    const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.headers.get('x-api-key');
    if (!provided || provided !== NOVA_API_KEY) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'AUTH_FAILED' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' } }
      );
    }
  } else if (!NOVA_API_KEY) {
    // No key configured — warn but allow (dev mode)
    res.headers.set('X-Nova-Warning', 'NOVA_API_KEY not set');
  }

  return res;
}

export const config = { matcher: ['/api/nova/:path*'] };
