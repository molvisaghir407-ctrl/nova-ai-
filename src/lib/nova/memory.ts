import { logger } from './logger';

export interface MemoryEntry {
  id: string;
  category: 'fact' | 'preference' | 'conversation' | 'note' | 'skill';
  content: string;
  importance: number;
  metadata?: Record<string, unknown>;
  accessedAt: Date;
  accessCount: number;
  createdAt: Date;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  category: string;
  importance: number;
  relevanceScore: number;
}

interface DBMemory {
  id: string;
  category: string;
  content: string;
  importance: number;
  metadata: string | null;
  contentHash: string | null;
  accessedAt: Date;
  accessCount: number;
  createdAt: Date;
}

interface DBClient {
  memory: {
    upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<DBMemory>;
    findUnique(args: { where: Record<string, unknown> }): Promise<DBMemory | null>;
    findMany(args: { where?: Record<string, unknown>; orderBy?: Record<string, unknown>[]; take?: number }): Promise<DBMemory[]>;
    update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<DBMemory>;
    delete(args: { where: Record<string, unknown> }): Promise<DBMemory>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
}

function contentHash(content: string): string {
  const str = content.trim().toLowerCase();
  let h1 = 0xdeadbeef | 0, h2 = 0x41c6ce57 | 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

let _db: DBClient | null = null;
async function getDb(): Promise<DBClient | null> {
  if (_db) return _db;
  try {
    const mod = await import('@/lib/db') as { db: DBClient };
    _db = mod.db;
    return _db;
  } catch { return null; }
}

class MemoryManager {
  async store(
    category: MemoryEntry['category'],
    content: string,
    importance = 0.5,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry> {
    const db = await getDb();
    if (!db) throw new Error('Database unavailable');
    const hash = contentHash(content);
    const entry = await db.memory.upsert({
      where: { contentHash: hash },
      create: { category, content, importance: Math.max(0, Math.min(1, importance)), metadata: metadata ? JSON.stringify(metadata) : null, contentHash: hash },
      update: { importance: Math.max(0, Math.min(1, importance + 0.05)), accessCount: { increment: 1 }, accessedAt: new Date() },
    });
    return this.toEntry(entry);
  }

  async findSimilar(content: string): Promise<string | null> {
    try {
      const db = await getDb();
      if (!db) return null;
      const existing = await db.memory.findUnique({ where: { contentHash: contentHash(content) } });
      return existing?.id ?? null;
    } catch { return null; }
  }

  async recall(query: string, options?: { category?: string; limit?: number; minImportance?: number }): Promise<MemorySearchResult[]> {
    const db = await getDb();
    if (!db) return [];
    const limit = options?.limit ?? 5;
    const where: Record<string, unknown> = { importance: { gte: options?.minImportance ?? 0 } };
    if (options?.category) where['category'] = options.category;
    const memories = await db.memory.findMany({ where, orderBy: [{ importance: 'desc' }, { accessedAt: 'desc' }], take: limit * 4 });
    const qLower = query.toLowerCase();
    const matched = query ? memories.filter(m => m.content.toLowerCase().includes(qLower) || m.category.toLowerCase().includes(qLower)) : memories;
    const top = matched.slice(0, limit);
    const now = new Date();
    await Promise.all(top.map(m => db.memory.update({ where: { id: m.id }, data: { accessedAt: now, accessCount: { increment: 1 } } })));
    return top.map(m => ({ id: m.id, content: m.content, category: m.category, importance: m.importance, relevanceScore: this.calcRelevance(qLower, m.content) }));
  }

  async getByCategory(category: string): Promise<MemoryEntry[]> {
    const db = await getDb();
    if (!db) return [];
    const memories = await db.memory.findMany({ where: { category }, orderBy: [{ createdAt: 'desc' }] });
    return memories.map(m => this.toEntry(m));
  }

  async update(id: string, data: Partial<Pick<MemoryEntry, 'content' | 'importance' | 'metadata'>>): Promise<MemoryEntry | null> {
    const db = await getDb();
    if (!db) return null;
    const updateData: Record<string, unknown> = {};
    if (data.content !== undefined) { updateData['content'] = data.content; updateData['contentHash'] = contentHash(data.content); }
    if (data.importance !== undefined) updateData['importance'] = data.importance;
    if (data.metadata !== undefined) updateData['metadata'] = JSON.stringify(data.metadata);
    const entry = await db.memory.update({ where: { id }, data: updateData });
    logger.info('memory', 'Updated memory', { id });
    return this.toEntry(entry);
  }

  async delete(id: string): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) return false;
      await db.memory.delete({ where: { id } });
      return true;
    } catch { return false; }
  }

  async getStats(): Promise<{ total: number; byCategory: Record<string, number>; avgImportance: number }> {
    const db = await getDb();
    if (!db) return { total: 0, byCategory: {}, avgImportance: 0 };
    const memories = await db.memory.findMany({ where: {} });
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const m of memories) {
      byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
      total += m.importance;
    }
    return { total: memories.length, byCategory, avgImportance: memories.length > 0 ? total / memories.length : 0 };
  }

  async cleanup(options?: { olderThanDays?: number; minImportance?: number }): Promise<number> {
    const db = await getDb();
    if (!db) return 0;
    const where: Record<string, unknown> = {};
    if (options?.olderThanDays) where['accessedAt'] = { lt: new Date(Date.now() - options.olderThanDays * 86400000) };
    if (options?.minImportance !== undefined) where['importance'] = { lte: options.minImportance };
    const result = await db.memory.deleteMany({ where });
    logger.info('memory', `Cleaned up ${result.count} memories`);
    return result.count;
  }

  async buildContextPrompt(maxEntries = 5): Promise<string> {
    const memories = await this.recall('', { limit: maxEntries, minImportance: 0.3 });
    if (!memories.length) return '';
    const lines = memories.map(m => {
      const prefix = m.category === 'preference' ? 'User preference' : m.category === 'fact' ? 'Known fact' : 'Remembered';
      return `- ${prefix}: ${m.content}`;
    });
    return `\n## User Context (from memory)\n${lines.join('\n')}\n`;
  }

  private calcRelevance(queryLower: string, content: string): number {
    if (!queryLower) return 0.5;
    const qWords = queryLower.split(/\s+/).filter(Boolean);
    if (!qWords.length) return 0.5;
    const cWords = content.toLowerCase().split(/\s+/);
    return Math.min(1, qWords.filter(w => cWords.includes(w)).length / qWords.length);
  }

  private toEntry(m: DBMemory): MemoryEntry {
    return { id: m.id, category: m.category as MemoryEntry['category'], content: m.content, importance: m.importance, metadata: m.metadata ? JSON.parse(m.metadata) as Record<string, unknown> : undefined, accessedAt: m.accessedAt, accessCount: m.accessCount, createdAt: m.createdAt };
  }
}

export const memoryManager = new MemoryManager();
