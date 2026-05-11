/**
 * Nova Query Rewriter
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses a small, fast LLM (Llama 4 Maverick) to:
 *   1. Rewrite the query for better retrieval precision
 *   2. Generate 2–3 alternative phrasings (query expansion)
 *   3. Extract key named entities
 *   4. Classify search intent
 *
 * This runs BEFORE the web search / vector search so that downstream
 * retrieval operates on a richer, disambiguated representation of
 * what the user actually needs.
 */

import { quickChat } from '@/lib/nova/nim/client';
import { NIM_MODELS } from '@/lib/nova/nim/models';

export interface RewriteResult {
  originalQuery      : string;
  rewrittenQuery     : string;       // single best rewrite
  expandedQueries    : string[];     // 2–3 alternative phrasings
  extractedEntities  : string[];     // named entities / key terms
  searchIntent       : 'factual' | 'comparative' | 'howto' | 'exploratory' | 'news';
  isConversational   : boolean;      // "thanks", "hello", etc. → skip RAG
  hypotheticalAnswer : string;       // HyDE: a short plausible answer
}

const REWRITE_SYSTEM = `You are a search query optimization expert.
Given a user query, output ONLY a JSON object with exactly these fields:
{
  "rewrittenQuery": "single best rewrite for web search (concise, specific)",
  "expandedQueries": ["alt phrasing 1", "alt phrasing 2", "alt phrasing 3"],
  "extractedEntities": ["entity1", "entity2"],
  "searchIntent": "factual|comparative|howto|exploratory|news",
  "isConversational": false,
  "hypotheticalAnswer": "a 1–2 sentence plausible answer to seed vector search"
}
Rules:
- rewrittenQuery: remove filler words, resolve pronouns from context, add specificity
- expandedQueries: vary vocabulary and structure; include synonyms and related angles
- extractedEntities: proper nouns, product names, technical terms, acronyms (max 6)
- searchIntent: factual=specific fact lookup, comparative=A vs B, howto=instructions, exploratory=open-ended, news=recent events
- isConversational: true only for greetings/thanks/casual chat with NO information need
- hypotheticalAnswer: imagine a perfect answer and summarize it in 1–2 sentences
Output ONLY the JSON. No explanation, no markdown.`;

/** Cache last rewrite to avoid duplicate LLM calls within the same pipeline run */
const _cache = new Map<string, RewriteResult>();

export async function rewriteQuery(
  query: string,
  conversationContext = '',
): Promise<RewriteResult> {
  const cacheKey = query.slice(0, 120);
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!;

  const fallback: RewriteResult = {
    originalQuery    : query,
    rewrittenQuery   : query,
    expandedQueries  : [query],
    extractedEntities: [],
    searchIntent     : 'exploratory',
    isConversational : false,
    hypotheticalAnswer: '',
  };

  try {
    const contextSnippet = conversationContext
      ? `\nConversation context (last 2 exchanges):\n${conversationContext.slice(0, 400)}`
      : '';

    const userMsg = `User query: "${query}"${contextSnippet}`;

    const raw = await quickChat(
      [{ role: 'user', content: userMsg }],
      NIM_MODELS.LLAMA_FAST,   // fast model — Llama 4 Maverick
      512,
    );

    // Strip possible markdown fences
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<RewriteResult>;

    const result: RewriteResult = {
      originalQuery    : query,
      rewrittenQuery   : parsed.rewrittenQuery   ?? query,
      expandedQueries  : parsed.expandedQueries  ?? [query],
      extractedEntities: parsed.extractedEntities ?? [],
      searchIntent     : parsed.searchIntent      ?? 'exploratory',
      isConversational : parsed.isConversational  ?? false,
      hypotheticalAnswer: parsed.hypotheticalAnswer ?? '',
    };

    _cache.set(cacheKey, result);
    // Evict cache if it grows too large (shouldn't in serverless, but safety)
    if (_cache.size > 50) _cache.delete(_cache.keys().next().value!);

    return result;
  } catch {
    // LLM / parse failure → return sensible fallback
    return fallback;
  }
}

/**
 * Build a deduped list of all queries to run in parallel:
 * [rewrittenQuery, ...expandedQueries] deduplicated.
 */
export function allQueries(rw: RewriteResult): string[] {
  const seen = new Set<string>();
  return [rw.rewrittenQuery, ...rw.expandedQueries, rw.originalQuery]
    .filter(q => {
      const key = q.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return q.trim().length > 2;
    });
}
