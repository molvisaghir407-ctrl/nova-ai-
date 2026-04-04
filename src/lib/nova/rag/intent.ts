import type { QueryIntent } from '@/types/nova.types';

const INTENT_PATTERNS: Array<{ intent: QueryIntent; patterns: RegExp[] }> = [
  { intent: 'weather', patterns: [/\b(weather|temperature|rain|snow|forecast|humidity|wind)\b/i] },
  { intent: 'finance', patterns: [/\b(stock|price|market|crypto|bitcoin|etf|nasdaq|nyse|earnings|revenue)\b/i] },
  { intent: 'news', patterns: [/\b(latest|breaking|today|this week|just|recently|2025|2026|current|live)\b/i] },
  { intent: 'code', patterns: [/```|`[^`]+`|\b(function|class|import|const|let|var|def |fn |async |await |npm|pip|cargo)\b/i] },
  { intent: 'math', patterns: [/\b(solve|calculate|integral|derivative|proof|equation|formula|theorem|matrix)\b/i, /[=+\-*\/^∫∑∏]/] },
  { intent: 'medical', patterns: [/\b(symptom|diagnosis|medication|treatment|disease|doctor|hospital|health)\b/i] },
  { intent: 'factual', patterns: [/^(who|what|when|where|which|how many|how much)\b/i] },
  { intent: 'conversational', patterns: [/^(hi|hello|hey|thanks|thank you|ok|sure|bye|great|nice|cool|lol|haha)\b/i] },
  { intent: 'creative', patterns: [/\b(write a|create a|generate a|make a|compose|poem|story|essay|song)\b/i] },
];

export function classifyIntent(message: string): QueryIntent {
  const lower = message.toLowerCase().trim();

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(lower))) return intent;
  }

  return 'general';
}

export function shouldUseRAG(intent: QueryIntent): boolean {
  return !['conversational', 'creative', 'math'].includes(intent);
}

// Decompose a complex query into focused sub-queries
export function decomposeQuery(message: string, intent: QueryIntent): string[] {
  // For simple queries, just use as-is
  if (message.length < 100 || intent === 'conversational' || intent === 'creative') {
    return [message];
  }

  // Split on "and", "vs", comparison words
  const parts: string[] = [];
  const cleaned = message.replace(/\?/g, '').trim();

  // Check for comparison pattern
  const compMatch = cleaned.match(/(.+?)\s+(?:vs\.?|versus|compared? to|and)\s+(.+)/i);
  if (compMatch?.[1] && compMatch?.[2]) {
    parts.push(compMatch[1].trim());
    parts.push(compMatch[2].trim());
    parts.push(cleaned); // also search full query
    return parts.slice(0, 3);
  }

  return [cleaned];
}
