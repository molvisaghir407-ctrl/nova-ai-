import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore } from '@/lib/kv-sessions';
import { chatStream, parseNIMStream } from '@/lib/nova/nim/client';
import { routeTask, classifyTask, NIM_MODELS } from '@/lib/nova/nim/models';
import { classifyIntent, shouldUseRAG } from '@/lib/nova/rag/intent';
import { runRAG, buildRAGContext } from '@/lib/nova/rag/orchestrator';
import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent } from '@/types/nova.types';

const NOVA_SYSTEM = `You are Nova, a highly capable AI assistant powered by NVIDIA NIM.

## Identity
Nova — intelligent, thorough, witty. You give genuinely useful, complete responses.

## Response Standards
- **Depth**: Never truncate. Use the full context window available.
- **Structure**: Use ##/### headings, bullets, tables, code blocks as needed.
- **Code**: Always use language-tagged fenced blocks. Write complete, runnable examples.
- **Accuracy**: Acknowledge uncertainty rather than hallucinate.
- **Citations**: When using web results, cite as [1], [2], etc.

## Format Rules
- \`inline code\` for terms, function names, file paths
- \`\`\`language blocks for ALL code
- **bold** for key terms
- > blockquotes for callouts
- Tables for comparisons
- One clear idea per paragraph`;

function buildSystemPrompt(contextNote: string): string {
  return NOVA_SYSTEM + contextNote;
}

async function buildContext(message: string, includeContext: boolean, enableRAG: boolean): Promise<{ contextNote: string; ragSources: import('@/types/nova.types').Source[] }> {
  let contextNote = '';
  let ragSources: import('@/types/nova.types').Source[] = [];

  if (includeContext) {
    contextNote += `\n\n[Time: ${getTimeContext()}]`;
    try {
      const memCtx = await memoryManager.buildContextPrompt(8);
      if (memCtx) contextNote += memCtx;
    } catch { /* ignore */ }
  }

  if (enableRAG && message) {
    const intent = classifyIntent(message);
    if (shouldUseRAG(intent)) {
      try {
        const rag = await runRAG(message);
        if (rag.sources.length > 0) {
          ragSources = rag.sources;
          contextNote += buildRAGContext(rag);
        }
      } catch (e) { logger.warn('chat', 'RAG failed', { error: String(e) }); }
    }
  }

  return { contextNote, ragSources };
}

function generateTitle(message: string): string {
  const clean = message.trim().replace(/\n+/g, ' ');
  return clean.length > 50 ? clean.slice(0, 47) + '...' : clean;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json() as {
      message?: string; sessionId?: string; images?: string[];
      enableThinking?: boolean; stream?: boolean; maxTokens?: number;
      clearSession?: boolean; includeContext?: boolean; userId?: string;
      enableRAG?: boolean; task?: string;
    };

    const {
      message = '', sessionId, images = [], enableThinking = false,
      stream = true, maxTokens = 16000, clearSession = false,
      includeContext = true, userId = 'default', enableRAG = true, task,
    } = body;

    if (!message && images.length === 0) {
      return Response.json({ success: false, error: 'Message or images required', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const sessionKey = sessionId ?? `session-${Date.now()}`;

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return Response.json({ success: true, cleared: true });
    }

    let history = await sessionStore.get(sessionKey);
    const isNew = history.length === 0;

    // Classify task for model routing
    const nimTask = task as import('@/types/nvidia.types').NIMTask | undefined
      ?? classifyTask(message, images.length > 0, enableThinking);
    const model = routeTask(nimTask);

    // Build context + RAG
    const { contextNote, ragSources } = await buildContext(message, includeContext, enableRAG && !enableThinking);

    const systemContent = buildSystemPrompt(contextNote);

    // Build user content
    const userContent: NIMChatMessage['content'] = images.length > 0
      ? [
          ...(message ? [{ type: 'text' as const, text: message }] : []),
          ...images.map(url => ({ type: 'image_url' as const, image_url: { url } })),
        ]
      : message;

    history.push({ role: 'user', content: userContent });
    if (history.length > 120) history = history.slice(-120);

    const nimMessages: NIMChatMessage[] = [
      { role: 'system', content: systemContent },
      ...history.map((m: { role: string; content: NIMChatMessage['content'] }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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

    logger.info('chat', `Sending to ${model}`, { task: nimTask, thinking: enableThinking, ragSources: ragSources.length });
    const response = await chatStream(nimOpts);

    if (!stream) {
      // Non-streaming path
      let content = '', thinking = '';
      for await (const event of parseNIMStream(response)) {
        if (event.type === 'thinking') thinking += event.content;
        if (event.type === 'content') content += event.content;
      }
      history.push({ role: 'assistant', content });
      await sessionStore.set(sessionKey, history);
      if (isNew) await sessionStore.upsertConversation(userId, { id: sessionKey, title: generateTitle(message), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: history.length, preview: message.slice(0, 80) });
      return Response.json({ success: true, response: content, thinking: thinking || null, sessionId: sessionKey, duration: Date.now() - startTime, ragSources, ragUsed: ragSources.length > 0 });
    }

    // Streaming path
    const encoder = new TextEncoder();
    let fullContent = '';
    let fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: StreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          if (ragSources.length > 0) send({ type: 'rag', sources: ragSources, searchQuery: message });

          for await (const event of parseNIMStream(response)) {
            if (event.type === 'thinking') { fullThinking += event.content; send(event); }
            else if (event.type === 'content') { fullContent += event.content; send(event); }
            else if (event.type === 'usage') { send(event); }
          }

          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 120) history = history.slice(-120);
            await sessionStore.set(sessionKey, history);
            if (isNew) await sessionStore.upsertConversation(userId, { id: sessionKey, title: generateTitle(message), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: history.length, preview: message.slice(0, 80) });
            if (message.length > 20) {
              const exists = await memoryManager.findSimilar(message);
              if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${fullContent.slice(0, 400)}`, 0.3);
            }
          }

          const doneEvent: StreamEvent = { type: 'done', sessionId: sessionKey, duration: Date.now() - startTime, messageCount: history.length, ragSources, ragUsed: ragSources.length > 0 };
          send(doneEvent);
          controller.close();
        } catch (err) {
          const errEvent: StreamEvent = { type: 'error', message: err instanceof Error ? err.message : 'Stream failed', code: 'STREAM_ERROR' };
          send(errEvent);
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
    });
  } catch (error) {
    logger.error('chat', 'Request failed', error instanceof Error ? error : new Error(String(error)));
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed', code: 'INTERNAL_ERROR', duration: Date.now() - startTime }, { status: 500 });
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
