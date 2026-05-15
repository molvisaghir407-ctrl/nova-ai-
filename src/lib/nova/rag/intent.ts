import type { QueryIntent } from '@/types/nova.types';

// ── Extended intent patterns (order matters — first match wins) ───────────────
const INTENT_PATTERNS: Array<{ intent: QueryIntent; patterns: RegExp[] }> = [
  // ── ALWAYS-RAG (live / real-time data) ──────────────────────────────────
  {
    intent: 'weather',
    patterns: [/\b(weather|temperature|rain|snow|forecast|humidity|wind speed|feels like|air quality|uv index|storm|thunder)\b/i],
  },
  {
    intent: 'finance',
    patterns: [/\b(stock|share price|market cap|crypto|bitcoin|ethereum|btc|eth|nasdaq|nyse|s&p|dow jones|earnings|revenue|ipo|dividend|forex|exchange rate|gold price|oil price)\b/i],
  },
  {
    intent: 'news',
    patterns: [/\b(latest|breaking|today|this week|this month|just announced|recently|2024|2025|2026|current|live|right now|score|standings|headline|update|happening|trending)\b/i],
  },
  {
    intent: 'sports',
    patterns: [/\b(score|match|game|tournament|championship|league|nba|nfl|premier league|fifa|ipl|cricket|tennis|formula 1|f1|player stats|transfer|squad)\b/i],
  },

  // ── DOMAIN-SPECIFIC ─────────────────────────────────────────────────────
  {
    intent: 'code',
    patterns: [
      /```|`[^`]+`/,
      /\b(function|class|import|const|let|var|def |fn |async |await|npm|pip|cargo|brew|apt|docker|kubernetes|typescript|javascript|python|rust|golang|java|kotlin|swift|sql|graphql|api|endpoint|rest|webhook|sdk)\b/i,
      /\b(bug|error|exception|crash|stack trace|debug|deploy|build|compile|lint|test|ci|cd)\b/i,
    ],
  },
  {
    intent: 'math',
    patterns: [
      /\b(solve|calculate|integral|derivative|proof|equation|formula|theorem|matrix|vector|calculus|algebra|geometry|probability|statistics|mean|median|variance|factorial|prime|fibonacci)\b/i,
      /[=∫∑∏√±≤≥≠∞∈∅∩∪∂∇]/,
      /\d+\s*[\+\-\*\/\^]\s*\d+/,
    ],
  },
  {
    intent: 'science',
    patterns: [/\b(physics|chemistry|biology|genetics|quantum|relativity|thermodynamics|evolution|dna|rna|protein|atom|molecule|element|periodic table|astronomy|astrophysics|geology|ecology|neuroscience|immunology)\b/i],
  },
  {
    intent: 'medical',
    patterns: [/\b(symptom|diagnosis|medication|treatment|disease|syndrome|disorder|doctor|hospital|surgery|therapy|clinical|pharmaceutical|vaccine|cancer|diabetes|hypertension|depression|anxiety|dosage|side effect)\b/i],
  },
  {
    intent: 'legal',
    patterns: [/\b(law|legal|court|lawsuit|contract|liability|regulation|compliance|patent|copyright|trademark|gdpr|terms of service|privacy policy|jurisdiction|statute|precedent)\b/i],
  },
  {
    intent: 'history',
    patterns: [/\b(history|historical|ancient|medieval|century|war|revolution|empire|civilization|dynasty|timeline|era|decade|founded|origin|invention|discovery)\b/i],
  },
  {
    intent: 'geography',
    patterns: [/\b(country|capital|city|continent|population|area|border|region|geography|map|location|coordinates|distance|timezone|language|currency of)\b/i],
  },

  // ── QUERY TYPE ───────────────────────────────────────────────────────────
  {
    intent: 'comparison',
    patterns: [/\b(vs\.?|versus|compared? to|difference between|better than|pros and cons|advantages|disadvantages|which is|which should)\b/i],
  },
  {
    intent: 'howto',
    patterns: [/^how (to|do|does|can|should|would)\b/i, /\b(step by step|tutorial|guide|instructions|walkthrough|setup|install|configure)\b/i],
  },
  {
    intent: 'factual',
    patterns: [/^(who|what|when|where|which|how many|how much|is it true|define|meaning of|what is|what are)\b/i],
  },
  {
    intent: 'conversational',
    patterns: [/^(hi|hello|hey|thanks|thank you|ok|sure|bye|great|nice|cool|lol|haha|what'?s up|sup|yo|morning|evening|night|good day)\b/i],
  },
  {
    intent: 'creative',
    patterns: [/\b(write a|create a|generate a|make a|compose|poem|story|essay|song|haiku|script|creative|fiction|narrative|draft|brainstorm)\b/i],
  },
];

// ── Intents that NEVER need RAG ──────────────────────────────────────────────
// Only pure math and short greetings skip RAG entirely
const NEVER_RAG_INTENTS: QueryIntent[] = ['conversational'];

// ── Intents that ALWAYS need real-time data ──────────────────────────────────
const ALWAYS_RAG_INTENTS: QueryIntent[] = ['weather', 'finance', 'news', 'sports'];

// ── Specialized source domains per intent ────────────────────────────────────
export const SPECIALIZED_SOURCES: Partial<Record<QueryIntent, string[]>> = {
  code:       ['site:stackoverflow.com', 'site:github.com', 'site:developer.mozilla.org'],
  science:    ['site:arxiv.org', 'site:nature.com', 'site:pubmed.ncbi.nlm.nih.gov'],
  medical:    ['site:mayoclinic.org', 'site:webmd.com', 'site:nih.gov'],
  legal:      ['site:law.cornell.edu', 'site:justia.com'],
  history:    ['site:britannica.com', 'site:history.com'],
  finance:    ['site:reuters.com', 'site:bloomberg.com', 'site:yahoo.finance.com'],
  news:       ['site:bbc.com', 'site:reuters.com', 'site:apnews.com'],
};

// ── Complexity scoring ───────────────────────────────────────────────────────
export type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'research';

export function assessComplexity(message: string, intent: QueryIntent): QueryComplexity {
  if (NEVER_RAG_INTENTS.includes(intent)) return 'simple';
  if (ALWAYS_RAG_INTENTS.includes(intent)) return 'moderate';

  const wordCount = message.split(/\s+/).length;
  const hasMultipleQuestions = (message.match(/\?/g) ?? []).length > 1;
  const hasComparison = /\b(vs\.?|versus|compare|difference|between)\b/i.test(message);
  const isComplex = wordCount > 30 || hasMultipleQuestions || hasComparison;
  const isResearch = wordCount > 60 || /\b(research|comprehensive|detailed|thorough|explain everything|all aspects)\b/i.test(message);

  if (isResearch) return 'research';
  if (isComplex) return 'complex';
  if (wordCount > 15 || message.length > 120) return 'moderate';
  return 'simple';
}

// ── Main classifiers ─────────────────────────────────────────────────────────
export function classifyIntent(message: string): QueryIntent {
  const lower = message.toLowerCase().trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(lower))) return intent;
  }
  return 'general';
}

