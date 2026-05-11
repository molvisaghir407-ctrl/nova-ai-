/**
 * Nova Inngest Background Functions
 * New API: createFunction({ id, triggers: { event } }, handler)
 */

import { inngest } from './client';
import { semanticChunk } from '@/lib/nova/rag/chunker';
import { upsertChunks, type ChunkPoint } from '@/lib/nova/rag/qdrant';
import { semanticMemory } from '@/lib/nova/memory';
import { indexTextIntoKG } from '@/lib/nova/rag/kg';
import { quickChat } from '@/lib/nova/nim/client';
import { NIM_MODELS } from '@/lib/nova/nim/models';

// ── 1. Content Indexing ───────────────────────────────────────────────────────
export const indexContentFn = inngest.createFunction(
  {
    id      : 'nova-index-content',
    name    : 'Index Web Content into Vector Store',
    retries : 3,
    triggers: [{ event: 'nova/content.index' }],
    concurrency: { limit: 2 },
  },
  async ({ event, step }: {
    event: { data: { sources: Array<{ url: string; text: string; domain: string }> } };
    step : { run<T>(id: string, fn: () => Promise<T>): Promise<T> };
  }) => {
    const { sources } = event.data;

    const chunkResults = await step.run('semantic-chunk-sources', async () => {
      const allChunks: ChunkPoint[] = [];
      for (const src of sources.slice(0, 8)) {
        if (!src.text || src.text.length < 100) continue;
        const chunks = await semanticChunk(src.text, src.url).catch(() => []);
        for (const c of chunks) {
          allChunks.push({
            id                  : c.id,
            text                : c.text,
            summary             : c.summary,
            hypotheticalQuestion: c.hypotheticalQuestion,
            source              : c.source,
            domain              : c.domain,
            fetchedAt           : new Date().toISOString(),
          });
        }
      }
      return allChunks;
    });

    await step.run('upsert-to-qdrant', async () => {
      if (chunkResults.length) await upsertChunks(chunkResults);
      return { indexed: chunkResults.length };
    });

    return { status: 'ok', chunksIndexed: chunkResults.length };
  },
);

// ── 2. Memory Consolidation ───────────────────────────────────────────────────
export const consolidateMemoryFn = inngest.createFunction(
  {
    id      : 'nova-memory-consolidate',
    name    : 'Consolidate Conversation into Semantic Memory',
    retries : 2,
    triggers: [{ event: 'nova/memory.consolidate' }],
  },
  async ({ event, step }: {
    event: { data: { userId: string; messages: Array<{ role: string; content: string }> } };
    step : { run<T>(id: string, fn: () => Promise<T>): Promise<T> };
  }) => {
    const { messages } = event.data;
    if (!messages.length) return { status: 'skipped' };

    const extracted = await step.run('extract-facts', async () => {
      const conv = messages
        .slice(-10)
        .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`)
        .join('\n\n');

      const raw = await quickChat(
        [{
          role   : 'user',
          content: `Extract memorable facts/preferences from this conversation.\nOutput ONLY a JSON array: [{"content":"...","category":"fact|preference|skill|note","importance":0.0-1.0}]\n\n${conv}`,
        }],
        NIM_MODELS.LLAMA_FAST,
        400,
      );

      try {
        const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        return JSON.parse(clean) as Array<{
          content   : string;
          category  : 'fact' | 'preference' | 'skill' | 'note';
          importance: number;
        }>;
      } catch { return []; }
    });

    await step.run('store-memories', async () => {
      for (const item of extracted.slice(0, 5)) {
        await semanticMemory.remember(item.content, item.category, item.importance);
      }
      return { stored: extracted.length };
    });

    return { status: 'ok', memoriesStored: extracted.length };
  },
);

// ── 3. Knowledge Graph Update ─────────────────────────────────────────────────
export const updateKGFn = inngest.createFunction(
  {
    id      : 'nova-kg-update',
    name    : 'Update Knowledge Graph from Fetched Content',
    retries : 2,
    triggers: [{ event: 'nova/kg.update' }],
    concurrency: { limit: 1 },
  },
  async ({ event, step }: {
    event: { data: { texts: string[]; sessionId: string } };
    step : { run<T>(id: string, fn: () => Promise<T>): Promise<T> };
  }) => {
    const { texts } = event.data;
    if (!texts.length) return { status: 'skipped' };

    await step.run('extract-and-index-entities', async () => {
      await indexTextIntoKG(texts.slice(0, 4));
    });

    return { status: 'ok', textsProcessed: Math.min(texts.length, 4) };
  },
);

export const ALL_FUNCTIONS = [indexContentFn, consolidateMemoryFn, updateKGFn];
