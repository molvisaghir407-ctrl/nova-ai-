export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

const IS_DEV = process.env.NODE_ENV === 'development';
const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class NovaLogger {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000;
  private logLevel: LogLevel = IS_DEV ? 'debug' : 'info';

  setLogLevel(level: LogLevel) { this.logLevel = level; }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.logLevel];
  }

  private addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const log: LogEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, timestamp: new Date() };
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) this.logs = this.logs.slice(-this.maxLogs);

    // Only log to console in development
    if (IS_DEV && this.shouldLog(entry.level)) {
      const prefix = `[${log.timestamp.toISOString()}] [${entry.level.toUpperCase()}] [${entry.category}]`;
      if (entry.level === 'error') console.error(prefix, entry.message, entry.error ?? entry.details ?? '');
      else if (entry.level === 'warn') console.warn(prefix, entry.message, entry.details ?? '');
      else if (entry.level === 'debug') console.debug(prefix, entry.message, entry.details ?? '');
      else console.info(prefix, entry.message, entry.details ?? '');
    }

    // Persist errors to DB in production
    if (entry.level === 'error' || entry.level === 'warn') {
      void this.persistToDb(log).catch(() => { /* ignore */ });
    }

    return log;
  }

  private async persistToDb(log: LogEntry): Promise<void> {
    try {
      const { db } = await import('@/lib/db') as { db: { auditLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> } } };
      await db.auditLog.create({ data: { action: log.message, category: log.category, details: log.details ?? log.error ? JSON.stringify({ ...(log.details ?? {}), error: log.error }) : null, success: log.level !== 'error' } });
    } catch { /* ignore */ }
  }

  debug(category: string, message: string, details?: Record<string, unknown>) { return this.addLog({ level: 'debug', category, message, details }); }
  info(category: string, message: string, details?: Record<string, unknown>) { return this.addLog({ level: 'info', category, message, details }); }
  warn(category: string, message: string, details?: Record<string, unknown>) { return this.addLog({ level: 'warn', category, message, details }); }
  error(category: string, message: string, error?: Error | unknown, details?: Record<string, unknown>) {
    return this.addLog({ level: 'error', category, message, error: error instanceof Error ? error.message : String(error ?? ''), details });
  }

  getLogs(opts?: { level?: LogLevel; category?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];
    if (opts?.level) filtered = filtered.filter(l => l.level === opts.level);
    if (opts?.category) filtered = filtered.filter(l => l.category === opts.category);
    if (opts?.limit) filtered = filtered.slice(-opts.limit);
    return filtered;
  }

  clearLogs() { this.logs = []; }
}

export const logger = new NovaLogger();
