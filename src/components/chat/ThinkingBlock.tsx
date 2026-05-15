'use client';
import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { ChevronUp, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThinkingBlockProps {
  content     : string;
  isStreaming?: boolean;
  duration?   : number;
}

// ── Thinking phases ───────────────────────────────────────────────────────────
const PHASES = [
  { id: 'analyze',    label: 'Analyzing',    color: '#818cf8' },
  { id: 'reason',     label: 'Reasoning',    color: '#a78bfa' },
  { id: 'synthesize', label: 'Synthesizing', color: '#c084fc' },
  { id: 'verify',     label: 'Verifying',    color: '#e879f9' },
] as const;

function getPhase(streaming: boolean, wc: number) {
  if (!streaming) return PHASES[3];
  if (wc > 120) return PHASES[3];
  if (wc > 50)  return PHASES[2];
  if (wc > 15)  return PHASES[1];
  return PHASES[0];
}

// ── Neural SVG animation ──────────────────────────────────────────────────────
function NeuralPulse({ color, active }: { color: string; active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
      <circle cx="11" cy="11" r="9"
        stroke={color} strokeWidth="1" strokeDasharray="4 2"
        opacity={active ? 0.55 : 0.18}
        style={active ? { animation: 'ds-ring-spin 3s linear infinite' } : undefined}
      />
      <circle cx="11" cy="11" r="5.5"
        stroke={color} strokeWidth="1.2"
        opacity={active ? 0.75 : 0.28}
        style={active ? { animation: 'ds-ring-spin 1.8s linear infinite reverse' } : undefined}
      />
      <circle cx="11" cy="11" r="2.4"
        fill={color} opacity={active ? 1 : 0.35}
        style={active ? { animation: 'ds-core-pulse 1.1s ease-in-out infinite' } : undefined}
      />
      {active && (
        <>
          <circle cx="11" cy="2.5" r="1.2" fill={color} opacity="0.7"
            style={{ animation: 'ds-orbit-1 1.6s linear infinite', transformOrigin: '11px 11px' }} />
          <circle cx="11" cy="2.5" r="1"   fill={color} opacity="0.5"
            style={{ animation: 'ds-orbit-2 2.2s linear infinite', transformOrigin: '11px 11px' }} />
          <circle cx="11" cy="2.5" r="0.8" fill={color} opacity="0.4"
            style={{ animation: 'ds-orbit-3 1.3s linear infinite', transformOrigin: '11px 11px' }} />
        </>
      )}
    </svg>
  );
}

// ── Highlight reasoning connectives ──────────────────────────────────────────
const MARKERS = [
  { re: /\b(therefore|thus|hence|consequently)\b/gi, cls: 'text-violet-300 font-medium' },
  { re: /\b(because|since|given that|assuming)\b/gi, cls: 'text-blue-300/85'            },
  { re: /\b(however|but|although|yet|nevertheless)\b/gi, cls: 'text-amber-300/85'       },
  { re: /\b(first|second|third|finally|step \d)\b/gi, cls: 'text-emerald-300/80'        },
  { re: /\b(important|critical|note that|key)\b/gi,  cls: 'text-rose-300/80'            },
];

function HighlightThought({ text }: { text: string }) {
  const parts: Array<{ t: string; cls?: string }> = [];
  let rem = text, guard = 0;
  while (rem.length && guard++ < 3000) {
    let best: { idx: number; len: number; cls: string } | null = null;
    for (const { re, cls } of MARKERS) {
      re.lastIndex = 0;
      const m = re.exec(rem);
      if (m && (!best || m.index < best.idx)) best = { idx: m.index, len: m[0].length, cls };
    }
    if (!best) { parts.push({ t: rem }); break; }
    if (best.idx > 0) parts.push({ t: rem.slice(0, best.idx) });
    parts.push({ t: rem.slice(best.idx, best.idx + best.len), cls: best.cls });
    rem = rem.slice(best.idx + best.len);
  }
  return (
    <>
      {parts.map((p, i) =>
        p.cls ? <span key={i} className={p.cls}>{p.t}</span> : <span key={i}>{p.t}</span>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export const ThinkingBlock = memo(function ThinkingBlock({ content, isStreaming, duration }: ThinkingBlockProps) {
  const [expanded,   setExpanded]   = useState(true);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const wasStream  = useRef(false);
  const prevLen    = useRef(0);

  const wc    = useMemo(() => content.split(/\s+/).filter(Boolean).length, [content]);
  const phase = useMemo(() => getPhase(!!isStreaming, wc), [isStreaming, wc]);

  // Auto-scroll
  useEffect(() => {
    if (isStreaming && content.length !== prevLen.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevLen.current = content.length;
    }
  }, [content, isStreaming]);

  // Auto-collapse
  useEffect(() => {
    if (wasStream.current && !isStreaming) {
      const t = setTimeout(() => setExpanded(false), 900);
      return () => clearTimeout(t);
    }
    wasStream.current = !!isStreaming;
  }, [isStreaming]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ duration: 0.27, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'mb-3 rounded-2xl overflow-hidden border transition-all duration-500',
        isStreaming
          ? 'border-violet-500/40 bg-violet-950/20 ds-thinking-glow'
          : 'border-violet-500/15 bg-violet-950/10 hover:border-violet-500/25',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-500/6 transition-colors duration-200 cursor-pointer group"
        aria-label={expanded ? 'Collapse thinking' : 'Expand thinking'}
      >
        <NeuralPulse color={phase.color} active={!!isStreaming} />

        <div className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden">
          {isStreaming ? (
            <>
              <span
                className="text-xs font-medium ds-phase-shimmer shrink-0"
                style={{ '--phase-color': phase.color } as React.CSSProperties}
              >
                {phase.label}…
              </span>
              {/* Phase pills */}
              <div className="hidden sm:flex items-center gap-2">
                {PHASES.map(p => (
                  <span
                    key={p.id}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full border transition-all duration-500',
                      p.id === phase.id
                        ? 'border-current opacity-100 font-medium'
                        : 'border-transparent opacity-20',
                    )}
                    style={{ color: p.color, borderColor: p.id === phase.id ? p.color : undefined }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-violet-400/65">
              <CheckCircle2 className="w-3 h-3 text-violet-400/45" />
              {duration ? `Thought for ${(duration / 1000).toFixed(1)}s` : 'Reasoning complete'}
            </span>
          )}
        </div>

        <span className="text-[10px] text-violet-500/32 mr-1 tabular-nums shrink-0">
          {wc.toLocaleString()}w
        </span>

        <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronUp className="w-3.5 h-3.5 text-violet-500/32 shrink-0" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={  { height: 0, opacity: 0 }}
            transition={{
              height:  { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2 },
            }}
            style={{ overflow: 'hidden' }}
          >
            {isStreaming && (
              <div className="h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent ds-progress-sweep" />
            )}
            <div
              ref={scrollRef}
              className="px-4 pb-4 max-h-64 overflow-y-auto border-t border-violet-500/10 scroll-smooth"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}
            >
              <p className="text-[11px] text-violet-300/52 whitespace-pre-wrap font-mono leading-relaxed pt-3 select-text">
                <HighlightThought text={content} />
                {isStreaming && (
                  <span className="inline-block w-[2px] h-[13px] bg-violet-400/70 ml-0.5 align-middle ds-cursor-blink rounded-sm" />
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
