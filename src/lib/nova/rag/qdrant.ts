/**
 * Nova Qdrant Vector Store
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides three collections:
 *   • nova_memory  – semantic user memory (dense + sparse)
 *   • nova_chunks  – indexed web content (3 named dense vectors + sparse)
 *   • nova_kg      – knowledge graph nodes (dense + payload graph)
 *
 * Hybrid search: combines dense cosine similarity with sparse BM25 (hashing
 * trick, 65 536-dim space) using Reciprocal Rank Fusion (RRF).
 *
 * All operations degrade gracefully when QDRANT_URL is not set — the
 * caller receives empty results rather than crashing.
 */

import { embed } from '@/lib/nova/nim/client';
import { NIM_MODELS } from '@/lib/nova/nim/models';

// ── Config ────────────────────────────────────────────────────────────────────
const QDRANT_URL  = (process.env.QDRANT_URL  ?? '').replace(/\/$/, '');
const QDRANT_KEY  = process.env.QDRANT_API_KEY ?? '';
const EMBED_MODEL = NIM_MODELS.NV_EMBED_V2;
const EMBED_DIMS  = 4096;

const COLLECTIONS = {
  MEMORY : 'nova_memory',
  CHUNKS : 'nova_chunks',
  KG     : 'nova_kg',
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SparseVector { indices: number[]; values: number[] }

export interface MemoryPoint {
  id        : string;
  content   : string;
  category  : string;
  importance: number;
  metadata ?: Record<string, unknown>;
  createdAt : string;
}

export interface ChunkPoint {
  id                  : string;
  text                : string;
  summary             : string;
  hypotheticalQuestion: string;   // primary HyDE question
  source              : string;
  domain              : string;
  fetchedAt           : string;
}

export interface KGNode {
  id       : string;
  name     : string;
  type     : 'person' | 'organization' | 'technology' | 'concept' | 'place' | 'event' | 'other';
  relations: Array<{ relationType: string; targetName: string; targetId: string }>;
  evidence : string[];
  updatedAt: string;
}

export interface SearchHit<T> { id: string; score: number; payload: T }

// ── Low-level REST client ─────────────────────────────────────────────────────
function isConfigured(): boolean { return !!QDRANT_URL && !!QDRANT_KEY; }

async function qFetch(
  path  : string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  body ?: unknown,
): Promise<Response> {
  return fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api-key'     : QDRANT_KEY,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function qGet<T>(path: string): Promise<T | null> {
  try {
    const r = await qFetch(path, 'GET');
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch { return null; }
}

async function qPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await qFetch(path, 'POST', body);
    if (!r.ok) { console.warn('Qdrant POST failed', path, await r.text()); return null; }
    return r.json() as Promise<T>;
  } catch (e) { console.warn('Qdrant error', e); return null; }
}

// ── BM25-style sparse vector (hashing trick) ──────────────────────────────────
const SPARSE_SPACE = 65536;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && t.length < 40);
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % SPARSE_SPACE;
}

export function buildSparse(text: string): SparseVector {
  const tokens = tokenize(text);
  const tf = new Map<number, number>();
  for (const t of tokens) {
    // bigrams too for better recall
    const unigram = djb2(t);
    tf.set(unigram, (tf.get(unigram) ?? 0) + 1);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = djb2(`${tokens[i]} ${tokens[i + 1]}`);
    tf.set(bigram, (tf.get(bigram) ?? 0) + 0.5);
  }
  const total = tokens.length || 1;
  const indices: number[] = [];
  const values : number[] = [];
  for (const [idx, cnt] of tf) {
    indices.push(idx);
    // sqrt-TF normalization (closer to BM25 saturation)
    values.push(Math.sqrt(cnt / total));
  }
  return { indices, values };
}

// ── RRF merger ────────────────────────────────────────────────────────────────
function rrf<T extends { id: string }>(
  denseHits: Array<{ id: string; score: number; payload: T }>,
  sparseHits: Array<{ id: string; score: number; payload: T }>,
  k = 60,
): Array<{ id: string; score: number; payload: T }> {
  const scores = new Map<string, number>();
  const payloads = new Map<string, T>();

  const rank = (hits: typeof denseHits) => {
    hits.forEach((h, i) => {
      scores.set(h.id, (scores.get(h.id) ?? 0) + 1 / (k + i + 1));
      payloads.set(h.id, h.payload);
    });
  };
  rank(denseHits);
  rank(sparseHits);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score, payload: payloads.get(id)! }));
}

