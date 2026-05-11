/**
 * Nova Knowledge Graph (KG) — Lightweight Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracts named entities + relationships from text and stores them in
 * the Qdrant `nova_kg` collection. At query time, the KG layer augments
 * search results with entity context, inter-entity relationships, and
 * evidence snippets — giving Nova structured world knowledge on top of
 * its retrieval capabilities.
 *
 * Design goals:
 *   • LIGHTWEIGHT  — single fast LLM call per document batch; no heavy NLP lib
 *   • INCREMENTAL  — upsert-safe; re-indexing a doc just updates payloads
 *   • QUERYABLE    — semantic search over entity embeddings + payload filters
 *   • GRACEFUL     — returns empty results if Qdrant is not configured
 *
 * Entity types: person, organization, technology, concept, place, event, other
 * Relationship types: free-form short strings ("created by", "part of", etc.)
 */

import { quickChat } from '@/lib/nova/nim/client';
import { NIM_MODELS } from '@/lib/nova/nim/models';
import { upsertKGNodes, searchKG, type KGNode } from './qdrant';

// ── Extraction ────────────────────────────────────────────────────────────────
const EXTRACT_SYSTEM = `You are a knowledge graph extraction engine.
Given a text, extract entities and their relationships.
Output ONLY a JSON array of objects:
[
  {
    "name": "Entity Name",
    "type": "person|organization|technology|concept|place|event|other",
    "relations": [
      {"relationType": "short verb phrase", "targetName": "Other Entity"}
    ],
    "evidence": "one sentence from the text that mentions this entity"
  }
]
Rules:
- Extract 3–8 most important entities (quality > quantity)
- name: canonical form (full name, not pronouns)
- relations: only if clearly stated in the text; max 3 per entity
- evidence: exact quote from text (max 120 chars)
- Skip generic entities like "user", "people", "things"
Output ONLY valid JSON array. No explanation, no markdown.`;

interface RawEntity {
  name     : string;
  type     : KGNode['type'];
  relations: Array<{ relationType: string; targetName: string }>;
  evidence : string;
}

function nodeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 60);
}

export async function extractEntities(text: string): Promise<KGNode[]> {
  if (!text || text.length < 100) return [];

  try {
    const raw = await quickChat(
      [{ role: 'user', content: text.slice(0, 2000) }],
      NIM_MODELS.LLAMA_FAST,
      600,
      AbortSignal.timeout(8000),
    );

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    const parsed = JSON.parse(cleaned) as RawEntity[];
    if (!Array.isArray(parsed)) return [];

    const now = new Date().toISOString();

    return parsed
      .filter(e => e.name && e.type)
      .slice(0, 8)
      .map(e => ({
        id       : nodeId(e.name),
        name     : e.name.trim(),
        type     : e.type ?? 'other',
        relations: (e.relations ?? []).map(r => ({
          relationType: r.relationType,
          targetName  : r.targetName,
          targetId    : nodeId(r.targetName),
        })),
        evidence : [e.evidence ?? ''].filter(Boolean),
        updatedAt: now,
      }));
  } catch {
    // Parse failure or LLM error → extract via simple regex
    return regexFallback(text);
  }
}

/** Fast regex-based fallback when LLM extraction fails */
function regexFallback(text: string): KGNode[] {
  const now = new Date().toISOString();
  // Heuristic: capitalized multi-word proper nouns
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m, (counts.get(m) ?? 0) + 1);

  return [...counts.entries()]
    .filter(([, c]) => c >= 2)      // mentioned at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => ({
      id       : nodeId(name),
      name,
      type     : 'concept' as const,
      relations: [],
      evidence : [],
      updatedAt: now,
    }));
}

// ── Merge & persist ───────────────────────────────────────────────────────────
/**
 * Extract entities from multiple texts, merge duplicates, and upsert to Qdrant.
 * Called by the Inngest background function after each RAG pipeline run.
 */
export async function indexTextIntoKG(
  texts: string[],
): Promise<void> {
  const allNodes = await Promise.all(texts.map(extractEntities));
  const merged = mergeNodes(allNodes.flat());
  if (merged.length) await upsertKGNodes(merged);
}

/** Merge duplicate nodes by id, combining relations and evidence */
function mergeNodes(nodes: KGNode[]): KGNode[] {
  const map = new Map<string, KGNode>();

  for (const n of nodes) {
    const existing = map.get(n.id);
    if (!existing) {
      map.set(n.id, { ...n });
    } else {
      // Merge evidence (deduplicated)
      const evSet = new Set([...existing.evidence, ...n.evidence]);
      // Merge relations (deduplicated by targetId+type)
      const relKey = (r: KGNode['relations'][0]) => `${r.relationType}→${r.targetId}`;
      const relMap = new Map(existing.relations.map(r => [relKey(r), r]));
      for (const r of n.relations) relMap.set(relKey(r), r);
      map.set(n.id, {
        ...existing,
        evidence : [...evSet].slice(0, 6),
        relations: [...relMap.values()].slice(0, 8),
        updatedAt: n.updatedAt,
      });
    }
  }
  return [...map.values()];
}

// ── Query KG for context ──────────────────────────────────────────────────────
/**
 * Given a user query, find the most relevant KG entities and format
 * them as a structured context string for the LLM prompt.
 */
export async function buildKGContext(query: string): Promise<string> {
  const hits = await searchKG(query, 6);
  if (!hits.length) return '';

  const lines: string[] = ['## Knowledge Graph Context'];

  for (const h of hits) {
    const n = h.payload;
    lines.push(`**${n.name}** (${n.type})`);

    if (n.relations.length) {
      const relStr = n.relations
        .slice(0, 3)
        .map(r => `${r.relationType} → ${r.targetName}`)
        .join('; ');
      lines.push(`  Relations: ${relStr}`);
    }

    if (n.evidence.length) {
      lines.push(`  Evidence: "${n.evidence[0]}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Given a set of entities (from query rewriter), find how they connect
 * in the KG — useful for multi-hop relationship questions.
 */
export async function findEntityRelations(
  entityNames: string[],
): Promise<Map<string, KGNode>> {
  const result = new Map<string, KGNode>();
  if (!entityNames.length) return result;

  const hits = await Promise.all(entityNames.map(e => searchKG(e, 2)));
  for (const batch of hits) {
    for (const h of batch) {
      result.set(h.payload.name, h.payload);
    }
  }
  return result;
}
