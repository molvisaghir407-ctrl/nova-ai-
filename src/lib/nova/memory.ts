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

function contentHash(content: string): string {
  // Simple fast hash without crypto module dependency
  const str = content.trim().toLowerCase();
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

// Lazy db loader — safe even if Prisma isn't generated
let _db: any = null;
async function getDb(): Promise<any | null> {
  if (_db) return _db;
  try {
    const { db } = await import('@/lib/db');
    _db = db;
    return _db;
  } catch {
    return null;
  }
}

class MemoryManager {
  async store(category: MemoryEntry['category'], content: string, importance = 0.5, metadata?: Record<string, unknown>): Promise<MemoryEntry | null> {
    try {
      const db = await getDb();
      if (!db) return null;
      const hash = contentHash(content);
      const entry = await (db.memory as any).upsert({
        where: { contentHash: hash },
        create: { category, content, importance: Math.max(0, Math.min(1, importance)), metadata: metadata ? JSON.stringify(metadata) : null, contentHash: hash },
        update: { importance: Math.max(0, Math.min(1, importance + 0.05)), accessCount: { increment: 1 }, accessedAt: new Date() },
      });
      return this.toEntry(entry);
    } catch (e) {
      logger.warn('memory', 'store failed');
      return null;
    }
  }

  async findSimilar(content: string): Promise<string | null> {
    try {
      const db = await getDb();
      if (!db) return null;
      const existing = await (db.memory as any).findUnique({ where: { contentHash: contentHash(content) } });
      return existing?.id ?? null;
    } catch { return null; }
  }

  async recall(query: string, options?: { category?: string; limit?: number; minImportance?: number }): Promise<MemorySearchResult[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      const limit = options?.limit ?? 5;
      const where: Record<string, unknown> = { importance: { gte: options?.minImportance ?? 0 } };
      if (options?.category) where.category = options.category;
      const memories = await db.memory.findMany({ where, orderBy: [{ importance: 'desc' }, { accessedAt: 'desc' }], take: limit * 4 });
      const queryLower = query.toLowerCase();
      const matched = query ? memories.filter((m: any) => m.content.toLowerCase().includes(queryLower) || m.category.toLowerCase().includes(queryLower)) : memories;
      return matched.slice(0, limit).map((m: any) => ({ id: m.id, content: m.content, category: m.category, importance: m.importance, relevanceScore: this.calcRelevance(queryLower, m.content) }));
    } catch { return []; }
  }

  async getAll(): Promise<MemoryEntry[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      const memories = await db.memory.findMany({ orderBy: { createdAt: 'desc' } });
      return memories.map((m: any) => this.toEntry(m));
    } catch { return []; }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) return false;
      await db.memory.delete({ where: { id } });
      return true;
    } catch { return false; }
  }

  async buildContextPrompt(maxEntries = 5): Promise<string> {
    try {
      const memories = await this.recall('', { limit: maxEntries, minImportance: 0.3 });
      if (!memories.length) return '';
      const lines = memories.map(m => `- ${m.category === 'preference' ? 'User preference' : m.category === 'fact' ? 'Known fact' : 'Remembered'}: ${m.content}`);
      return `\n## User Context (from memory)\n${lines.join('\n')}\n`;
    } catch { return ''; }
  }

  private calcRelevance(queryLower: string, content: string): number {
    if (!queryLower) return 0.5;
    const qWords = queryLower.split(/\s+/);
    const cWords = content.toLowerCase().split(/\s+/);
    return Math.min(1, qWords.filter(w => cWords.includes(w)).length / Math.max(qWords.length, 1));
  }

  private toEntry(m: any): MemoryEntry {
    return { id: m.id, category: m.category, content: m.content, importance: m.importance, metadata: m.metadata ? JSON.parse(m.metadata) : undefined, accessedAt: m.accessedAt, accessCount: m.accessCount, createdAt: m.createdAt };
  }
}

export const memoryManager = new MemoryManager();
