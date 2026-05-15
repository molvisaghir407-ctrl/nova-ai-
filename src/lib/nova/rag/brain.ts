/**
 * Nova RAG Brain — Vectorless Knowledge Accumulator v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * BM25-powered knowledge base that grows with every RAG call.
 * No Qdrant, no embeddings, no ML — pure information retrieval mathematics.
 *
 * Architecture:
 *  • BM25 (Okapi BM25)       — precise vectorless scoring
 *  • Cloudflare KV           — 30-day persistent storage
 *  • In-memory hot cache     — zero-latency recall this session
 *  • Recency weighting       — newer knowledge scores higher
 *  • Knowledge graph         — entity/topic relationship tracking
 *  • Coverage estimation     — decides when to skip external search
 *  • Conversation awareness  — accumulates knowledge across all turns
 *
 * Result: Nova depends on its own accumulated brain more, external APIs less.
 */

import type { Source, QueryIntent } from '@/types/nova.types';

// ── BM25 Constants ────────────────────────────────────────────────────────────
const K1               = 1.5;           // term saturation
const B                = 0.75;          // length normalization
const MAX_DOCS         = 600;           // evict oldest beyond this
const COVERAGE_FULL    = 0.65;          // skip web search entirely
const COVERAGE_PARTIAL = 0.30;          // supplement web with brain
const BRAIN_KEY        = 'nova:brain:v3';
const GRAPH_KEY        = 'nova:brain:graph:v2';
const SESSION_KEY      = 'nova:brain:session';

// ── Cloudflare KV ─────────────────────────────────────────────────────────────
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;
const CF_HDR  = { Authorization: `Bearer ${process.env.CLOUDFLARE_D1_TOKEN ?? ''}` };

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`${CF_BASE}/values/${encodeURIComponent(key)}`, {
      headers: CF_HDR,
      cache:   'no-store',
      signal:  AbortSignal.timeout(1800),
    });
    if (!r.ok) return null;
    return JSON.parse(await r.text()) as T;
  } catch { return null; }
}

async function kvSet(key: string, data: unknown, ttl = 86400 * 30): Promise<void> {
  try {
    const form = new FormData();
    form.append('value', JSON.stringify(data));
    await fetch(`${CF_BASE}/values/${encodeURIComponent(key)}?expiration_ttl=${ttl}`, {
      method:  'PUT',
      headers: CF_HDR,
      body:    form,
      cache:   'no-store',
    });
  } catch { /* non-fatal */ }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BrainDoc {
  id        : string;
  text      : string;
  title     : string;
  url       : string;
  domain    : string;
  date      : string;
  tf        : Record<string, number>;   // raw term frequencies
  wordCount : number;
  ts        : number;                   // unix ms
  intent    : string;
  queryCtx  : string;
}

export interface BrainIndex {
  docs     : BrainDoc[];
  df       : Record<string, number>;    // document frequency per term
  N        : number;                    // total docs
  avgdl    : number;                    // avg doc length
  savedAt  : number;
}

interface GraphNode {
  name      : string;
  type      : string;
  mentions  : number;
  lastSeen  : number;
  edges     : string[];                 // related node names
}

interface KGraph {
  nodes  : Record<string, GraphNode>;
  savedAt: number;
}

// ── English stopword set ──────────────────────────────────────────────────────
const SW = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','must','shall','can','need','ought',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','this','that','these','those',
  'and','but','or','nor','for','yet','so','because','as','if','when',
  'in','on','at','by','with','about','of','to','from','up','down',
  'what','which','who','how','where','why','not','no','yes',
  'also','just','more','very','so','then','than','into','over',
]);

function tok(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !SW.has(t));
}

function tfMap(tokens: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const t of tokens) m[t] = (m[t] ?? 0) + 1;
  return m;
}

function docId(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 0x01000193) >>> 0;
  return `bd_${h.toString(36)}`;
}

// ── BM25 Brain singleton ──────────────────────────────────────────────────────
class BM25Brain {
  private idx  : BrainIndex = { docs: [], df: {}, N: 0, avgdl: 0, savedAt: 0 };
  private graph: KGraph     = { nodes: {}, savedAt: 0 };
  private ready = false;
  private dirty = false;

  // ─ Load ───────────────────────────────────────────────────────────────────
  async load(): Promise<void> {
    if (this.ready) return;
    this.ready = true;
    const [idxData, gData] = await Promise.all([
      kvGet<BrainIndex>(BRAIN_KEY),
      kvGet<KGraph>(GRAPH_KEY),
    ]);
    if (idxData?.docs?.length) this.idx   = idxData;
    if (gData?.nodes)          this.graph = gData;
  }

