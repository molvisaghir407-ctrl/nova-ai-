import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore } from '@/lib/kv-sessions';
import { chatStream, parseNIMStream, chatComplete } from '@/lib/nova/nim/client';
import { routeTask, classifyTask } from '@/lib/nova/nim/models';
import { classifyIntent, shouldUseRAG } from '@/lib/nova/rag/intent';
import { runRAGPipeline, buildRichContext } from '@/lib/nova/rag/pipeline';
import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent, Source } from '@/types/nova.types';

const NOVA_SYSTEM = `You are Nova — an exceptionally intelligent AI assistant powered by NVIDIA NIM.

## Core Principles
- **Complete**: Never truncate. Every question deserves a thorough answer.
- **Accurate**: When using web research, cite sources as [1], [2], etc. Distinguish facts from inferences.
- **Structured**: Use headings, bullets, tables, and code blocks for clarity.
- **Code**: Always use language-fenced blocks. Write complete, working examples.
- **Honest**: Acknowledge uncertainty. Never hallucinate facts.

## Response Style
- **Bold** key concepts. Use > blockquotes for important callouts.
- \`inline code\` for terms, paths, function names.
- Tables for comparisons. Numbered lists for steps.`;

function generateTitle(msg: string): string {
  const c = msg.trim().replace(/\n+/g, ' ');
  return c.length > 52 ? c.slice(0, 49) + '...' : c;
}

/** 
 * Pre-flight container: gather ALL data in parallel before calling NIM.
 * Returns everything needed to build the richest possible system prompt.
 */
