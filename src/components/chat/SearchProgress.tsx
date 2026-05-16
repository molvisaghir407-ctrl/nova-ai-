'use client';
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Scan, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SearchSourceCard {
  url   : string;
  title : string;
  domain: string;
  status: 'searching' | 'scanning' | 'reading' | 'done' | 'error';
}

interface SearchProgressProps {
  sources    : SearchSourceCard[];
  isSearching: boolean;
  query?     : string;
}

// ── Favicon via Google S2 ─────────────────────────────────────────────────────
function Favicon({ domain }: { domain: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      alt=""
      className="w-3.5 h-3.5 rounded-sm shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: SearchSourceCard['status'] }) {
  if (status === 'done') {
    return (
      <span className="flex items-center gap-1 text-[9px] text-emerald-400/80 shrink-0">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Done
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-[9px] text-red-400/70 shrink-0">
        <XCircle className="w-2.5 h-2.5" />
        Error
      </span>
    );
  }
  if (status === 'reading' || status === 'scanning') {
    return (
      <span className="flex items-center gap-1 text-[9px] text-violet-400/80 shrink-0">
        <Scan className="w-2.5 h-2.5 animate-pulse" />
        {status === 'scanning' ? 'Scanning' : 'Reading'}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[9px] text-blue-400/80 shrink-0">
      <Loader2 className="w-2.5 h-2.5 animate-spin" />
      Searching
    </span>
  );
}

// ── Single source card ────────────────────────────────────────────────────────
function SourceCard({ src, index }: { src: SearchSourceCard; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12, scale: 0.96 }}
      animate={{ opacity: 1, x: 0,   scale: 1    }}
      exit={  { opacity: 0, x:  12,  scale: 0.96 }}
      transition={{
        delay   : index * 0.06,
        duration: 0.22,
        ease    : [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all duration-300',
        src.status === 'done'
          ? 'bg-emerald-950/20 border-emerald-500/15 text-zinc-400'
          : src.status === 'error'
          ? 'bg-red-950/20 border-red-500/15 text-zinc-500'
          : 'bg-zinc-900/70 border-violet-500/20 text-zinc-300',
      )}
    >
      {/* Favicon */}
      <Favicon domain={src.domain} />

      {/* Domain + title */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-zinc-500 block leading-none mb-0.5">{src.domain}</span>
        <span className="truncate text-[11px] leading-snug font-medium text-zinc-300 block">
          {src.title || src.url.slice(0, 50)}
        </span>
      </div>

      {/* Status */}
      <StatusChip status={src.status} />

      {/* Scanning line overlay for active cards */}
      {(src.status === 'searching' || src.status === 'scanning' || src.status === 'reading') && (
        <div className="absolute inset-x-0 bottom-0 h-[1px] overflow-hidden rounded-b-xl">
          <div className="h-full bg-gradient-to-r from-transparent via-violet-500/60 to-transparent search-scan-line" />
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const SearchProgress = memo(function SearchProgress({
  sources,
  isSearching,
  query,
}: SearchProgressProps) {
  const show = isSearching || sources.length > 0;
  if (!show) return null;

  const doneCount     = sources.filter(s => s.status === 'done').length;
  const activeCount   = sources.filter(s => s.status !== 'done' && s.status !== 'error').length;
  const isAllDone     = sources.length > 0 && activeCount === 0 && !isSearching;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,   scale: 1    }}
      exit={  { opacity: 0, y: -6,   scale: 0.99 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="mb-3 max-w-3xl mx-auto"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <Globe
            className={cn(
              'w-3.5 h-3.5 text-violet-400 shrink-0',
              !isAllDone && 'animate-spin',
            )}
          />
          <span className="text-xs text-violet-400/80 font-medium">
            {isAllDone
              ? `Found ${doneCount} source${doneCount !== 1 ? 's' : ''}`
              : isSearching && !sources.length
              ? 'Searching the web…'
              : `Researching ${sources.length} source${sources.length !== 1 ? 's' : ''}…`
            }
          </span>
        </div>

        {query && (
          <span className="text-[10px] text-zinc-600 truncate flex-1">
            "{query.slice(0, 60)}{query.length > 60 ? '…' : ''}"
          </span>
        )}

        {/* Pulsing dots during active search */}
        {!isAllDone && (
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {[0, 0.2, 0.4].map(d => (
              <span
                key={d}
                className="w-1 h-1 rounded-full bg-violet-400/60 animate-bounce"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Source cards */}
      {sources.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 relative">
          <AnimatePresence>
            {sources.map((src, i) => (
              <SourceCard key={src.url} src={src} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
});
