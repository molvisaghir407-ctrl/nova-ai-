import { NextRequest } from 'next/server';
import { getTimeContext } from '@/lib/nova/personality';
import { logger } from '@/lib/nova/logger';
import { memoryManager } from '@/lib/nova/memory';
import { sessionStore, ConversationMeta } from '@/lib/kv-sessions';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE = process.env.NVIDIA_NIM_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_MODEL = process.env.NVIDIA_NIM_MODEL || 'moonshotai/kimi-k2-instruct';

const NOVA_SYSTEM = `You are Nova, an exceptionally capable AI assistant powered by Kimi K2 via NVIDIA NIM.

## Core Identity
Nova — intelligent, thorough, witty. You give genuinely useful responses, not surface-level summaries.

## Response Standards
- **Depth**: Give complete answers. Never truncate. Use the full 128k context window.
- **Structure**: ##/### headings, bullet points, numbered lists, tables, code blocks.
- **Code**: Always include language identifier. Write complete, runnable examples.
- **Honesty**: Acknowledge uncertainty. Don't hallucinate facts.
- **Tone**: Professional-warm. Direct without being curt.

## Format Rules
- \`inline code\` for terms, function names, file paths
- \`\`\`language blocks for ALL code
- **bold** for key terms
- > blockquotes for important callouts  
- Tables for comparisons
- One focused idea per paragraph

You have a 128k token context. Use it fully. Never say "I'll keep this brief" or cut answers short.`;

async function callNIM(messages: any[], opts: { stream: boolean; enableThinking: boolean; maxTokens: number }) {
  const body: Record<string, any> = {
    model: NIM_MODEL,
    messages,
    stream: opts.stream,
    max_tokens: opts.maxTokens,
    temperature: 0.6,
    top_p: 0.95,
  };
  if (opts.enableThinking) {
    body.thinking = { type: 'enabled', budget_tokens: 8000 };
  }
  return fetch(`${NIM_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${NIM_API_KEY}` },
    body: JSON.stringify(body),
  });
}

// Auto-generate a title from first user message
function generateTitle(message: string): string {
  const clean = message.trim().replace(/\n+/g, ' ');
  return clean.length > 50 ? clean.slice(0, 47) + '...' : clean;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const {
      message, sessionId, images = [], enableThinking = false,
      stream = true, maxTokens = 16000, clearSession = false,
      includeContext = true, userId = 'default',
    } = body;

    if (!message && images.length === 0) {
      return new Response(JSON.stringify({ error: 'Message or images required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionKey = sessionId || `session-${Date.now()}`;

    if (clearSession) {
      await sessionStore.del(sessionKey);
      return new Response(JSON.stringify({ success: true, cleared: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let history = await sessionStore.get(sessionKey);
    const isNewConversation = history.length === 0;

    // Build system context
    let systemContent = NOVA_SYSTEM;
    if (includeContext) {
      systemContent += `\n\n[Time: ${getTimeContext()}]`;
      try {
        const memCtx = await memoryManager.buildContextPrompt(8);
        if (memCtx) systemContent += memCtx;
      } catch { /* ignore */ }
    }

    // RAG search if needed
    let ragSources: any[] = [];
    let ragQuery = '';
    const SEARCH_TRIGGERS = ['latest', 'current', 'today', 'news', 'recent', '2025', '2026', 'who won', 'stock', 'weather', 'score', 'just released', 'right now'];
    const enableRAG = body.enableRAG !== false;
    if (enableRAG && message && SEARCH_TRIGGERS.some(t => message.toLowerCase().includes(t))) {
      try {
        const { webSearch } = await import('@/lib/nova/search');
        ragQuery = message.slice(0, 200);
        ragSources = await webSearch(ragQuery, 6);
        if (ragSources.length > 0) {
          const snippets = ragSources.slice(0, 5).map((r: any, i: number) =>
            `[${i+1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`
          ).join('\n\n');
          systemContent += `\n\n---\n🔍 Web results for "${ragQuery}":\n\n${snippets}\n\nCite inline as [1], [2], etc.\n---`;
        }
      } catch { /* ignore */ }
    }

    const systemMessage = { role: 'system', content: systemContent };
    const userContent: any = images.length > 0
      ? [...(message ? [{ type: 'text', text: message }] : []), ...images.map((img: string) => ({ type: 'image_url', image_url: { url: img } }))]
      : message;

    history.push({ role: 'user', content: userContent });

    // Smart history trimming: keep full history up to 120 messages, then trim oldest non-system
    if (history.length > 120) history = history.slice(-120);

    const messages = [systemMessage, ...history];

    logger.info('chat', 'Sending to Kimi K2', { msgs: messages.length, thinking: enableThinking, stream, maxTokens });

    const response = await callNIM(messages, { stream, enableThinking, maxTokens });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('chat', 'NIM API error', errText);
      throw new Error(`NIM ${response.status}: ${errText.slice(0, 300)}`);
    }

    // Non-streaming path
    if (!stream) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const thinking = data.choices?.[0]?.message?.reasoning_content ?? '';
      history.push({ role: 'assistant', content });
      await sessionStore.set(sessionKey, history);
      // Update conversation index
      const title = isNewConversation ? generateTitle(message || 'New chat') : undefined;
      await sessionStore.upsertConversation(userId, {
        id: sessionKey, title: title || message?.slice(0, 50) || 'Chat',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messageCount: history.length, preview: message?.slice(0, 80) || '',
      });
      return new Response(JSON.stringify({ success: true, response: content, thinking: thinking || null, sessionId: sessionKey, duration: Date.now() - startTime }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ── Streaming path ───────────────────────────────────────────────────────
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let fullContent = '';
    let fullThinking = '';

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        let buf = '';
        try {
          if (ragSources.length > 0) send({ type: 'rag', sources: ragSources, searchQuery: ragQuery });

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const chunk = JSON.parse(jsonStr);
                const delta = chunk.choices?.[0]?.delta;
                if (!delta) continue;
                if (delta.reasoning_content) {
                  fullThinking += delta.reasoning_content;
                  send({ type: 'thinking', content: delta.reasoning_content });
                }
                if (delta.content) {
                  fullContent += delta.content;
                  send({ type: 'content', content: delta.content });
                }
                if (chunk.usage) send({ type: 'usage', usage: chunk.usage });
              } catch { /* skip malformed */ }
            }
          }

          if (fullContent) {
            history.push({ role: 'assistant', content: fullContent });
            if (history.length > 120) history = history.slice(-120);
            await sessionStore.set(sessionKey, history);
            // Update conversation index
            const convTitle = isNewConversation ? generateTitle(message || 'New chat') : '';
            await sessionStore.upsertConversation(userId, {
              id: sessionKey,
              title: convTitle || message?.slice(0, 50) || 'Chat',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messageCount: history.length,
              preview: message?.slice(0, 80) || '',
            });
            // Store memory (deduped)
            if (message?.length > 20) {
              const exists = await memoryManager.findSimilar(message);
              if (!exists) await memoryManager.store('conversation', `User: ${message}\nNova: ${fullContent.substring(0, 400)}`, 0.3);
            }
          }

          const duration = Date.now() - startTime;
          send({ type: 'done', sessionId: sessionKey, duration, messageCount: history.length, ragSources, ragUsed: ragSources.length > 0 });
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
  return new Response(JSON.stringify({ success: true, sessionId, messageCount: history.length }), { headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || 'default';
  const userId = searchParams.get('userId') || 'default';
  await sessionStore.deleteConversation(userId, sessionId);
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}
