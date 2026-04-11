import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore } from '@/lib/kv-sessions';
import { chatStream, parseNIMStream, chatComplete } from '@/lib/nova/nim/client';
import { routeTask, classifyTask } from '@/lib/nova/nim/models';
import { classifyIntent, shouldUseRAG } from '@/lib/nova/rag/intent';
import { runRAG, buildRAGContext } from '@/lib/nova/rag/orchestrator';
import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent, Source } from '@/types/nova.types';

const NOVA_SYSTEM = `You are Nova, an exceptionally capable AI assistant powered by NVIDIA NIM.

## Core Identity
Nova — intelligent, witty, deeply helpful. You give complete, accurate answers.

## Response Quality
- **Complete**: Never truncate or cut corners. Use the full context window.
- **Structured**: Use ## headings, bullets, numbered lists, tables, code blocks where appropriate.
- **Code**: Always use language-tagged fenced blocks. Write complete, working examples.
- **Honest**: Acknowledge uncertainty. Cite [1][2] when using web search results.
- **Tone**: Professional yet warm. Direct without being terse.

## Formatting
- \`inline code\` for technical terms, function names, file paths
- \`\`\`lang code blocks for all code samples  
- **bold** for key concepts, > blockquotes for callouts
- Tables for structured comparisons`;

function generateTitle(msg: string): string {
  const c = msg.trim().replace(/\n+/g, ' ');
  return c.length > 52 ? c.slice(0, 49) + '...' : c;
}

