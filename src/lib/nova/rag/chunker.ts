/**
 * Nova Semantic Chunker + HyDE Generator
 * ─────────────────────────────────────────────────────────────────────────────
 * Instead of fixed 512-token windows, this module:
 *
 *  1. SEMANTIC CHUNKING
 *     • Splits text on paragraph boundaries (double newlines)
 *     • Merges short adjacent chunks until they reach a target size
 *     • Splits oversized chunks at sentence boundaries
 *     • Result: coherent, semantically complete units of ~200–600 words
 *
 *  2. HyDE (Hypothetical Document Embeddings)
 *     • For each chunk, generates:
 *         – A concise 1-sentence summary  → stored as `summary` vector
 *         – 2 hypothetical questions the chunk answers → stored as `question` vectors
 *     • This dramatically improves retrieval because users often phrase
 *       queries as questions, which now match the question vectors directly
 *
 *  3. BATCH PROCESSING
 *     • All LLM calls are batched (one call per N chunks) to minimize latency
 *     • Falls back gracefully if LLM is unavailable
 */

import { quickChat } from '@/lib/nova/nim/client';
import { NIM_MODELS } from '@/lib/nova/nim/models';

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET_WORDS = 300;   // target chunk size in words
const MIN_WORDS    = 80;    // below this → merge with next
const MAX_WORDS    = 600;   // above this → split at sentence boundary

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SemanticChunk {
  id                  : string;
  text                : string;
  summary             : string;
  hypotheticalQuestion: string;   // best HyDE question
  allQuestions        : string[]; // all generated questions
  source              : string;
  domain              : string;
  wordCount           : number;
  chunkIndex          : number;
}

// ── Text splitting ────────────────────────────────────────────────────────────
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Split on double newlines and filter empty paragraphs */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 30);
}

/** Split a long paragraph at sentence boundaries */
function splitAtSentences(text: string, maxWords: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const combined = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (wordCount(combined) > maxWords && current) {
      chunks.push(current.trim());
      current = sentence.trim();
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

/** Semantic chunking: merge small, split large */
function buildChunks(text: string): string[] {
  const paragraphs = splitParagraphs(text);
  const merged: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    const wc = wordCount(para);

    if (wc > MAX_WORDS) {
      // Flush buffer first, then split the big paragraph
      if (buffer) { merged.push(buffer.trim()); buffer = ''; }
      merged.push(...splitAtSentences(para, MAX_WORDS));
    } else if (wordCount(buffer) + wc < TARGET_WORDS) {
      // Merge into buffer
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      // Buffer is full
      if (buffer) merged.push(buffer.trim());
      buffer = para;
    }
  }
  if (buffer.trim()) merged.push(buffer.trim());

  return merged.filter(c => wordCount(c) >= MIN_WORDS / 2);
}

// ── HyDE generation ───────────────────────────────────────────────────────────
const HYDE_SYSTEM = `You are a document analysis assistant. 
For the given text chunk, output ONLY a JSON object:
{
  "summary": "one sentence summary of this chunk's core information",
  "questions": ["question 1 this chunk answers", "question 2 this chunk answers"]
}
Rules:
- summary: factual, informative, no filler ("This chunk discusses...")
- questions: write them as a real user might type them in a search engine
- questions: make them specific, not generic ("what is X" is too vague)
Output ONLY valid JSON. No markdown, no explanation.`;

interface HyDEOutput { summary: string; questions: string[] }

/** Generate HyDE metadata for a batch of chunks in one LLM call */
async function generateHyDEBatch(
  chunks: string[],
): Promise<HyDEOutput[]> {
  const fallback = (c: string): HyDEOutput => ({
    summary  : c.slice(0, 120).trim() + '…',
    questions: [c.slice(0, 80).trim() + '?'],
  });

  try {
    // Process up to 4 chunks per LLM call to stay within token limits
    const BATCH = 4;
    const results: HyDEOutput[] = [];

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const prompt = batch
        .map((c, idx) => `CHUNK ${idx + 1}:\n${c.slice(0, 800)}`)
        .join('\n\n---\n\n');

      const systemForBatch = batch.length > 1
        ? `You are a document analysis assistant.
For each numbered CHUNK, output a JSON array with one object per chunk:
[
  {"summary": "...", "questions": ["...", "..."]},
  ...
]
Rules:
- summary: one factual sentence
- questions: 2 specific questions a user might search for that this chunk answers
Output ONLY the JSON array.`
        : HYDE_SYSTEM;

      const raw = await quickChat(
        [{ role: 'user', content: prompt }],
        NIM_MODELS.LLAMA_FAST,
        512,
      );

      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (batch.length > 1 && Array.isArray(parsed)) {
        results.push(...(parsed as HyDEOutput[]).slice(0, batch.length));
      } else if (batch.length === 1 && parsed && typeof parsed === 'object') {
        results.push(parsed as HyDEOutput);
      } else {
        results.push(...batch.map(fallback));
      }
    }

    return results;
  } catch {
    return chunks.map(fallback);
  }
}

// ── Simple ID generation ──────────────────────────────────────────────────────
function chunkId(source: string, index: number, text: string): string {
  const hash = [...`${source}${index}${text.slice(0, 40)}`]
    .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return `chunk_${Math.abs(hash).toString(36)}_${index}`;
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Semantically chunk a piece of text and enrich each chunk with
 * HyDE metadata (summary + hypothetical questions).
 *
 * @param text   The raw page/article text
 * @param source The canonical URL or identifier of the source
 */
export async function semanticChunk(
  text  : string,
  source: string,
): Promise<SemanticChunk[]> {
  const domain = domainOf(source);

  // 1. Build raw chunks
  const rawChunks = buildChunks(text);
  if (!rawChunks.length) return [];

  // 2. Generate HyDE metadata in batches
  const hydes = await generateHyDEBatch(rawChunks);

  // 3. Assemble final chunk objects
  return rawChunks.map((text, i) => {
    const hyde = hydes[i] ?? { summary: text.slice(0, 100), questions: [text.slice(0, 80) + '?'] };
    return {
      id                  : chunkId(source, i, text),
      text,
      summary             : hyde.summary,
      hypotheticalQuestion: hyde.questions[0] ?? '',
      allQuestions        : hyde.questions,
      source,
      domain,
      wordCount           : wordCount(text),
      chunkIndex          : i,
    };
  });
}

/**
 * Quick single-chunk wrapper — useful for indexing short snippets.
 */
export async function chunkAndEnrich(
  text  : string,
  source: string,
): Promise<SemanticChunk[]> {
  return semanticChunk(text.slice(0, 12000), source);
}
