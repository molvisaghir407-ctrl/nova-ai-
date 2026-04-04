import { NextRequest, NextResponse } from 'next/server';
import { embed } from '@/lib/nova/nim/client';
import { logger } from '@/lib/nova/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { texts?: string[]; model?: string };
    const { texts = [], model } = body;
    if (!texts.length) return NextResponse.json({ error: 'texts array required' }, { status: 400 });
    if (texts.length > 50) return NextResponse.json({ error: 'Max 50 texts' }, { status: 400 });
    const embeddings = await embed(texts, model);
    return NextResponse.json({ success: true, embeddings, dimensions: embeddings[0]?.length ?? 0 });
  } catch (error) {
    logger.error('embed', 'Embed failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Embedding failed' }, { status: 500 });
  }
}
