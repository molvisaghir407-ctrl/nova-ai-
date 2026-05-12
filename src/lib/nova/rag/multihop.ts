import { quickComplete } from '@/lib/nova/providers/client';
import type { Source } from '@/types/nova.types';
import { runPipelineSearch } from './pipeline';
import { type RewriteResult } from './query-rewriter';

export interface HopResult {
  hop: number;
  query: string;
  sources: Source[];
  gaps: string[];
  reasoning: string;
}

export interface MultiHopResult {
  sources: Source[];
  hops: HopResult[];
  totalHops: number;
  gapQueries: string[];
}

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
- gaps: specific factual holes, not "more details"
- followUpQueries: exact search queries to fill gaps (2-3 max)
- isSufficient: true if sources already answer well
- If isSufficient is true, set gaps and followUpQueries to []
Output ONLY valid JSON. No markdown.`;

interface GapAnalysis {
  gaps: string[];
  followUpQueries: string[];
  isSufficient: boolean;
}

async function analyzeGaps(originalQuery: string, sourceSummaries: string): Promise<GapAnalysis> {
  const fallback: GapAnalysis = { gaps: [], followUpQueries: [], isSufficient: true };
  try {
    const prompt = `Original question: "${originalQuery}"\n\nSources found so far (summaries):\n${sourceSummaries.slice(0, 1500)}\n\nWhat key information is still missing?`;
    const raw = await quickComplete(
      [{ role: 'system', content: GAP_SYSTEM }, { role: 'user', content: prompt }],
      'fast',
      512,
    );
    const cleaned = raw.replace(/^\`\`\`json\s*/i, '').replace(/\`\`\`\s*$/, '').trim();
    return JSON.parse(cleaned) as GapAnalysis;
  } catch {
    return fallback;
  }
}

function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.url.split('?')[0]!;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeSources(sources: Source[]): string {
  return sources
    .slice(0, 8)
    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet?.slice(0, 150) ?? 'No snippet'}`)
    .join('\n');
}

export async function multiHopSearch(
  rewrite: RewriteResult,
  maxHops: 2 | 3 = 2,
  signal?: AbortSignal,
): Promise<MultiHopResult> {
  const hops: HopResult[] = [];
  const allSources: Source[] = [];
  const gapQueries: string[] = [];

  // HOP 1
  const hop1Sources = await runPipelineSearch(rewrite.rewrittenQuery, rewrite.expandedQueries, signal);
  allSources.push(...hop1Sources);

  const hop1: HopResult = { hop: 1, query: rewrite.rewrittenQuery, sources: hop1Sources, gaps: [], reasoning: '' };
  hops.push(hop1);

  if (signal?.aborted || hop1Sources.length === 0) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 1, gapQueries };
  }

  // GAP ANALYSIS 1
  const summary1 = summarizeSources(hop1Sources);
  const gap1 = await analyzeGaps(rewrite.originalQuery, summary1);

  hop1.gaps = gap1.gaps;
  hop1.reasoning = gap1.isSufficient
    ? 'Sources sufficient after hop 1.'
    : `Gaps identified: ${gap1.gaps.join('; ')}`;

  if (gap1.isSufficient || !gap1.followUpQueries.length) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 1, gapQueries };
  }

  // HOP 2
  gapQueries.push(...gap1.followUpQueries);
  const hop2Sources = (await Promise.all(gap1.followUpQueries.map((q) => runPipelineSearch(q, [], signal)))).flat();
  allSources.push(...hop2Sources);

  const hop2: HopResult = { hop: 2, query: gap1.followUpQueries.join(' | '), sources: hop2Sources, gaps: [], reasoning: '' };
  hops.push(hop2);

  if (maxHops < 3 || signal?.aborted) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 2, gapQueries };
  }

  // GAP ANALYSIS 2
  const summary2 = summarizeSources([...hop1Sources, ...hop2Sources]);
  const gap2 = await analyzeGaps(rewrite.originalQuery, summary2);

  hop2.gaps = gap2.gaps;
  hop2.reasoning = gap2.isSufficient
    ? 'Sources sufficient after hop 2.'
    : `Remaining gaps: ${gap2.gaps.join('; ')}`;

  if (gap2.isSufficient || !gap2.followUpQueries.length) {
    return { sources: deduplicateSources(allSources), hops, totalHops: 2, gapQueries };
  }

  gapQueries.push(...gap2.followUpQueries);
  const hop3Sources = (await Promise.all(gap2.followUpQueries.map((q) => runPipelineSearch(q, [], signal)))).flat();
  allSources.push(...hop3Sources);

  const hop3: HopResult = { hop: 3, query: gap2.followUpQueries.join(' | '), sources: hop3Sources, gaps: [], reasoning: 'Final synthesis hop complete.' };
  hops.push(hop3);

  return { sources: deduplicateSources(allSources), hops, totalHops: 3, gapQueries };
}
