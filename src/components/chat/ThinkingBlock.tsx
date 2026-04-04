'use client';
import { useState, useRef, useEffect, memo } from 'react';
import { Brain, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
}

export const ThinkingBlock = memo(function ThinkingBlock({ content, isStreaming, duration }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);

  useEffect(() => {
    if (isStreaming && scrollRef.current && content.length !== prevLen.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevLen.current = content.length;
    }
  }, [content, isStreaming]);

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={cn('mb-3 rounded-2xl overflow-hidden border transition-colors duration-300',
        isStreaming ? 'border-violet-500/40 bg-violet-950/25 thinking-glow' : 'border-violet-500/15 bg-violet-950/10')}>
      <button onClick={() => setExpanded(e => !e)} aria-label="Toggle thinking"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-500/8 transition-colors">
        <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-violet-400 relative z-10" />
          {isStreaming && (
            <>
              <span className="orbit-dot-1 absolute w-1 h-1 rounded-full bg-violet-400/70" />
              <span className="orbit-dot-2 absolute w-1 h-1 rounded-full bg-fuchsia-400/70" />
              <span className="orbit-dot-3 absolute w-1 h-1 rounded-full bg-violet-300/60" />
            </>
          )}
        </div>
        <span className={cn('text-xs font-medium flex-1', isStreaming ? 'thinking-shimmer' : 'text-violet-400/80')}>
          {isStreaming ? 'Thinking...' : duration ? `Thought for ${(duration / 1000).toFixed(1)}s` : 'Reasoning'}
        </span>
        <span className="text-[10px] text-violet-500/40">{content.length.toLocaleString()} chars</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-violet-500/40 shrink-0" /> : <ChevronDown className="w-3 h-3 text-violet-500/40 shrink-0" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div ref={scrollRef} className="px-4 pb-3 max-h-52 overflow-y-auto border-t border-violet-500/10">
              <p className="text-[11px] text-violet-300/55 whitespace-pre-wrap font-mono leading-relaxed pt-2">{content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