/**
 * Smart RAG decision — aggressive brain-first approach:
 * - Real-time intents → always RAG
 * - Pure short greetings → skip
 * - Everything else ≥ 30 chars → trigger RAG (brain first, web if needed)
 */
export function shouldUseRAG(intent: QueryIntent, messageLength = 0, ragThreshold = 30): boolean {
  if (NEVER_RAG_INTENTS.includes(intent)) return false;
  if (ALWAYS_RAG_INTENTS.includes(intent)) return true;
  // Math/creative still use RAG for brain knowledge (they may have cached answers)
  if (intent === 'math' && messageLength < 60) return false;
  return messageLength >= ragThreshold;
}

/**
 * Multi-angle query decomposition:
 * - Comparisons: splits into individual subjects
 * - How-to: adds tutorial & best-practice variants
 * - Code: adds examples & StackOverflow variant
 * - News: adds recency variant
 */
export function decomposeQuery(message: string, intent: QueryIntent): string[] {
  if (message.length < 80 || NEVER_RAG_INTENTS.includes(intent)) return [message];

  const cleaned = message.replace(/\?$/, '').trim();

  const vsMatch = cleaned.match(/^(.+?)\s+(?:vs\.?|versus|compared? to|or)\s+(.+)$/i);
  if (vsMatch?.[1] && vsMatch?.[2]) {
    return [vsMatch[1].trim(), vsMatch[2].trim(), cleaned].slice(0, 3);
  }

  if (intent === 'howto') {
    return [cleaned, `${cleaned} tutorial 2026`, `${cleaned} best practices`].slice(0, 3);
  }

  if (intent === 'code') {
    return [cleaned, `${cleaned} example`, `${cleaned} stackoverflow`].slice(0, 3);
  }

  if (intent === 'news') {
    return [cleaned, `${cleaned} latest 2026`].slice(0, 2);
  }

  const sentences = cleaned.split(/[.!]\s+/).filter(s => s.length > 20);
  if (sentences.length >= 2) {
    return [cleaned, ...sentences.slice(0, 2)].slice(0, 3);
  }

  return [cleaned];
}

/**
 * Query expansion — generates alternative phrasings for better recall.
 */
export function expandQuery(message: string, intent: QueryIntent): string[] {
  const base = message.trim().replace(/\?$/, '');

  if (ALWAYS_RAG_INTENTS.includes(intent)) {
    return [base, `${base} 2026`];
  }

  if (intent === 'factual') {
    const cleaned = base.replace(/^(what is|who is|what are|define)\s+/i, '').trim();
    return [base, cleaned, `${cleaned} overview`];
  }

  const vsMatch = base.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i);
  if (vsMatch?.[1] && vsMatch?.[2]) {
    return [base, vsMatch[1].trim(), vsMatch[2].trim()];
  }

  return [base];
}