async function buildPreflightContainer(
  message: string,
  sessionKey: string,
  includeContext: boolean,
  enableRAG: boolean,
  ragThreshold: number,
): Promise<{
  history: Array<{ role: string; content: NIMChatMessage['content'] }>;
  systemPrompt: string;
  ragSources: Source[];
  ragUsed: boolean;
  ragDurationMs: number;
}> {
  const intent = classifyIntent(message);
  const needRAG = enableRAG && message.length > 0 && shouldUseRAG(intent, message.length, ragThreshold);

  // 🚀 Fire everything in parallel — history, memory, AND RAG simultaneously
  const [historyResult, memResult, ragResult] = await Promise.allSettled([
    sessionStore.get(sessionKey),
    includeContext ? memoryManager.buildContextPrompt(6) : Promise.resolve(''),
    needRAG ? runRAGPipeline(message) : Promise.resolve(null),
  ]);

  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const memCtx = memResult.status === 'fulfilled' ? memResult.value : '';
  const ragPackage = ragResult.status === 'fulfilled' ? ragResult.value : null;

  // Assemble system prompt with all gathered context
  let systemPrompt = NOVA_SYSTEM;
  if (includeContext) systemPrompt += `\n\n[Current time: ${getTimeContext()}]`;
  if (memCtx) systemPrompt += memCtx;
  if (ragPackage?.sources.length) systemPrompt += buildRichContext(ragPackage);

  return {
    history: history as Array<{ role: string; content: NIMChatMessage['content'] }>,
    systemPrompt,
    ragSources: ragPackage?.sources ?? [],
    ragUsed: (ragPackage?.sources.length ?? 0) > 0,
    ragDurationMs: ragPackage?.durationMs ?? 0,
  };
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
      enableRAG = true, ragThreshold = 100,
    } = body;

    if (!message && images.length === 0) {
      return Response.json({ success: false, error: 'Message or images required' }, { status: 400 });
    }

    const sessionKey = sessionId ?? `session-${Date.now()}`;

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return Response.json({ success: true, cleared: true });
    }

    logger.info('chat', `Preflight start`, { len: message.length, rag: enableRAG, thinking: enableThinking });

    // ─────────────────────────────────────────────────────────────────────────
    // PRE-FLIGHT CONTAINER: gather EVERYTHING in parallel before NIM call
    // ─────────────────────────────────────────────────────────────────────────
    const preflight = await buildPreflightContainer(
      message, sessionKey, includeContext, enableRAG, ragThreshold,
    );
    const preflightMs = Date.now() - startTime;
    logger.info('chat', `Preflight done in ${preflightMs}ms`, { ragSources: preflight.ragSources.length, ragMs: preflight.ragDurationMs });

    let history = preflight.history;
    const isNew = history.length === 0;

    // Route to best model
    const nimTask = classifyTask(message, images.length > 0, enableThinking);
    const model = body.model ?? routeTask(nimTask);

    // Build the user message
    const userContent: NIMChatMessage['content'] = images.length > 0
      ? [...(message ? [{ type: 'text' as const, text: message }] : []), ...images.map(url => ({ type: 'image_url' as const, image_url: { url } }))]
      : message;

    history.push({ role: 'user', content: userContent });
    if (history.length > 120) history = history.slice(-120);

    // Build NIM messages with FULL context already loaded
    const nimMessages: NIMChatMessage[] = [
      { role: 'system', content: preflight.systemPrompt },
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const nimOpts = {
      model,
      messages: nimMessages,
      stream: true as const,
      max_tokens: maxTokens,
      temperature: 0.6,
      top_p: 0.95,
      ...(enableThinking ? { thinking: { type: 'enabled' as const, budget_tokens: 8000 } } : {}),
    };

    logger.info('chat', `→ NIM ${model}`, { task: nimTask, contextLen: preflight.systemPrompt.length });

    if (!stream) {
      const { stream: _omit, ...nimOptsNoStream } = nimOpts;
      const result = await chatComplete(nimOptsNoStream);
      history.push({ role: 'assistant', content: result.content });
      await Promise.all([
        sessionStore.set(sessionKey, history),
        isNew ? sessionStore.upsertConversation(userId, { id: sessionKey, title: generateTitle(message), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: history.length, preview: message.slice(0, 80) }) : Promise.resolve(),
      ]);
      return Response.json({ success: true, response: result.content, thinking: result.thinking || null, sessionId: sessionKey, duration: Date.now() - startTime, ragSources: preflight.ragSources, ragUsed: preflight.ragUsed });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STREAMING: All context is ready — NIM can stream at FULL speed
    // ─────────────────────────────────────────────────────────────────────────
    const nimResponse = await chatStream(nimOpts);
    if (!nimResponse.ok) {
      const errText = await nimResponse.text();
      throw new Error(`NIM ${nimResponse.status}: ${errText.slice(0, 300)}`);
    }

    const encoder = new TextEncoder();
    let fullContent = '', fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        try {
          // Immediately emit preflight metadata so UI can show sources
          if (preflight.ragSources.length > 0) {
            send({ type: 'rag', sources: preflight.ragSources, searchQuery: message });
          }

          // Stream tokens — everything is already in context so this is fast
          for await (const event of parseNIMStream(nimResponse)) {
            if (event.type === 'thinking') { fullThinking += event.content; send(event); }
            else if (event.type === 'content') { fullContent += event.content; send(event); }
            else if (event.type === 'usage') { send(event); }
          }

          // Save history + memory async (after response is streaming, non-blocking)
          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 120) history = history.slice(-120);

            await Promise.all([
              sessionStore.set(sessionKey, history),
              isNew ? sessionStore.upsertConversation(userId, {
                id: sessionKey, title: generateTitle(message),
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                messageCount: history.length, preview: message.slice(0, 80),
              }) : Promise.resolve(),
              // Memory store is fully async — never blocks response
              (async () => {
                try {
                  if (message.length > 20) {
                    const exists = await memoryManager.findSimilar(message);
                    if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${fullContent.slice(0, 400)}`, 0.3);
                  }
                } catch { /* ignore */ }
              })(),
            ]);
          }

          send({
            type: 'done',
            sessionId: sessionKey,
            duration: Date.now() - startTime,
            messageCount: history.length,
            ragSources: preflight.ragSources,
            ragUsed: preflight.ragUsed,
          });
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
        'X-Preflight-Ms': String(preflightMs),
      },
    });
  } catch (error) {
    logger.error('chat', 'Request failed', error instanceof Error ? error : new Error(String(error)));
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed', duration: Date.now() - startTime }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const history = await sessionStore.get(searchParams.get('sessionId') ?? 'default');
  return Response.json({ success: true, messageCount: history.length });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  await sessionStore.deleteConversation(searchParams.get('userId') ?? 'default', searchParams.get('sessionId') ?? 'default');
  return Response.json({ success: true });
}