// ── Collection bootstrap ──────────────────────────────────────────────────────
let _ensured = false;

export async function ensureCollections(): Promise<void> {
  if (_ensured || !isConfigured()) return;

  // Helper: create collection if it doesn't exist
  async function maybeCreate(name: string, body: unknown) {
    const exists = await qGet<{ result?: unknown }>(`/collections/${name}`);
    if (exists) return;
    await qFetch(`/collections/${name}`, 'PUT', body);
  }

  // nova_memory — dense + sparse
  await maybeCreate(COLLECTIONS.MEMORY, {
    vectors: { dense: { size: EMBED_DIMS, distance: 'Cosine' } },
    sparse_vectors: { sparse: {} },
    optimizers_config: { default_segment_number: 2 },
  });

  // nova_chunks — 3 named dense vectors + sparse
  await maybeCreate(COLLECTIONS.CHUNKS, {
    vectors: {
      chunk   : { size: EMBED_DIMS, distance: 'Cosine' },
      question: { size: EMBED_DIMS, distance: 'Cosine' },
      summary : { size: EMBED_DIMS, distance: 'Cosine' },
    },
    sparse_vectors: { sparse: {} },
    optimizers_config: { default_segment_number: 2 },
  });

  // nova_kg — entity dense + graph payload
  await maybeCreate(COLLECTIONS.KG, {
    vectors: { entity: { size: EMBED_DIMS, distance: 'Cosine' } },
    optimizers_config: { default_segment_number: 1 },
  });

  _ensured = true;
}

