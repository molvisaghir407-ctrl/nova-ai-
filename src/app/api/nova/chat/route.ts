import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore } from '@/lib/kv-sessions';
import { streamWithFallback, type StreamWithFallbackOptions } from '@/lib/nova/providers/client';
import { classifyIntent, shouldUseRAG, assessComplexity } from '@/lib/nova/rag/intent';
import { runRAGPipeline, buildRichContext } from '@/lib/nova/rag/pipeline';
import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent, Source } from '@/types/nova.types';
import type { TaskType } from '@/lib/nova/providers/registry';

// ── System prompt ─────────────────────────────────────────────────────────────
const NOVA_SYSTEM = `You are Nova — an exceptionally intelligent, adaptive AI assistant built on Kimi K2 via NVIDIA NIM.

## Core Identity
- Name: Nova · Model: Kimi K2 Instruct · Context: 128k tokens
- Personality: Precise, proactive, witty, genuinely helpful

## Response Quality Standards
- **Complete**: Never truncate. Every question deserves a thorough answer.
- **Accurate**: When using web research, cite sources inline as [1], [2], etc. Clearly distinguish facts from inference.
- **Adaptive**: Match the response depth to the query complexity. One-liners for simple questions; deep dives for complex ones.
- **Structured**: Use ## headings, bullets, tables, and code blocks for clarity — but only when they genuinely help.
- **Code**: Always use language-fenced \`\`\`language blocks. Write complete, runnable examples with clear explanations.
- **Honest**: Acknowledge uncertainty. Say "I'm not sure" rather than hallucinate.

## Formatting Guidelines
- **Bold** key concepts, terms, and critical information.
- > Blockquotes for important callouts, warnings, or quotes.
- \`inline code\` for terms, paths, filenames, commands, function names.
- Tables for structured comparisons (3+ items with multiple attributes).
- Numbered lists for sequential steps. Bullets for unordered collections.
- Code fences: always specify language for syntax highlighting.
- Avoid excessive headers for short responses — use them only when content is long enough to benefit from navigation.

## Conversational Style
- Be direct and confident. Lead with the answer, then explain.
- Light wit where appropriate; never forced or excessive.
- For follow-up questions, be concise — you already have context.
- Acknowledge emotional content with empathy before diving into solutions.`;

function generateTitle(msg: string): string {
  const c = msg.trim().replace(/\n+/g, ' ');
  return c.length > 52 ? c.slice(0, 49) + '...' : c;
}

// ── Smart task type mapping for optimal model routing ─────────────────────────
function detectTask(message: string, hasImages: boolean, enableThinking: boolean, intent: string): TaskType {
  if (enableThinking) return 'thinking';
  if (hasImages) return 'vision';
  const lower = message.toLowerCase();

  // Map enriched intent → task type
  if (intent === 'math') return 'math';
  if (intent === 'code' || intent === 'howto') return 'code';
  if (['science', 'medical', 'legal', 'history', 'comparison'].includes(intent)) return 'analysis';
  if (intent === 'creative') return 'general';

  // Fallback pattern matching
  if (/\b(summarize|summary|tldr|brief|recap)\b/.test(lower)) return 'summarize';
  if (message.length > 2000) return 'long_context';
  if (/\b(hi|hello|hey|thanks|what is|tell me)\b/.test(lower) && message.length < 80) return 'fast';
  return 'general';
}

// ── Pre-flight: load all context in parallel ──────────────────────────────────
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
  ragDurationMs?: number;
}> {
  const intent = classifyIntent(message);
  const complexity = assessComplexity(message, intent);
  const needRAG = enableRAG && message.length > 0 && shouldUseRAG(intent, message.length, ragThreshold);

  logger.info('chat', `Intent: ${intent} | Complexity: ${complexity} | RAG: ${needRAG}`);

  const [historyResult, memResult, ragResult] = await Promise.allSettled([
    sessionStore.get(sessionKey),
    includeContext ? memoryManager.buildContextPrompt(6) : Promise.resolve(''),
    needRAG ? runRAGPipeline(message) : Promise.resolve(null),
  ]);

  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const memCtx  = memResult.status === 'fulfilled' ? memResult.value : '';
  const ragPackage = ragResult.status === 'fulfilled' ? ragResult.value : null;

  let systemPrompt = NOVA_SYSTEM;
  if (includeContext) systemPrompt += `\n\n[Time: ${getTimeContext()}]`;
  if (memCtx) systemPrompt += memCtx;
  if (ragPackage?.sources.length) systemPrompt += buildRichContext(ragPackage);

  return {
    history: history as Array<{ role: string; content: NIMChatMessage['content'] }>,
    systemPrompt,
    ragSources: ragPackage?.sources ?? [],
    ragUsed: (ragPackage?.sources.length ?? 0) > 0,
    ragDurationMs: ragPackage?.durationMs,
  };
}

