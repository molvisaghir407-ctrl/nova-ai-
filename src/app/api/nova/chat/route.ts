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
Nova — intelligent, thorough, witty. Complete, genuinely useful responses.

## Response Standards
- **Depth**: Never truncate. Use the full 128k context.
- **Structure**: ##/### headings, bullets, tables, code blocks as needed.
- **Code**: Language-tagged fenced blocks. Complete runnable examples.
- **Accuracy**: Cite [1][2] when using web sources. Acknowledge uncertainty.
- **Tone**: Professional-warm. Direct without being curt.

## Format
- \`inline code\` for terms, file paths, function names
- \`\`\`language blocks for ALL code samples
- **bold** for key terms, > blockquotes for callouts, tables for comparisons`;

function generateTitle(message: string): string {
  const clean = message.trim().replace(/\n+/g, ' ');
  return clean.length > 52 ? clean.slice(0, 49) + '...' : clean;
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
      enableThinking = false, stream = true, maxTokens = 16000,
      clearSession = false, includeContext = true,
      userId = 'default', enableRAG = true,
      ragThreshold = 150, // chars — below this → API only (fast path)
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

    // Route to correct model
    const nimTask = classifyTask(message, images.length > 0, enableThinking);
    const model = body.model ?? routeTask(nimTask);

    // Build context
    let systemContent = NOVA_SYSTEM;
    let ragSources: import('@/types/nova.types').Source[] = [];
    let ragSearchQuery = '';

    if (includeContext) {
      systemContent += `\n\n[Time: ${getTimeContext()}]`;
      try {
        const memCtx = await memoryManager.buildContextPrompt(8);
        if (memCtx) systemContent += memCtx;
      } catch { /* ignore */ }
    }

    // Smart RAG: only fetch for real-time intents OR long complex queries
    const intent = classifyIntent(message);
    const useRAG = enableRAG && message && shouldUseRAG(intent, message.length, ragThreshold);

    if (useRAG) {
      try {
        const rag = await runRAG(message);
        if (rag.sources.length > 0) {
          ragSources = rag.sources;
          ragSearchQuery = rag.searchQuery;
          systemContent += buildRAGContext(rag);
        }
      } catch (e) { logger.warn('chat', 'RAG failed, continuing without web context', { error: String(e) }); }
    }

    // Build messages
    const userContent: NIMChatMessage['content'] = images.length > 0
      ? [...(message ? [{ type: 'text' as const, text: message }] : []), ...images.map(url => ({ type: 'image_url' as const, image_url: { url } }))]
      : message;

    history.push({ role: 'user', content: userContent });
    if (history.length > 120) history = history.slice(-120);

    const nimMessages: NIMChatMessage[] = [
      { role: 'system', content: systemContent },
      ...history.map((m: { role: string; content: NIMChatMessage['content'] }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
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

    logger.info('chat', `${useRAG ? '🔍 RAG+' : '⚡ Direct'} → ${model}`, { intent, msgLen: message.length, thinking: enableThinking });

    const response = await chatStream(nimOpts);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NIM ${response.status}: ${errText.slice(0, 300)}`);
    }

    if (!stream) {
      let content = '', thinking = '';
      for await (const event of parseNIMStream(response)) {
        if (event.type === 'thinking') thinking += event.content;
        if (event.type === 'content') content += event.content;
      }
      history.push({ role: 'assistant', content });
      await sessionStore.set(sessionKey, history);
      if (isNew) await sessionStore.upsertConversation(userId, { id: sessionKey, title: generateTitle(message), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: history.length, preview: message.slice(0, 80) });
      return Response.json({ success: true, response: content, thinking: thinking || null, sessionId: sessionKey, duration: Date.now() - startTime, ragSources, ragUsed: ragSources.length > 0, ragSearchQuery });
    }

    // Streaming
    const encoder = new TextEncoder();
    let fullContent = '';
    let fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          if (ragSources.length > 0) send({ type: 'rag', sources: ragSources, searchQuery: ragSearchQuery });

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

          send({ type: 'done', sessionId: sessionKey, duration: Date.now() - startTime, messageCount: history.length, ragSources, ragUsed: ragSources.length > 0 });
          controller.close();
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Stream failed', code: 'STREAM_ERROR' });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
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