// ── Embedding helper (batched) ────────────────────────────────────────────────
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  try {
    return await embed(texts, EMBED_MODEL as Parameters<typeof embed>[1]);
  } catch {
    // fallback: zero vectors (graceful degrade)
    return texts.map(() => new Array(EMBED_DIMS).fill(0) as number[]);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MEMORY OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

export async function upsertMemory(point: MemoryPoint): Promise<void> {
  if (!isConfigured()) return;
  await ensureCollections();

  const [vec] = await getEmbeddings([point.content]);
  const sparse = buildSparse(point.content);

  await qPost(`/collections/${COLLECTIONS.MEMORY}/points`, {
    points: [{
      id     : point.id,
      vector : { dense: vec, sparse },
      payload: { ...point },
    }],
    wait: false,
  });
}

export async function searchMemory(
  query: string,
  topK = 5,
): Promise<SearchHit<MemoryPoint>[]> {
  if (!isConfigured()) return [];
  await ensureCollections();

  const [qVec] = await getEmbeddings([query]);
  const qSparse = buildSparse(query);

  // Parallel dense + sparse search
  const [denseRes, sparseRes] = await Promise.all([
    qPost<{ result: Array<{ id: string; score: number; payload: MemoryPoint }> }>(
      `/collections/${COLLECTIONS.MEMORY}/points/search`,
      { vector: { name: 'dense', vector: qVec }, limit: topK * 2, with_payload: true }
    ),
    qPost<{ result: Array<{ id: string; score: number; payload: MemoryPoint }> }>(
      `/collections/${COLLECTIONS.MEMORY}/points/search`,
      { vector: { name: 'sparse', vector: qSparse }, limit: topK * 2, with_payload: true }
    ),
  ]);

  const merged = rrf(
    denseRes?.result  ?? [],
    sparseRes?.result ?? [],
  );
  return merged.slice(0, topK);
}

export async function deleteMemory(id: string): Promise<void> {
  if (!isConfigured()) return;
  await qPost(`/collections/${COLLECTIONS.MEMORY}/points/delete`, {
    points: [id],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHUNK OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

export async function upsertChunks(
  chunks: ChunkPoint[],
): Promise<void> {
  if (!isConfigured() || !chunks.length) return;
  await ensureCollections();

  // Embed all three text types in parallel
  const [chunkVecs, questionVecs, summaryVecs] = await Promise.all([
    getEmbeddings(chunks.map(c => c.text)),
    getEmbeddings(chunks.map(c => c.hypotheticalQuestion)),
    getEmbeddings(chunks.map(c => c.summary)),
  ]);

  const points = chunks.map((c, i) => ({
    id    : c.id,
    vector: {
      chunk   : chunkVecs[i]!,
      question: questionVecs[i]!,
      summary : summaryVecs[i]!,
      sparse  : buildSparse(`${c.text} ${c.hypotheticalQuestion}`),
    },
    payload: { ...c },
  }));

  // Qdrant batch limit = 100 points
  for (let i = 0; i < points.length; i += 100) {
    await qPost(`/collections/${COLLECTIONS.CHUNKS}/points`, {
      points: points.slice(i, i + 100),
      wait  : false,
    });
  }
}

export async function searchChunks(
  query: string,
  topK = 8,
): Promise<SearchHit<ChunkPoint>[]> {
  if (!isConfigured()) return [];
  await ensureCollections();

  const [qVec] = await getEmbeddings([query]);
  const qSparse = buildSparse(query);

  // Search all four vector spaces, merge
  const [chunkRes, questionRes, summaryRes, sparseRes] = await Promise.all([
    qPost<{ result: Array<{ id: string; score: number; payload: ChunkPoint }> }>(
      `/collections/${COLLECTIONS.CHUNKS}/points/search`,
      { vector: { name: 'chunk', vector: qVec }, limit: topK * 2, with_payload: true }
    ),
    qPost<{ result: Array<{ id: string; score: number; payload: ChunkPoint }> }>(
      `/collections/${COLLECTIONS.CHUNKS}/points/search`,
      { vector: { name: 'question', vector: qVec }, limit: topK * 2, with_payload: true }
    ),
    qPost<{ result: Array<{ id: string; score: number; payload: ChunkPoint }> }>(
      `/collections/${COLLECTIONS.CHUNKS}/points/search`,
      { vector: { name: 'summary', vector: qVec }, limit: topK * 2, with_payload: true }
    ),
    qPost<{ result: Array<{ id: string; score: number; payload: ChunkPoint }> }>(
      `/collections/${COLLECTIONS.CHUNKS}/points/search`,
      { vector: { name: 'sparse', vector: qSparse }, limit: topK * 2, with_payload: true }
    ),
  ]);

  // Weighted RRF: chunk=1x, question=0.8x (HyDE boost), summary=0.6x, sparse=0.7x
  const allHits = [
    ...(chunkRes?.result    ?? []).map(h => ({ ...h, score: h.score * 1.0 })),
    ...(questionRes?.result ?? []).map(h => ({ ...h, score: h.score * 0.8 })),
    ...(summaryRes?.result  ?? []).map(h => ({ ...h, score: h.score * 0.6 })),
    ...(sparseRes?.result   ?? []).map(h => ({ ...h, score: h.score * 0.7 })),
  ];

  const scoreMap = new Map<string, number>();
  const payMap   = new Map<string, ChunkPoint>();
  allHits.forEach(h => {
    scoreMap.set(h.id, (scoreMap.get(h.id) ?? 0) + h.score);
    payMap.set(h.id, h.payload);
  });

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, score]) => ({ id, score, payload: payMap.get(id)! }));
}

// ════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

export async function upsertKGNodes(nodes: KGNode[]): Promise<void> {
  if (!isConfigured() || !nodes.length) return;
  await ensureCollections();

  const texts = nodes.map(n =>
    `${n.name} (${n.type}): ${n.evidence.slice(0, 2).join('. ')}`
  );
  const vecs = await getEmbeddings(texts);

  const points = nodes.map((n, i) => ({
    id    : n.id,
    vector: { entity: vecs[i]! },
    payload: { ...n },
  }));

  for (let i = 0; i < points.length; i += 100) {
    await qPost(`/collections/${COLLECTIONS.KG}/points`, {
      points: points.slice(i, i + 100),
      wait  : false,
    });
  }
}

export async function searchKG(
  query: string,
  topK = 6,
): Promise<SearchHit<KGNode>[]> {
  if (!isConfigured()) return [];
  await ensureCollections();

  const [qVec] = await getEmbeddings([query]);
  const res = await qPost<{ result: Array<{ id: string; score: number; payload: KGNode }> }>(
    `/collections/${COLLECTIONS.KG}/points/search`,
    { vector: { name: 'entity', vector: qVec }, limit: topK, with_payload: true },
  );
  return res?.result ?? [];
}
