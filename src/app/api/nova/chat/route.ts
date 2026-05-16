import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore } from '@/lib/kv-sessions';
import { streamWithFallback, type StreamWithFallbackOptions } from '@/lib/nova/providers/client';
import { classifyIntent, shouldUseRAG, assessComplexity } from '@/lib/nova/rag/intent';
import { runRAGPipeline, buildRichContext } from '@/lib/nova/rag/pipeline';
import { inngest } from '@/lib/inngest/client';
import { semanticMemory } from '@/lib/nova/memory';
import { extractUrls, scrapeUrls, buildScrapeContext, pagesToSources } from '@/lib/nova/scraper/scraper';
import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent, Source } from '@/types/nova.types';
import type { TaskType } from '@/lib/nova/providers/registry';

export const dynamic = 'force-dynamic';

// ── System prompt ─────────────────────────────────────────────────────────────
const NOVA_SYSTEM = `You are Nova — an exceptionally intelligent, adaptive AI assistant with a continuously growing knowledge brain.

## Core Identity
- Name: Nova
- Personality: Precise, proactive, intellectually curious, genuinely helpful
- Brain: You have an accumulated BM25 knowledge base from all past research — cite it as [B1], [B2]…

## Deep Reasoning Framework
Before answering complex questions, internally apply these reasoning layers:
1. **Decompose** — Break the question into its core sub-questions and identify what knowledge is needed.
2. **Contextualize** — Consider assumptions, edge cases, and what the person really wants to know.
3. **Synthesize** — Combine information from multiple angles; note where sources agree or conflict.
4. **Validate** — Check your answer for logical consistency, accuracy, and completeness before outputting.
5. **Calibrate** — Adjust depth and format to match the question complexity and the user's apparent expertise.

## Response Quality Standards
- **Complete**: Never truncate. Every question deserves a thorough, fully-developed answer.
- **Accurate**: Cite live web sources as [1], [2]… and brain knowledge as [B1], [B2]…
- **Adaptive**: One-liner for simple questions; multi-section deep dives for complex ones.
- **Insightful**: Go beyond the obvious. Surface non-intuitive connections, tradeoffs, and implications.
- **Structured**: Use ## headings, bullets, tables, and code blocks for clarity — only when they genuinely help.
- **Code**: Always use language-fenced \`\`\`language blocks. Write complete, runnable examples.
- **Honest**: Acknowledge uncertainty explicitly. "I'm not certain about X" is better than hallucinating.

## HTML / Code Rendering
When generating HTML, CSS, JavaScript, or SVG that should be PREVIEWED visually:
- Use \`\`\`html fenced blocks — Nova's interface renders these as live previews with Preview/Source tabs.
- Include complete, self-contained HTML (full <html> document or a standalone snippet).
- For SVG artwork, diagrams, or data visualizations, use \`\`\`svg fenced blocks.
- For interactive demos (forms, animations, mini-apps), write complete HTML in a single fenced block.
- Apply clean, modern CSS. The renderer injects a white background and base styles automatically.

## Formatting Guidelines
- **Bold** key concepts, terms, and critical information.
- > Blockquotes for important callouts, warnings, or quotes.
- \`inline code\` for terms, paths, filenames, commands, function names.
- Tables for structured comparisons (3+ items with multiple attributes).
- Numbered lists for sequential steps. Bullets for unordered collections.
- Code fences: always specify language for syntax highlighting.

## Brain Knowledge
When 🧠 Brain context is provided above:
- Treat it as YOUR OWN accumulated learning — reference it confidently in first person.
- Brain citations [B1], [B2]… indicate recalled knowledge from previous research.
- Combine brain knowledge with live sources for the most comprehensive answers.
- The brain grows richer with each conversation — leverage it fully.

## Conversational Style
- Be direct and confident. Lead with the answer, then explain the reasoning.
- Light wit where appropriate; never forced or excessive.
- For follow-up questions, be concise — you already have the context window.
- Acknowledge emotional content with empathy before diving into solutions.
- Never pad responses. Quality > quantity. Dense, useful prose beats verbose fluff.`

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

  // Stage 1: fetch history + memory in parallel (RAG needs history for query resolution)
  const [historyResult, memResult, semMemResult] = await Promise.allSettled([
    sessionStore.get(sessionKey),
    includeContext ? memoryManager.buildContextPrompt(6) : Promise.resolve(''),
    // Semantic memory: query-relevant recall from Qdrant vector store
    includeContext ? semanticMemory.buildSemanticContext(message, 5) : Promise.resolve(''),
  ]);

  const history   = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const memCtx    = memResult.status === 'fulfilled' ? memResult.value : '';
  const semMemCtx = semMemResult.status === 'fulfilled' ? semMemResult.value : '';

  // Stage 2: run RAG now that history is resolved (enables conversational query expansion)
  const ragResult = needRAG
    ? await runRAGPipeline(message, history as Array<{ role: string; content: string }>).catch(() => null)
    : null;
  const ragPackage = ragResult;

  let systemPrompt = NOVA_SYSTEM;
  if (includeContext) systemPrompt += `\n\n[Time: ${getTimeContext()}]`;
  if (memCtx) systemPrompt += memCtx;
  if (semMemCtx) systemPrompt += semMemCtx;
  // Brain context injected first (highest priority knowledge layer)
  if (ragPackage?.brainContext) systemPrompt += ragPackage.brainContext;
  if (ragPackage?.sources.length) systemPrompt += buildRichContext(ragPackage);

  return {
    history: history as Array<{ role: string; content: NIMChatMessage['content'] }>,
    systemPrompt,
    ragSources: ragPackage?.sources ?? [],
    ragUsed: (ragPackage?.sources.length ?? 0) > 0,
    ragDurationMs: ragPackage?.durationMs,
  };
}


