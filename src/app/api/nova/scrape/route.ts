import { NextRequest, NextResponse } from 'next/server';
import { scrapePage, scrapeUrls, pagesToSources } from '@/lib/nova/scraper/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json() as { url?: string; urls?: string[] };
    const urls = body.urls ?? (body.url ? [body.url] : []);

    if (!urls.length) {
      return NextResponse.json({ error: 'url or urls required' }, { status: 400 });
    }

    if (urls.length === 1 && urls[0]) {
      const page = await scrapePage(urls[0]);
      return NextResponse.json({
        success : true,
        page,
        sources : pagesToSources([page]),
        duration: page.duration,
      });
    }

    const pages   = await scrapeUrls(urls);
    const sources = pagesToSources(pages);
    return NextResponse.json({ success: true, pages, sources, total: pages.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scrape failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
