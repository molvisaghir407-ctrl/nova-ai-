import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { logger } from '@/lib/nova/logger';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { query, num = 10 } = await req.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const zai = await getZAI();
    const numResults = Math.min(Math.max(1, num), 20);

    logger.debug('search', 'Searching web', { query, numResults });

    const results = await zai.functions.invoke('web_search', {
      query,
      num: numResults
    });

    const duration = Date.now() - startTime;
    logger.info('search', 'Search complete', { 
      duration: `${duration}ms`,
      resultCount: results?.length || 0
    });

    // Format results for better display
    const formattedResults = (results || []).map((item: {
      url: string;
      name: string;
      snippet: string;
      host_name: string;
      date: string;
    }, index: number) => ({
      id: index + 1,
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      domain: item.host_name,
      date: item.date,
    }));

    return NextResponse.json({
      success: true,
      query,
      results: formattedResults,
      totalResults: formattedResults.length,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('search', 'Search failed', error, { duration: `${duration}ms` });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search web',
      },
      { status: 500 }
    );
  }
}
