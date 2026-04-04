import { NextRequest, NextResponse } from 'next/server';
import { quickChat } from '@/lib/nova/nim/client';
import { logger } from '@/lib/nova/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { content?: string; style?: 'bullets' | 'paragraph' | 'tldr'; maxLength?: number };
    const { content = '', style = 'paragraph', maxLength = 500 } = body;
    if (!content.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });
    const styleMap: Record<string, string> = {
      bullets: 'Respond with 5-8 concise bullet points starting with "•".',
      paragraph: `Respond with one paragraph, max ${maxLength} chars.`,
      tldr: 'Respond in 1-2 sentences maximum (TL;DR).',
    };
    const prompt = `Summarize this content. ${styleMap[style] ?? styleMap.paragraph}\n\nContent:\n${content.slice(0, 30000)}`;
    const summary = await quickChat([{ role: 'user', content: prompt }], undefined, maxLength + 200);
    const bullets = style === 'bullets' ? summary.split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^•\s*/, '')) : undefined;
    return NextResponse.json({ success: true, summary, bullets, style });
  } catch (error) {
    logger.error('summarize', 'Failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
