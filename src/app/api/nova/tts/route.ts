import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { logger } from '@/lib/nova/logger';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

function splitChunks(text: string, max = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length <= max) { cur += s; } else { if (cur) chunks.push(cur.trim()); cur = s; }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

async function generateTTS(text: string, voice: string, speed: number): Promise<NextResponse> {
  const zai = await getZAI();
  const audio = await (zai.audio as any).speech.create({ input: text, voice, speed });
  const buffer = await audio.arrayBuffer();
  return new NextResponse(buffer, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(buffer.byteLength) } });
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0, chunkIndex = 0 } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    if (text.length > 1000) {
      const chunks = splitChunks(text);
      if (req.headers.get('x-tts-chunk-only') === '1') {
        return generateTTS(chunks[Math.min(chunkIndex, chunks.length - 1)], voice, speed);
      }
      return NextResponse.json({ totalChunks: chunks.length, currentChunk: 0, hasMore: chunks.length > 1, hint: 'Add x-tts-chunk-only:1 header with chunkIndex param for each chunk' });
    }

    return generateTTS(text, voice, speed);
  } catch (error) {
    logger.error('tts', 'TTS failed', error);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