// ── POST /api/nova/chat ───────────────────────────────────────────────────────
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
      enableThinking = false, maxTokens = 16000,
      clearSession = false, includeContext = true,
      userId = 'default', enableRAG = true, ragThreshold = 100,
    } = body;

    if (!message && images.length === 0) {
      return Response.json({ success: false, error: 'Message or images required' }, { status: 400 });
    }

    const sessionKey = sessionId ?? `session-${Date.now()}`;

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return Response.json({ success: true, cleared: true });
    }

    // ── Pre-flight ──────────────────────────────────────────────────────────
    const preflight = await buildPreflightContainer(
      message, sessionKey, includeContext, enableRAG, ragThreshold,
    );
    const preflightMs = Date.now() - startTime;

    let history = preflight.history;
    const isNew = history.length === 0;

    // Build user message
    const userContent: NIMChatMessage['content'] = images.length > 0
      ? [
          ...(message ? [{ type: 'text' as const, text: message }] : []),
          ...images.map(url => ({ type: 'image_url' as const, image_url: { url } })),
        ]
      : message;

    history.push({ role: 'user', content: userContent });
    if (history.length > 120) history = history.slice(-120);

    const nimMessages: NIMChatMessage[] = [
      { role: 'system', content: preflight.systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Detect task for optimal model routing
    const intent = classifyIntent(message);
    const task = detectTask(message, images.length > 0, enableThinking, intent);

    const providerOpts: StreamWithFallbackOptions = {
      messages: nimMessages,
      task,
      maxTokens,
      temperature: 0.6,
      enableThinking,
      hasVision: images.length > 0,
      preferredModel: body.model,
    };

    logger.info('chat', `Preflight ${preflightMs}ms | task=${task} | rag=${preflight.ragUsed}${preflight.ragDurationMs ? ` (${preflight.ragDurationMs}ms)` : ''}`);

    // ── Streaming with automatic fallback ──────────────────────────────────
    const { stream, modelUsed, providerUsed, fallbackLevel } = await streamWithFallback(providerOpts);

    logger.info('chat', `Streaming via ${modelUsed.displayName} (${providerUsed}, fallback=${fallbackLevel})`);

    const encoder = new TextEncoder();
    let fullContent = '', fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: StreamEvent) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        try {
          // Emit RAG sources immediately so UI can show them while model warms up
          if (preflight.ragSources.length > 0) {
            send({ type: 'rag', sources: preflight.ragSources, searchQuery: message });
          }

          for await (const event of stream) {
            if (event.type === 'thinking') { fullThinking += event.content; send(event); }
            else if (event.type === 'content') { fullContent += event.content; send(event); }
            else if (event.type === 'usage') { send(event); }
          }

          // Persist state async (fire and forget)
          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 120) history = history.slice(-120);

            await Promise.all([
              sessionStore.set(sessionKey, history),
              isNew
                ? sessionStore.upsertConversation(userId, {
                    id: sessionKey,
                    title: generateTitle(message),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    messageCount: history.length,
                    preview: message.slice(0, 80),
                  })
                : Promise.resolve(),
              (async () => {
                try {
                  if (message.length > 20) {
                    const exists = await memoryManager.findSimilar(message);
                    if (!exists) {
                      await memoryManager.store(
                        'conversation',
                        `User: ${message}\nNova: ${fullContent.slice(0, 400)}`,
                        0.3,
                      );
                    }
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
          } as StreamEvent & { modelUsed?: string; providerUsed?: string });
          controller.close();
        } catch (err) {
          send({
            type: 'error',
            message: err instanceof Error ? err.message : 'Stream failed',
            code: 'STREAM_ERROR',
          });
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
        'X-Model-Used': modelUsed.displayName,
        'X-Provider-Used': providerUsed,
        'X-Fallback-Level': String(fallbackLevel),
        'X-Preflight-Ms': String(preflightMs),
        'X-Intent': intent,
      },
    });
  } catch (error) {
    logger.error('chat', 'Request failed', error instanceof Error ? error : new Error(String(error)));
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed', duration: Date.now() - startTime },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const history = await sessionStore.get(searchParams.get('sessionId') ?? 'default');
  return Response.json({ success: true, messageCount: history.length });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  await sessionStore.deleteConversation(
    searchParams.get('userId') ?? 'default',
    searchParams.get('sessionId') ?? 'default',
  );
  return Response.json({ success: true });
}
