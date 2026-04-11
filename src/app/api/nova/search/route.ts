import { NextRequest, NextResponse } from 'next/server';
import { webSearch } from '@/lib/nova/search';
import { logger } from '@/lib/nova/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json() as { query?: string; num?: number };
    const { query = '', num = 10 } = body;
    if (!query.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    logger.info('search', `Searching: "${query}"`);
    const results = await webSearch(query, Math.min(num, 20));
    const duration = Date.now() - startTime;

    return NextResponse.json({ success: true, query, results, totalResults: results.length, duration });
  } catch (error) {
    logger.error('search', 'Search failed', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const num = Number(searchParams.get('num') ?? '8');
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });
  const results = await webSearch(query, num);
  return NextResponse.json({ success: true, query, results, totalResults: results.length });
}
