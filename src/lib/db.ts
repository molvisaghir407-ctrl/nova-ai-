import type { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Lazy Prisma client — only instantiated on first access, never at module load.
 * This prevents build failures when @prisma/client hasn't been generated yet,
 * and avoids crashing during Next.js static analysis of API routes.
 */
function createPrismaClient(): PrismaClient {
  // Dynamic require so the import itself doesn't throw at module evaluation
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: PC } = require('@prisma/client') as { PrismaClient: typeof PrismaClient };
  return new PC({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

let _db: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!_db) {
    _db = createPrismaClient();
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db;
  }
  return _db;
}

/**
 * For backwards compatibility — uses a Proxy so code that does `db.model.xxx`
 * still works but the client isn't created until first property access.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getDb()[prop as keyof PrismaClient];
  },
});
