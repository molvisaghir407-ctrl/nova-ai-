import type { QueryIntent } from '@/types/nova.types';

const INTENT_PATTERNS: Array<{ intent: QueryIntent; patterns: RegExp[] }> = [
  { intent: 'weather', patterns: [/\b(weather|temperature|rain|snow|forecast|humidity|wind)\b/i] },
  { intent: 'finance', patterns: [/\b(stock|price|market|crypto|bitcoin|etf|nasdaq|nyse|earnings|revenue)\b/i] },
  { intent: 'news', patterns: [/\b(latest|breaking|today|this week|just|recently|2025|2026|current|live|right now|score|standings)\b/i] },
  { intent: 'code', patterns: [/```|`[^`]+`|\b(function|class|import|const|let|var|def |fn |async |await |npm|pip|cargo)\b/i] },
  { intent: 'math', patterns: [/\b(solve|calculate|integral|derivative|proof|equation|formula|theorem|matrix)\b/i, /[=+\-*\/^∫∑∏]/] },
  { intent: 'medical', patterns: [/\b(symptom|diagnosis|medication|treatment|disease|doctor|hospital|health)\b/i] },
  { intent: 'factual', patterns: [/^(who|what|when|where|which|how many|how much)\b/i] },
  { intent: 'conversational', patterns: [/^(hi|hello|hey|thanks|thank you|ok|sure|bye|great|nice|cool|lol|haha|what's up|sup)\b/i] },
  { intent: 'creative', patterns: [/\b(write a|create a|generate a|make a|compose|poem|story|essay|song|haiku)\b/i] },
];

// Intents that ALWAYS need real-time data regardless of query length
const ALWAYS_RAG_INTENTS: QueryIntent[] = ['weather', 'finance', 'news'];

// Intents that NEVER need RAG
const NEVER_RAG_INTENTS: QueryIntent[] = ['conversational', 'creative', 'math'];

export function classifyIntent(message: string): QueryIntent {
  const lower = message.toLowerCase().trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(lower))) return intent;
  }
  return 'general';
}

/**
 * Smart RAG decision: like Grok
 * - Short conversational/creative/math queries → API only (fast)
 * - News/weather/finance → always RAG (needs live data)
 * - Long queries (>150 chars) → RAG (complex research questions)
 * - Short factual/code/general (<150 chars) → API only (model knows this)
 */
export function shouldUseRAG(intent: QueryIntent, messageLength = 0, ragThreshold = 150): boolean {
  if (NEVER_RAG_INTENTS.includes(intent)) return false;
  if (ALWAYS_RAG_INTENTS.includes(intent)) return true;
  // For other intents: use RAG only for longer/complex queries
  return messageLength >= ragThreshold;
}

export function decomposeQuery(message: string, intent: QueryIntent): string[] {
  if (message.length < 100 || NEVER_RAG_INTENTS.includes(intent)) return [message];
  const cleaned = message.replace(/\?/g, '').trim();
  const compMatch = cleaned.match(/(.+?)\s+(?:vs\.?|versus|compared? to|and)\s+(.+)/i);
  if (compMatch?.[1] && compMatch?.[2]) {
    return [compMatch[1].trim(), compMatch[2].trim(), cleaned].slice(0, 3);
  }
  return [cleaned];
}