  // ─ Flush (fire-and-forget) ────────────────────────────────────────────────
  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    this.idx.savedAt   = Date.now();
    this.graph.savedAt = Date.now();
    await Promise.all([
      kvSet(BRAIN_KEY,  this.idx),
      kvSet(GRAPH_KEY, this.graph),
    ]);
  }

  // ─ Index new sources ──────────────────────────────────────────────────────
  async index(sources: Source[], intent: string, query: string): Promise<number> {
    await this.load();
    const seen = new Set(this.idx.docs.map(d => d.url));
    let added = 0;

    for (const s of sources) {
      if (!s.url || !s.snippet || seen.has(s.url)) continue;
      const raw   = `${s.title} ${s.snippet}`.replace(/\s+/g, ' ').trim();
      const terms = tok(raw);
      if (terms.length < 6) continue;

      const doc: BrainDoc = {
        id:        docId(s.url),
        text:      raw,
        title:     s.title,
        url:       s.url,
        domain:    s.domain || '',
        date:      s.date   || '',
        tf:        tfMap(terms),
        wordCount: terms.length,
        ts:        Date.now(),
        intent,
        queryCtx:  query.slice(0, 150),
      };

      for (const t of new Set(terms)) this.idx.df[t] = (this.idx.df[t] ?? 0) + 1;
      this.idx.docs.push(doc);
      seen.add(s.url);
      added++;
    }

    if (added === 0) return 0;

    // Evict oldest docs beyond cap
    if (this.idx.docs.length > MAX_DOCS) {
      const stale = this.idx.docs.splice(0, this.idx.docs.length - MAX_DOCS);
      for (const d of stale) {
        for (const t of Object.keys(d.tf)) {
          this.idx.df[t] = Math.max(0, (this.idx.df[t] ?? 1) - 1);
          if (this.idx.df[t] === 0) delete this.idx.df[t];
        }
      }
    }

    // Recompute stats
    this.idx.N     = this.idx.docs.length;
    this.idx.avgdl = this.idx.docs.reduce((s, d) => s + d.wordCount, 0) / Math.max(1, this.idx.N);
    this.dirty = true;
    return added;
  }

  // ─ BM25 score ─────────────────────────────────────────────────────────────
  private score(doc: BrainDoc, qTerms: string[]): number {
    const N     = Math.max(this.idx.N, 1);
    const avgdl = Math.max(this.idx.avgdl, 1);
    let   s     = 0;

    for (const t of qTerms) {
      const tf = doc.tf[t] ?? 0;
      if (tf === 0) continue;
      const df  = this.idx.df[t] ?? 0;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      const tfN = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.wordCount / avgdl));
      s += idf * tfN;
    }

    // Recency: logarithmic decay — latest hour +0.6, 24h +0.2, week +0.05
    const ageH = (Date.now() - doc.ts) / 3_600_000;
    s += ageH < 1 ? 0.6 : ageH < 24 ? 0.2 : ageH < 168 ? 0.05 : 0;

    return s;
  }

  // ─ Query brain ────────────────────────────────────────────────────────────
  async query(q: string, topK = 10): Promise<Array<{ src: Source; score: number }>> {
    await this.load();
    if (!this.idx.docs.length) return [];

    const qTerms = tok(q);
    if (!qTerms.length) return [];

    return this.idx.docs
      .map(d => ({ src: this.toSource(d), score: this.score(d, qTerms) }))
      .filter(x => x.score > 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ─ Coverage: 0-1 score ────────────────────────────────────────────────────
  async coverage(q: string): Promise<number> {
    const hits = await this.query(q, 3);
    if (!hits.length) return 0;
    const top = hits[0]!.score;
    // Normalise against a "perfect" BM25 score of ~4.0
    return Math.min(1, top / 4.0);
  }

  // ─ Format context string ──────────────────────────────────────────────────
  async context(q: string, n = 8): Promise<string> {
    const hits = await this.query(q, n);
    if (!hits.length) return '';

    const lines = hits.map((h, i) =>
      `[B${i + 1}] **${h.src.title}**\n   _${h.src.domain}_  (score: ${h.score.toFixed(2)})\n   ${h.src.snippet.slice(0, 450)}`
    ).join('\n\n');

    return [
      '',
      '---',
      `## 🧠 Nova Brain — Recalled Knowledge  (${hits.length} docs · BM25 vectorless)`,
      `_Brain size: ${this.idx.N} documents, ${Object.keys(this.idx.df).length} unique terms_`,
      '',
      lines,
      '',
      '> **Brain knowledge is Nova\'s own accumulated learning.** Reference it as first-person knowledge.',
      '> For brain citations use [B1], [B2]… to distinguish from live web sources [1], [2]…',
      '---',
    ].join('\n');
  }

  // ─ Knowledge graph ────────────────────────────────────────────────────────
  async updateGraph(entities: Array<{ name: string; type: string }>): Promise<void> {
    await this.load();
    const now = Date.now();

    for (const e of entities) {
      if (!e.name || e.name.length < 2) continue;
      const key  = e.name.toLowerCase().replace(/\s+/g, '_').slice(0, 60);
      const node = this.graph.nodes[key];
      if (node) { node.mentions++; node.lastSeen = now; }
      else { this.graph.nodes[key] = { name: e.name, type: e.type, mentions: 1, lastSeen: now, edges: [] }; }
    }

    // Link co-occurring entities
    for (let i = 0; i < entities.length - 1; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const ak = entities[i]!.name.toLowerCase().replace(/\s+/g, '_').slice(0, 60);
        const bk = entities[j]!.name.toLowerCase().replace(/\s+/g, '_').slice(0, 60);
        const an = this.graph.nodes[ak], bn = this.graph.nodes[bk];
        if (an && !an.edges.includes(bk)) an.edges.push(bk);
        if (bn && !bn.edges.includes(ak)) bn.edges.push(ak);
      }
    }

    this.dirty = true;
  }

  async graphContext(q: string): Promise<string> {
    await this.load();
    const qTerms = tok(q);
    if (!qTerms.length) return '';

    const relevant = Object.entries(this.graph.nodes)
      .filter(([key, n]) =>
        qTerms.some(t => key.includes(t) || tok(n.name).includes(t))
      )
      .sort((a, b) => b[1].mentions - a[1].mentions)
      .slice(0, 5);

    if (!relevant.length) return '';

    const lines = relevant.map(([, n]) => {
      const conns = n.edges.slice(0, 3)
        .map(k => this.graph.nodes[k]?.name ?? k)
        .join(', ');
      return `- **${n.name}** (${n.type} · ×${n.mentions})${conns ? ` → ${conns}` : ''}`;
    });

    return `\n### 🕸️ Knowledge Graph — Related Entities\n${lines.join('\n')}\n`;
  }

  async stats() {
    await this.load();
    return { docs: this.idx.N, terms: Object.keys(this.idx.df).length, nodes: Object.keys(this.graph.nodes).length };
  }

  private toSource(d: BrainDoc): Source {
    return { id: 0, title: d.title, url: d.url, snippet: d.text.slice(0, 600), domain: d.domain, date: d.date };
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const ragBrain = new BM25Brain();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pre-flight brain check.
 * Returns whether to use brain exclusively, partial supplement, or skip.
 */
export async function brainCheck(query: string, intent: QueryIntent): Promise<{
  mode    : 'full' | 'partial' | 'skip';
  coverage: number;
  context : string;
}> {
  // Real-time intents always need fresh web data
  if (['news', 'weather', 'finance', 'sports'].includes(intent)) {
    return { mode: 'skip', coverage: 0, context: '' };
  }

  const cov = await ragBrain.coverage(query);

  if (cov >= COVERAGE_FULL) {
    // Brain has strong coverage — skip external search
    const ctx = await ragBrain.context(query, 10);
    const graph = await ragBrain.graphContext(query);
    return { mode: 'full', coverage: cov, context: ctx + graph };
  }

  if (cov >= COVERAGE_PARTIAL) {
    // Partial coverage — supplement with web search but include brain
    const ctx = await ragBrain.context(query, 6);
    return { mode: 'partial', coverage: cov, context: ctx };
  }

  return { mode: 'skip', coverage: cov, context: '' };
}

/**
 * Feed new sources into the brain after a RAG call.
 * Call fire-and-forget — never await in the hot path.
 */
export async function feedBrain(
  sources: Source[],
  intent : string,
  query  : string,
): Promise<void> {
  const added = await ragBrain.index(sources, intent, query);
  if (added > 0) void ragBrain.flush();
}

/**
 * Get full brain context for a query (brain + graph).
 */
export async function getBrainContext(query: string, topK = 8): Promise<string> {
  const [brain, graph] = await Promise.all([
    ragBrain.context(query, topK),
    ragBrain.graphContext(query),
  ]);
  return brain + graph;
}

export { COVERAGE_FULL, COVERAGE_PARTIAL, SESSION_KEY };