// ── Stream normalizer ─────────────────────────────────────────────────────────
// NVIDIA NIM (and most LLMs) send tokens in large irregular bursts.
// This generator splits every content chunk on whitespace boundaries so
// the client receives a steady word-by-word SSE feed — regardless of how
// chunky the underlying model is.  Zero latency cost: pure string splits.
async function* normalizeStream(source: AsyncGenerator<StreamEvent>): AsyncGenerator<StreamEvent> {
  for await (const event of source) {
    if (event.type !== 'content' || event.content.length <= 3) {
      yield event;
      continue;
    }
    // Split on whitespace keeping delimiters so spaces/newlines are preserved
    const parts = event.content.match(/\S+\s*|\s+/g) ?? [event.content];
    for (const part of parts) {
      yield { type: 'content', content: part };
    }
  }
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
      userId = 'default', enableRAG = true, ragThreshold = 30,
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
          // ── URL detection + live scraping (Kimi K2-style source cards) ──────
          const detectedUrls = extractUrls(message);
          let scrapeContext   = '';
          let scrapeSources: Source[] = [];

          if (detectedUrls.length > 0) {
            const progressMap = new Map<string, { url: string; title: string; domain: string; status: string }>();

            const pages = await scrapeUrls(detectedUrls, (evt) => {
              progressMap.set(evt.url, evt);
              send({
                type  : 'source_progress',
                url   : evt.url,
                title : evt.title,
                domain: evt.domain,
                status: evt.status as StreamEvent['type'] extends 'source_progress' ? never : never,
              } as unknown as StreamEvent);
            });

            scrapeContext  = buildScrapeContext(pages);
            scrapeSources  = pagesToSources(pages);

            // Mark all scraped pages as done
            for (const page of pages) {
              send({
                type  : 'source_progress',
                url   : page.url,
                title : page.title,
                domain: page.domain,
                status: 'done',
              } as unknown as StreamEvent);
            }
          }

          // Emit RAG sources immediately so UI can show them while model warms up
          const allSources = [...(preflight.ragSources ?? []), ...scrapeSources];
          if (allSources.length > 0) {
            send({ type: 'rag', sources: allSources, searchQuery: message });
          }

          // Inject scrape context into stream if present (re-build system with scraped content)
          if (scrapeContext) {
            // Reconstruct messages with scrape context appended to system
            // The provider stream already started — emit a meta note for the client
            logger.info('chat', `Scraped ${detectedUrls.length} URLs, ${scrapeSources.length} chunks`);
          }

          const normalizedStream = normalizeStream(stream);
        for await (const event of normalizedStream) {
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

          // ── Fire Inngest background events (non-blocking) ───────────────────
          void (async () => {
            try {
              const eventsToSend: Array<{ name: string; data: unknown }> = [];

              // 1. Index RAG sources into vector store
              if (preflight.ragSources?.length) {
                eventsToSend.push({
                  name: 'nova/content.index',
                  data: {
                    sources  : preflight.ragSources.map((s: { url?: string; snippet?: string; domain?: string }) => ({
                      url   : s.url ?? '',
                      text  : s.snippet ?? '',
                      domain: s.domain ?? '',
                    })),
                    query    : message,
                    sessionId: sessionKey,
                  },
                });
              }

              // 2. Consolidate conversation into semantic memory
              if (history.length >= 2) {
                eventsToSend.push({
                  name: 'nova/memory.consolidate',
                  data: {
                    userId  : userId,
                    messages: history.slice(-6).map(m => ({
                      role   : m.role,
                      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                    })),
                  },
                });
              }

              // 3. Update knowledge graph from RAG text
              const kgTexts = (preflight.ragSources ?? [])
                .map((s: { snippet?: string }) => s.snippet ?? '')
                .filter((t: string) => t.length > 100)
                .slice(0, 5);
              if (kgTexts.length) {
                eventsToSend.push({
                  name: 'nova/kg.update',
                  data: { texts: kgTexts, sessionId: sessionKey },
                });
              }

              if (eventsToSend.length) {
                // inngest.send accepts array of {name, data} objects
                for (const evt of eventsToSend) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await inngest.send(evt as any);
                }
              }
            } catch { /* background events failing must never crash the response */ }
          })();

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
