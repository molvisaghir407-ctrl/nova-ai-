/**
 * Nova AI Assistant - Logger System
 * Structured logging with levels, export capability, and performance tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

class NovaLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private logLevel: LogLevel = 'info';
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    const log: LogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.logs.push(log);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with formatting
    if (this.shouldLog(entry.level)) {
      const prefix = `[${log.timestamp.toISOString()}] [${entry.level.toUpperCase()}] [${entry.category}]`;
      const message = entry.message;

      switch (entry.level) {
        case 'debug':
          console.debug(prefix, message, entry.details || '');
          break;
        case 'info':
          console.info(prefix, message, entry.details || '');
          break;
        case 'warn':
          console.warn(prefix, message, entry.details || '');
          break;
        case 'error':
          console.error(prefix, message, entry.error || entry.details || '');
          break;
      }
    }

    return log;
  }

  debug(category: string, message: string, details?: Record<string, unknown>) {
    return this.addLog({ level: 'debug', category, message, details });
  }

  info(category: string, message: string, details?: Record<string, unknown>) {
    return this.addLog({ level: 'info', category, message, details });
  }

  warn(category: string, message: string, details?: Record<string, unknown>) {
    return this.addLog({ level: 'warn', category, message, details });
  }

  error(category: string, message: string, error?: unknown, details?: Record<string, unknown>) {
    return this.addLog({
      level: 'error',
      category,
      message,
      error: error instanceof Error ? error.message : String(error),
      details,
    });
  }

  // Performance timing helper
  time<T>(category: string, operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.debug(category, `Starting: ${operation}`);

    return fn()
      .then(result => {
        const duration = Date.now() - start;
        this.info(category, `Completed: ${operation}`, { duration: `${duration}ms` });
        return result;
      })
      .catch(error => {
        const duration = Date.now() - start;
        this.error(category, `Failed: ${operation}`, error, { duration: `${duration}ms` });
        throw error;
      });
  }

  // Get logs with filtering
  getLogs(options?: {
    level?: LogLevel;
    category?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (options?.level) {
      filtered = filtered.filter(l => l.level === options.level);
    }
    if (options?.category) {
      filtered = filtered.filter(l => l.category === options.category);
    }
    if (options?.since) {
      filtered = filtered.filter(l => l.timestamp >= options.since);
    }
    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  // Export logs for audit
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'level', 'category', 'message', 'details', 'error'];
    const rows = this.logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      log.category,
      `"${log.message.replace(/"/g, '""')}"`,
      log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : '',
      log.error ? `"${log.error.replace(/"/g, '""')}"` : '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.info('system', 'Logs cleared');
  }

  // Get log statistics
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
  } {
    const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const byCategory: Record<string, number> = {};

    for (const log of this.logs) {
      byLevel[log.level]++;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    }

    return { total: this.logs.length, byLevel, byCategory };
  }
}

// Singleton instance
export const logger = new NovaLogger();
