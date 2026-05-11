/**
 * Nova Multi-Hop Reasoning Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Instead of a single retrieval pass, this module orchestrates 2–3 sequential
 * search hops where each hop's results inform the next query.
 *
 * Algorithm:
 *   HOP 1  Initial search with rewritten query → gather primary sources
 *   GAP ANALYSIS  Fast LLM call: "What key information is still missing?"
 *   HOP 2  Targeted follow-up searches for each identified gap
 *   HOP 3  (research queries only) Final synthesis search
 *
 * This dramatically improves answer quality for:
 *   • Multi-entity comparison questions  ("X vs Y vs Z")
 *   • Causal chains  ("Why did X cause Y?")
 *   • Temporal sequences  ("What happened after X?")
 *   • Technical deep-dives that need multiple source types
 */

import { quickChat } from '@/lib/nova/nim/client';
import { NIM_MODELS } from '@/lib/nova/nim/models';
import type { Source } from '@/types/nova.types';
import { runPipelineSearch } from './pipeline';
import { type RewriteResult } from './query-rewriter';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface HopResult {
  hop      : number;
  query    : string;
  sources  : Source[];
  gaps     : string[];   // identified gaps to fill in next hop
  reasoning: string;     // LLM's gap analysis
}

export interface MultiHopResult {
  sources     : Source[];          // deduplicated, merged from all hops
  hops        : HopResult[];
  totalHops   : number;
  gapQueries  : string[];
}

// ── Gap analysis ──────────────────────────────────────────────────────────────
const GAP_SYSTEM = `You are a research gap analyst.
Given a user question and the summaries of sources found so far,
identify what KEY information is still MISSING or UNCLEAR.
Output ONLY a JSON object:
{
  "gaps": ["concise gap 1 (max 10 words)", "concise gap 2", "concise gap 3"],
  "followUpQueries": ["specific web search query 1", "specific web search query 2"],
  "isSufficient": false
}
Rules:
- gaps: specific factual holes, not "more details" (too vague)
- followUpQueries: exact search queries to fill the gaps (2–3 max)
- isSufficient: true if the sources already answer the question well
- If isSufficient is true, set gaps and followUpQueries to []
Output ONLY valid JSON. No markdown.`;

interface GapAnalysis {
  gaps           : string[];
  followUpQueries: string[];
  isSufficient   : boolean;
}

async function analyzeGaps(
  originalQuery: string,
  sourceSummaries: string,
): Promise<GapAnalysis> {
  const fallback: GapAnalysis = {
    gaps           : [],
    followUpQueries: [],
    isSufficient   : true,
  };

  try {
    const prompt = `Original question: "${originalQuery}"

Sources found so far (summaries):
${sourceSummaries.slice(0, 1500)}

What key information is still missing?`;

    const raw = await quickChat(
      [{ role: 'user', content: prompt }],
      NIM_MODELS.LLAMA_FAST,
      300,
      AbortSignal.timeout(6000),
    );

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    return JSON.parse(cleaned) as GapAnalysis;
  } catch {
    return fallback;
  }
}

// ── Source deduplication ──────────────────────────────────────────────────────
function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter(s => {
    const key = s.url.split('?')[0]!; // strip query params
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeSources(sources: Source[]): string {
  return sources
    .slice(0, 8)
    .map((s, i) =>
      `[${i + 1}] ${s.title}: ${s.snippet?.slice(0, 150) ?? 'No snippet'}`
    )
    .join('\n');
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
/**
 * Run a multi-hop search for the given query.
 *
 * @param rewrite  Output from query-rewriter (provides all query variants)
 * @param maxHops  2 for standard queries, 3 for 'research' complexity
 * @param signal   Optional AbortSignal for timeout
 */
export async function multiHopSearch(
  rewrite : RewriteResult,
  maxHops : 2 | 3 = 2,
  signal ?: AbortSignal,
): Promise<MultiHopResult> {
  const hops        : HopResult[] = [];
  const allSources  : Source[]    = [];
  const gapQueries  : string[]    = [];

  // ── HOP 1 ── Primary search with rewritten query ──────────────────────────
  const hop1Sources = await runPipelineSearch(
    rewrite.rewrittenQuery,
    rewrite.expandedQueries,
    signal,
  );
  allSources.push(...hop1Sources);

  const hop1: HopResult = {
    hop     : 1,
    query   : rewrite.rewrittenQuery,
    sources : hop1Sources,
    gaps    : [],
    reasoning: '',
  };
  hops.push(hop1);

  if (signal?.aborted || hop1Sources.length === 0) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 1, gapQueries };
  }

  // ── GAP ANALYSIS after hop 1 ──────────────────────────────────────────────
  const summary1 = summarizeSources(hop1Sources);
  const gap1 = await analyzeGaps(rewrite.originalQuery, summary1);

  hop1.gaps      = gap1.gaps;
  hop1.reasoning = gap1.isSufficient
    ? 'Sources sufficient after hop 1.'
    : `Gaps identified: ${gap1.gaps.join('; ')}`;

  if (gap1.isSufficient || !gap1.followUpQueries.length) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 1, gapQueries };
  }

  // ── HOP 2 ── Follow-up searches for identified gaps ───────────────────────
  gapQueries.push(...gap1.followUpQueries);

  const hop2Sources = (
    await Promise.all(
      gap1.followUpQueries.map(q => runPipelineSearch(q, [], signal))
    )
  ).flat();

  allSources.push(...hop2Sources);

  const hop2: HopResult = {
    hop     : 2,
    query   : gap1.followUpQueries.join(' | '),
    sources : hop2Sources,
    gaps    : [],
    reasoning: '',
  };
  hops.push(hop2);

  if (maxHops < 3 || signal?.aborted) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 2, gapQueries };
  }

  // ── HOP 3 ── Deep research: synthesize gaps from hop 2 ────────────────────
  const summary2 = summarizeSources([...hop1Sources, ...hop2Sources]);
  const gap2 = await analyzeGaps(rewrite.originalQuery, summary2);

  hop2.gaps      = gap2.gaps;
  hop2.reasoning = gap2.isSufficient
    ? 'Sources sufficient after hop 2.'
    : `Remaining gaps: ${gap2.gaps.join('; ')}`;

  if (gap2.isSufficient || !gap2.followUpQueries.length) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 2, gapQueries };
  }

  gapQueries.push(...gap2.followUpQueries);

  const hop3Sources = (
    await Promise.all(
      gap2.followUpQueries.map(q => runPipelineSearch(q, [], signal))
    )
  ).flat();

  allSources.push(...hop3Sources);

  const hop3: HopResult = {
    hop     : 3,
    query   : gap2.followUpQueries.join(' | '),
    sources : hop3Sources,
    gaps    : [],
    reasoning: 'Final synthesis hop complete.',
  };
  hops.push(hop3);

  return {
    sources   : deduplicateSources(allSources),
    hops,
    totalHops : 3,
    gapQueries,
  };
}
