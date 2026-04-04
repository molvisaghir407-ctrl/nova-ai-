import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore } from '@/lib/kv-sessions';
import { chatStream, parseNIMStream } from '@/lib/nova/nim/client';
import { classifyIntent, shouldUseRAG } from '@/lib/nova/rag/intent';
import { runRAG, buildRAGContext } from '@/lib/nova/rag/orchestrator';
import { selectAgent, getAgentById } from '@/lib/nova/agents/registry';
import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent } from '@/types/nova.types';

async function buildContext(
  message: string, includeContext: boolean, enableRAG: boolean,
  onAgentUpdate?: (id: string, status: 'running' | 'done' | 'error', count: number) => void,
): Promise<{ contextNote: string; ragSources: import('@/types/nova.types').Source[]; ragSearchQuery: string }> {
  let contextNote = '';
  let ragSources: import('@/types/nova.types').Source[] = [];
  let ragSearchQuery = '';

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
        const rag = await runRAG(message, onAgentUpdate);
        if (rag.sources.length > 0) {
          ragSources = rag.sources;
          ragSearchQuery = rag.searchQuery;
          contextNote += buildRAGContext(rag);
        }
      } catch (e) { logger.warn('chat', 'RAG failed', { error: String(e) }); }
    }
  }

  return { contextNote, ragSources, ragSearchQuery };
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
      enableRAG?: boolean; agentId?: string; model?: string;
    };

    const {
      message = '', sessionId, images = [], enableThinking = false,
      stream = true, maxTokens, clearSession = false,
      includeContext = true, userId = 'default', enableRAG = true,
      agentId, model: userModel,
    } = body;

    if (!message && images.length === 0) {
      return Response.json({ error: 'Message or images required' }, { status: 400 });
    }

    const sessionKey = sessionId ?? `session-${Date.now()}`;

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return Response.json({ success: true, cleared: true });
    }

    let history = await sessionStore.get(sessionKey);
    const isNew = history.length === 0;

    // ── Select agent ──────────────────────────────────────────────────────────
    const intent = classifyIntent(message);
    const agent = agentId
      ? (getAgentById(agentId) ?? selectAgent(message, intent, userModel))
      : selectAgent(message, intent, userModel);

    const useThinking = enableThinking || agent.useThinking;
    const resolvedTokens = maxTokens ?? agent.maxTokens;

    logger.info('chat', `Agent: ${agent.name} (${agent.model})`, { intent, thinking: useThinking });

    // ── RAG + context ─────────────────────────────────────────────────────────
    let agentEvents: StreamEvent[] = [];
    const { contextNote, ragSources, ragSearchQuery } = await buildContext(
      message,
      includeContext,
      enableRAG && !useThinking,
      (id, status, count) => {
        agentEvents.push({ type: 'agent_update', agentId: id, status, resultCount: count });
      },
    );

    // ── Build messages ────────────────────────────────────────────────────────
    const systemContent = agent.systemPrompt + contextNote;

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
      ...history.map((m: { role: string; content: NIMChatMessage['content'] }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // ── Vision: override model if images present ──────────────────────────────
    const finalModel = images.length > 0
      ? 'meta/llama-3.2-90b-vision-instruct'
      : (userModel ?? agent.model);

    const nimOpts = {
      model: finalModel,
      messages: nimMessages,
      stream: true as const,
      max_tokens: resolvedTokens,
      temperature: agent.temperature,
      top_p: 0.95,
      ...(useThinking ? { thinking: { type: 'enabled' as const, budget_tokens: 8000 } } : {}),
    };

    const response = await chatStream(nimOpts);

    // ── Emit agent info in SSE event ──────────────────────────────────────────
    const agentInfo = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      model: finalModel,
      thinking: useThinking,
    };

    if (!stream) {
      let content = '', thinking = '';
      for await (const event of parseNIMStream(response)) {
        if (event.type === 'thinking') thinking += event.content;
        if (event.type === 'content') content += event.content;
      }
      history.push({ role: 'assistant', content });
      await sessionStore.set(sessionKey, history);
      if (isNew) await sessionStore.upsertConversation(userId, {
        id: sessionKey, title: generateTitle(message),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messageCount: history.length, preview: message.slice(0, 80),
      });
      return Response.json({
        success: true, response: content, thinking: thinking || null,
        sessionId: sessionKey, duration: Date.now() - startTime,
        ragSources, ragUsed: ragSources.length > 0, agent: agentInfo,
      });
    }

    // ── Streaming path ────────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    let fullContent = '';
    let fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: StreamEvent | { type: string; [k: string]: unknown }) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          // 1. Emit agent info immediately so UI can show which agent is working
          send({ type: 'agent', agent: agentInfo });

          // 2. Emit any buffered agent update events from RAG
          for (const ev of agentEvents) send(ev);
          agentEvents = [];

          // 3. Emit RAG sources
          if (ragSources.length > 0) {
            send({ type: 'rag', sources: ragSources, searchQuery: ragSearchQuery } as StreamEvent);
          }

          // 4. Stream LLM tokens
          for await (const event of parseNIMStream(response)) {
            if (event.type === 'thinking') { fullThinking += event.content; send(event); }
            else if (event.type === 'content') { fullContent += event.content; send(event); }
            else if (event.type === 'usage') { send(event); }
          }

          // 5. Persist
          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 120) history = history.slice(-120);
            await sessionStore.set(sessionKey, history);
            if (isNew) await sessionStore.upsertConversation(userId, {
              id: sessionKey, title: generateTitle(message),
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
              messageCount: history.length, preview: message.slice(0, 80),
            });
            if (message.length > 20) {
              const exists = await memoryManager.findSimilar(message);
              if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${fullContent.slice(0, 400)}`, 0.3);
            }
          }

          send({ type: 'done', sessionId: sessionKey, duration: Date.now() - startTime, messageCount: history.length, ragSources, ragUsed: ragSources.length > 0 } as StreamEvent);
          controller.close();
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Stream failed' } as StreamEvent);
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logger.error('chat', 'Request failed', error instanceof Error ? error : new Error(String(error)));
    return Response.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? 'default';
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
