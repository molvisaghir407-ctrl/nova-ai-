import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { getTimeContext, getPersonalityPrompt } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { db } from '@/lib/db';
import { sessionStore } from '@/lib/kv-sessions';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

const SYSTEM_PROMPT = `You are Nova, an advanced AI assistant with exceptional capabilities.

## Response Style
- Be comprehensive yet well-structured
- Use clear headings (## sections, ### subsections), proper markdown
- Use **bold** for emphasis, \`code\` for technical terms
- Include \`\`\`language code blocks when helpful

## Thinking Style
For complex questions: analyze deeply, consider multiple perspectives, show reasoning.

## Capabilities
Image understanding, code explanation, research synthesis, creative problem solving.

Remember: Quality over quantity, but be thorough when needed.`;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { message, sessionId, includeContext = true, images = [], enableThinking = false, stream = true } = body;

    if (!message && images.length === 0) {
      return new Response(JSON.stringify({ error: 'Message or images required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const zai = await getZAI();
    const sessionKey = sessionId || 'default';

    // FIX: Redis/KV session — survives cold starts
    let history = await sessionStore.get(sessionKey);

    let contextSuffix = '';
    if (includeContext) {
      contextSuffix = `\n\n## Current Context\n${getTimeContext()}`;
      const memCtx = await memoryManager.buildContextPrompt(5);
      if (memCtx) contextSuffix += memCtx;
    }

    let systemPrompt = SYSTEM_PROMPT;
    try {
      const settings = await db.settings.findUnique({ where: { id: 'nova-settings' } });
      if ((settings as any)?.safetyLevel) {
        systemPrompt += '\n\n' + getPersonalityPrompt({ safetyLevel: (settings as any).safetyLevel });
      }
    } catch { /* settings not yet seeded */ }

    const userContent: any = images.length > 0
      ? [...(message ? [{ type: 'text', text: message }] : []), ...images.map((img: string) => ({ type: 'image_url', image_url: { url: img } }))]
      : message;

    history.push({ role: 'user', content: userContent });

    // FIX: system prompt prepended to first user message (not as fake assistant turn)
    const messages = history.map((msg: any, idx: number) => {
      if (idx === 0 && msg.role === 'user') {
        const prefix = systemPrompt + contextSuffix + '\n\n---\n\n';
        return { role: 'user' as const, content: typeof msg.content === 'string' ? prefix + msg.content : [{ type: 'text', text: prefix }, ...msg.content] };
      }
      return { role: msg.role as 'user' | 'assistant', content: msg.content };
    });

    const opts = { messages, thinking: enableThinking ? { type: 'enabled' as const } : { type: 'disabled' as const } };
    const response = images.length > 0 ? await zai.chat.completions.createVision(opts) : await zai.chat.completions.create(opts);
    const content = response.choices[0]?.message?.content ?? '';
    const thinking = ('thinking' in response ? response.thinking : '') as string;

    if (!content) throw new Error('Empty response from LLM');

    history.push({ role: 'assistant', content });
    if (history.length > 50) history = history.slice(-50);
    await sessionStore.set(sessionKey, history);

    const duration = Date.now() - startTime;
    logger.info('chat', 'Response generated', { duration: `${duration}ms` });

    // FIX: only store substantive messages, with dedup
    if (message && message.length > 20) {
      const exists = await memoryManager.findSimilar(message);
      if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${content.substring(0, 400)}`, 0.3);
    }

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            if (thinking) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: thinking })}\n\n`));
              await new Promise(r => setTimeout(r, 100));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', sessionId: sessionKey, duration, messageCount: history.length - 1 })}\n\n`));
            const words = content.split(/(\s+)/);
            for (let i = 0; i < words.length; i++) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: words[i], done: i === words.length - 1 })}\n\n`));
              const delay = words[i].match(/^[.,!?;:]$/) ? 50 : words[i].match(/^\s+$/) ? 10 : 20;
              await new Promise(r => setTimeout(r, delay));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (err) { logger.error('chat', 'Stream error', err); controller.error(err); }
        },
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
    }

    return new Response(JSON.stringify({ success: true, response: content, thinking: thinking || null, sessionId: sessionKey, duration, messageCount: history.length - 1 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    logger.error('chat', 'Failed', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId') || 'default';
  const history = await sessionStore.get(sessionId);
  return new Response(JSON.stringify({ success: true, sessionId, messageCount: Math.max(0, history.length - 1), hasHistory: history.length > 0 }), { headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId') || 'default';
  await sessionStore.del(sessionId);
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}
