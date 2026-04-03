import { NextRequest, NextResponse } from 'next/server';
import { webSearch } from '@/lib/nova/search';
import { logger } from '@/lib/nova/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { query, num = 10 } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    logger.debug('search', 'Searching web', { query, num });
    const results = await webSearch(query, num);
    const duration = Date.now() - startTime;
    logger.info('search', 'Done', { duration: `${duration}ms`, count: results.length });

    return NextResponse.json({ success: true, query, results, totalResults: results.length, duration });
  } catch (error) {
    logger.error('search', 'Search failed', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 });
  }
}
