import { db } from '@/lib/db';
import { logger } from './logger';
import { createHash } from 'crypto';

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
  return createHash('sha256').update(content.trim().toLowerCase()).digest('hex').slice(0, 16);
}

class MemoryManager {
  async store(category: MemoryEntry['category'], content: string, importance = 0.5, metadata?: Record<string, unknown>): Promise<MemoryEntry> {
    const hash = contentHash(content);
    const entry = await (db.memory as any).upsert({
      where: { contentHash: hash },
      create: { category, content, importance: Math.max(0, Math.min(1, importance)), metadata: metadata ? JSON.stringify(metadata) : null, contentHash: hash },
      update: { importance: Math.max(0, Math.min(1, importance + 0.05)), accessCount: { increment: 1 }, accessedAt: new Date() },
    });
    return this.toEntry(entry);
  }

  async findSimilar(content: string): Promise<string | null> {
    try {
      const existing = await (db.memory as any).findUnique({ where: { contentHash: contentHash(content) } });
      return existing?.id ?? null;
    } catch { return null; }
  }

  async recall(query: string, options?: { category?: string; limit?: number; minImportance?: number }): Promise<MemorySearchResult[]> {
    const limit = options?.limit ?? 5;
    const where: Record<string, unknown> = { importance: { gte: options?.minImportance ?? 0 } };
    if (options?.category) where.category = options.category;
    const memories = await db.memory.findMany({ where, orderBy: [{ importance: 'desc' }, { accessedAt: 'desc' }], take: limit * 4 });
    const queryLower = query.toLowerCase();
    const matched = query ? memories.filter(m => m.content.toLowerCase().includes(queryLower) || m.category.toLowerCase().includes(queryLower)) : memories;
    const top = matched.slice(0, limit);
    const now = new Date();
    await Promise.all(top.map(m => db.memory.update({ where: { id: m.id }, data: { accessedAt: now, accessCount: { increment: 1 } } })));
    return top.map(m => ({ id: m.id, content: m.content, category: m.category, importance: m.importance, relevanceScore: this.calcRelevance(queryLower, m.content) }));
  }

  async getByCategory(category: string) {
    const memories = await db.memory.findMany({ where: { category }, orderBy: { createdAt: 'desc' } });
    return memories.map(m => this.toEntry(m));
  }

  async update(id: string, data: Partial<Pick<MemoryEntry, 'content' | 'importance' | 'metadata'>>) {
    const updateData: Record<string, unknown> = {};
    if (data.content !== undefined) { updateData.content = data.content; updateData.contentHash = contentHash(data.content); }
    if (data.importance !== undefined) updateData.importance = data.importance;
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);
    const entry = await db.memory.update({ where: { id }, data: updateData });
    return this.toEntry(entry);
  }

  async delete(id: string): Promise<boolean> {
    try { await db.memory.delete({ where: { id } }); return true; } catch { return false; }
  }

  async getStats() {
    const memories = await db.memory.findMany();
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const m of memories) { byCategory[m.category] = (byCategory[m.category] || 0) + 1; total += m.importance; }
    return { total: memories.length, byCategory, avgImportance: memories.length > 0 ? total / memories.length : 0 };
  }

  async cleanup(options?: { olderThanDays?: number; minImportance?: number }) {
    const where: Record<string, unknown> = {};
    if (options?.olderThanDays) where.accessedAt = { lt: new Date(Date.now() - options.olderThanDays * 86400000) };
    if (options?.minImportance !== undefined) where.importance = { lte: options.minImportance };
    const result = await db.memory.deleteMany({ where });
    return result.count;
  }

  async buildContextPrompt(maxEntries = 5): Promise<string> {
    const memories = await this.recall('', { limit: maxEntries, minImportance: 0.3 });
    if (!memories.length) return '';
    const lines = memories.map(m => `- ${m.category === 'preference' ? 'User preference' : m.category === 'fact' ? 'Known fact' : 'Remembered'}: ${m.content}`);
    return `\n## User Context (from memory)\n${lines.join('\n')}\n`;
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