async function buildBaseContext(message: string, includeContext: boolean): Promise<string> {
  let ctx = NOVA_SYSTEM;
  if (includeContext) {
    ctx += `\n\n[Current time: ${getTimeContext()}]`;
    try {
      const mem = await memoryManager.buildContextPrompt(6);
      if (mem) ctx += mem;
    } catch { /* ignore */ }
  }
  return ctx;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json() as {
      message?: string; sessionId?: string; images?: string[];
      enableThinking?: boolean; stream?: boolean; maxTokens?: number;
      clearSession?: boolean; includeContext?: boolean; userId?: string;
      enableRAG?: boolean; ragThreshold?: number; model?: string;
    };

    const {
      message = '', sessionId, images = [],
      enableThinking = false, stream = true,
      maxTokens = 16000, clearSession = false,
      includeContext = true, userId = 'default',
      enableRAG = true, ragThreshold = 150,
    } = body;

    if (!message && images.length === 0) {
      return Response.json({ success: false, error: 'Message or images required' }, { status: 400 });
    }

    const sessionKey = sessionId ?? `session-${Date.now()}`;

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return Response.json({ success: true, cleared: true });
    }

    // Load history + base context in parallel
    const [history_, baseCtx] = await Promise.all([
      sessionStore.get(sessionKey),
      buildBaseContext(message, includeContext),
    ]);
    let history = history_;
    const isNew = history.length === 0;

    // Route to best model
    const nimTask = classifyTask(message, images.length > 0, enableThinking);
    const model = body.model ?? routeTask(nimTask);

    // Decide if we need RAG
    const intent = classifyIntent(message);
    const needRAG = enableRAG && message.length > 0 && shouldUseRAG(intent, message.length, ragThreshold);

    // Build user message
    const userContent: NIMChatMessage['content'] = images.length > 0
      ? [...(message ? [{ type: 'text' as const, text: message }] : []), ...images.map(url => ({ type: 'image_url' as const, image_url: { url } }))]
      : message;

    history.push({ role: 'user', content: userContent });
    if (history.length > 120) history = history.slice(-120);

    logger.info('chat', `${needRAG ? '🔍 RAG+' : '⚡ Direct'} → ${model}`, { intent, len: message.length });

    if (!stream) {
      // Non-streaming: fetch RAG first, then call NIM
      let systemContent = baseCtx;
      let ragSources: Source[] = [];
      if (needRAG) {
        try {
          const rag = await runRAG(message);
          ragSources = rag.sources;
          if (ragSources.length > 0) systemContent += buildRAGContext(rag);
        } catch { /* ignore */ }
      }
      const nimMessages: NIMChatMessage[] = [{ role: 'system', content: systemContent }, ...history.map((m: {role: string; content: NIMChatMessage['content']}) => ({ role: m.role as 'user'|'assistant', content: m.content }))];
      const result = await chatComplete({ model, messages: nimMessages, max_tokens: maxTokens, temperature: 0.6, top_p: 0.95, ...(enableThinking ? { thinking: { type: 'enabled' as const, budget_tokens: 8000 } } : {}) });
      history.push({ role: 'assistant', content: result.content });
      await Promise.all([
        sessionStore.set(sessionKey, history),
        isNew ? sessionStore.upsertConversation(userId, { id: sessionKey, title: generateTitle(message), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: history.length, preview: message.slice(0, 80) }) : Promise.resolve(),
      ]);
      return Response.json({ success: true, response: result.content, thinking: result.thinking || null, sessionId: sessionKey, duration: Date.now() - startTime, ragSources, ragUsed: ragSources.length > 0 });
    }

    // ── STREAMING: parallel RAG + NIM ─────────────────────────────────────────
    // Start RAG fetch in parallel (if needed) — don't block NIM call
    const ragPromise: Promise<{ sources: Source[]; context: string }> = needRAG
      ? runRAG(message).then(rag => ({
          sources: rag.sources,
          context: rag.sources.length > 0 ? buildRAGContext(rag) : '',
        })).catch(() => ({ sources: [], context: '' }))
      : Promise.resolve({ sources: [], context: '' });

    // For real-time queries (news/weather/finance), wait up to 3s for RAG before streaming
    // For general queries, start NIM immediately with base context
    const isRealTime = ['news', 'weather', 'finance'].includes(intent);
    let ragSources: Source[] = [];
    let systemContent = baseCtx;

    if (isRealTime && needRAG) {
      // Wait for RAG (these NEED fresh data)
      const rag = await Promise.race([
        ragPromise,
        new Promise<{ sources: Source[]; context: string }>(r => setTimeout(() => r({ sources: [], context: '' }), 3000)),
      ]);
      ragSources = rag.sources;
      systemContent += rag.context;
    }

    // Build messages with whatever context we have so far
    const nimMessages: NIMChatMessage[] = [
      { role: 'system', content: systemContent },
      ...history.map((m: {role: string; content: NIMChatMessage['content']}) => ({ role: m.role as 'user'|'assistant', content: m.content })),
    ];

    const nimOpts = {
      model, messages: nimMessages, stream: true as const,
      max_tokens: maxTokens, temperature: 0.6, top_p: 0.95,
      ...(enableThinking ? { thinking: { type: 'enabled' as const, budget_tokens: 8000 } } : {}),
    };

    const nimResponse = await chatStream(nimOpts);
    if (!nimResponse.ok) {
      const errText = await nimResponse.text();
      throw new Error(`NIM ${nimResponse.status}: ${errText.slice(0, 300)}`);
    }

    // ── SSE stream ─────────────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    let fullContent = '';
    let fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        try {
          // Emit any RAG sources we already have
          if (ragSources.length > 0) send({ type: 'rag', sources: ragSources, searchQuery: message });

          // Stream NIM tokens
          const nimDone = (async () => {
            for await (const event of parseNIMStream(nimResponse)) {
              if (event.type === 'thinking') { fullThinking += event.content; send(event); }
              else if (event.type === 'content') { fullContent += event.content; send(event); }
              else if (event.type === 'usage') { send(event); }
            }
          })();

          // If non-realtime RAG is still pending, wait for it and emit when ready
          const ragDone = !isRealTime && needRAG
            ? ragPromise.then(rag => {
                if (rag.sources.length > 0) {
                  ragSources = rag.sources;
                  send({ type: 'rag', sources: rag.sources, searchQuery: message });
                }
              }).catch(() => {})
            : Promise.resolve();

          await Promise.all([nimDone, ragDone]);

          // Save session
          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 120) history = history.slice(-120);

            await Promise.all([
              sessionStore.set(sessionKey, history),
              isNew ? sessionStore.upsertConversation(userId, { id: sessionKey, title: generateTitle(message), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: history.length, preview: message.slice(0, 80) }) : Promise.resolve(),
              // Store memory asynchronously (don't block response)
              (async () => {
                if (message.length > 20) {
                  const exists = await memoryManager.findSimilar(message);
                  if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${fullContent.slice(0, 400)}`, 0.3);
                }
              })(),
            ]);
          }

          send({ type: 'done', sessionId: sessionKey, duration: Date.now() - startTime, messageCount: history.length, ragSources, ragUsed: ragSources.length > 0 });
          controller.close();
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Stream failed', code: 'STREAM_ERROR' });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logger.error('chat', 'Request failed', error instanceof Error ? error : new Error(String(error)));
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed', duration: Date.now() - startTime }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') ?? 'default';
  const history = await sessionStore.get(sessionId);
  return Response.json({ success: true, sessionId, messageCount: history.length });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') ?? 'default';
  const userId = searchParams.get('userId') ?? 'default';
  await sessionStore.deleteConversation(userId, sessionId);
  return Response.json({ success: true });
}
