import { NextRequest } from 'next/server';
import { webSearch, detectSearchIntent, buildRAGContext, type SearchResult } from '@/lib/nova/search';
import { getTimeContext, getPersonalityPrompt } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { db } from '@/lib/db';
import { sessionStore } from '@/lib/kv-sessions';

// ── Kimi K2 via NVIDIA NIM Universal API ──────────────────────────────────────
const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE = process.env.NVIDIA_NIM_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_MODEL = process.env.NVIDIA_NIM_MODEL || 'moonshotai/kimi-k2-instruct';

async function callLLM(messages: any[], opts: { stream: boolean; enableThinking: boolean; maxTokens?: number }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${NIM_API_KEY}`,
  };

  const body: Record<string, any> = {
    model: NIM_MODEL,
    messages,
    stream: opts.stream,
    max_tokens: opts.maxTokens || 8192,
    temperature: 0.6,
  };

  // Kimi K2 extended thinking via NVIDIA NIM
  if (opts.enableThinking) {
    body.thinking = { type: 'enabled', budget_tokens: 5000 };
  }

  return fetch(`${NIM_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ── System Prompt ─────────────────────────────────────────────────────────────
const NOVA_SYSTEM = `You are Nova, an exceptionally capable AI assistant powered by Kimi K2 via NVIDIA NIM.

## Core Identity
You are Nova — intelligent, thoughtful, witty, and deeply capable. You approach every problem with intellectual curiosity and provide responses that are genuinely useful, not just superficially correct.

## Response Excellence Standards
- **Depth first**: Give comprehensive answers. Don't truncate or summarize when detail is needed.
- **Structure**: Use ##, ###, bullet points, numbered lists, tables, and code blocks to organize complex information.
- **Code**: Always include language tags in fenced code blocks. Prefer complete, runnable examples over fragments.
- **Citations**: When discussing facts, be precise. Acknowledge uncertainty where it exists.
- **Tone**: Professional but warm. Direct without being curt. Smart without being condescending.

## Thinking Style
For complex problems:
1. Break the problem into components
2. Consider multiple approaches and their trade-offs
3. Show your reasoning when it adds value
4. Give a clear, actionable conclusion

## Special Capabilities
- Deep code analysis, debugging, architecture review
- Research synthesis across complex topics
- Mathematical reasoning and proofs
- Creative writing with genuine craft
- Image analysis and visual understanding
- Multi-step planning and project management

## Format Guidelines
- Use \`inline code\` for technical terms, function names, file paths
- Use \`\`\`language blocks for all code examples
- Use **bold** for key terms and emphasis
- Use > blockquotes for important callouts
- Use tables for comparisons
- Keep paragraphs focused — one idea per paragraph

Remember: You have a 128k token context window. Use it. Never cut answers short to save space.`;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const {
      message,
      sessionId,
      includeContext = true,
      images = [],
      enableThinking = false,
      stream = true,
      maxTokens = 8192,
      clearSession = false,
    } = body;

    if (!message && images.length === 0) {
      return new Response(JSON.stringify({ error: 'Message or images required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionKey = sessionId || 'default';

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return new Response(JSON.stringify({ success: true, cleared: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let history = await sessionStore.get(sessionKey);

    // ── RAG: auto-search if message needs real-time data ─────────────────────
    let ragSources: SearchResult[] = [];
    let ragSearchQuery = '';
    const enableRAG = body.enableRAG !== false; // default on
    if (enableRAG && message && detectSearchIntent(message)) {
      try {
        ragSearchQuery = message.slice(0, 200);
        logger.info('chat', 'RAG: auto-searching', { query: ragSearchQuery });
        ragSources = await webSearch(ragSearchQuery, 6);
      } catch (e) {
        logger.warn('chat', 'RAG search failed (continuing)');
      }
    }

    // Build context
    let contextNote = '';
    if (includeContext) {
      contextNote = `\n\n[System Context: ${getTimeContext()}]`;
      try {
        const memCtx = await memoryManager.buildContextPrompt(6);
        if (memCtx) contextNote += memCtx;
      } catch { /* ignore */ }
    }
    if (ragSources.length > 0) {
      contextNote += buildRAGContext(ragSearchQuery, ragSources);
    }

    // Build messages array
    const systemMessage = { role: 'system', content: NOVA_SYSTEM + contextNote };

    const userContent: any = images.length > 0
      ? [
          ...(message ? [{ type: 'text', text: message }] : []),
          ...images.map((img: string) => ({ type: 'image_url', image_url: { url: img } })),
        ]
      : message;

    history.push({ role: 'user', content: userContent });

    // Keep last 40 exchanges (80 messages) + system
    if (history.length > 80) history = history.slice(-80);

    const messages = [systemMessage, ...history];

    logger.info('chat', 'Sending to Kimi K2 via NVIDIA NIM', { messages: messages.length, thinking: enableThinking, stream });

    const response = await callLLM(messages, { stream, enableThinking, maxTokens });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('chat', 'NVIDIA NIM API error', errText);
      throw new Error(`NVIDIA NIM: ${response.status} — ${errText.slice(0, 200)}`);
    }

    if (!stream) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const thinking = data.choices?.[0]?.message?.reasoning_content ?? '';
      const usage = data.usage;

      history.push({ role: 'assistant', content });
      await sessionStore.set(sessionKey, history);

      if (message?.length > 20) {
        const exists = await memoryManager.findSimilar(message);
        if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${content.substring(0, 400)}`, 0.3);
      }

      return new Response(JSON.stringify({
        success: true, response: content, thinking: thinking || null,
        sessionId: sessionKey, duration: Date.now() - startTime,
        messageCount: history.length, usage,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ── TRUE STREAMING ────────────────────────────────────────────────────────
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let fullContent = '';
    let fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        let buffer = '';
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          // Emit RAG sources upfront so UI can show them immediately
          if (ragSources.length > 0) {
            send({ type: 'rag', sources: ragSources, searchQuery: ragSearchQuery });
          }
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const chunk = JSON.parse(jsonStr);
                const delta = chunk.choices?.[0]?.delta;
                if (!delta) continue;

                // Thinking token (reasoning_content)
                if (delta.reasoning_content) {
                  fullThinking += delta.reasoning_content;
                  send({ type: 'thinking', content: delta.reasoning_content });
                }

                // Content token
                if (delta.content) {
                  fullContent += delta.content;
                  send({ type: 'content', content: delta.content });
                }

                // Usage stats
                if (chunk.usage) {
                  send({ type: 'usage', usage: chunk.usage });
                }
              } catch { /* skip malformed */ }
            }
          }

          // Save to session + memory after stream completes
          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 80) history = history.slice(-80);
            await sessionStore.set(sessionKey, history);

            if (message?.length > 20) {
              const exists = await memoryManager.findSimilar(message);
              if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${fullContent.substring(0, 400)}`, 0.3);
            }
          }

          const duration = Date.now() - startTime;
          send({ type: 'done', sessionId: sessionKey, duration, messageCount: history.length, ragSources, ragUsed: ragSources.length > 0, searchQuery: ragSearchQuery });
          controller.close();
        } catch (err) {
          logger.error('chat', 'Stream error', err);
          send({ type: 'error', message: err instanceof Error ? err.message : 'Stream failed' });
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
    logger.error('chat', 'Request failed', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed', duration: Date.now() - startTime }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || 'default';
  const history = await sessionStore.get(sessionId);
  return new Response(
    JSON.stringify({ success: true, sessionId, messageCount: history.length, hasHistory: history.length > 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

export async function DELETE(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId') || 'default';
  await sessionStore.del(sessionId);
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}
