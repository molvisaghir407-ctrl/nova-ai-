'use client';
import { useState, useRef, useEffect, memo } from 'react';
import { Brain, ChevronUp, ChevronDown, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
}

export const ThinkingBlock = memo(function ThinkingBlock({
  content,
  isStreaming,
  duration,
}: ThinkingBlockProps) {
  // Auto-expand while streaming, auto-collapse when done
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const wasStreaming = useRef(false);

  // Auto-scroll while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current && content.length !== prevLen.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevLen.current = content.length;
    }
  }, [content, isStreaming]);

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      const timer = setTimeout(() => setExpanded(false), 800);
      return () => clearTimeout(timer);
    }
    wasStreaming.current = !!isStreaming;
  }, [isStreaming]);

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'mb-3 rounded-2xl overflow-hidden border transition-all duration-500',
        isStreaming
          ? 'border-violet-500/40 bg-violet-950/25 thinking-glow'
          : 'border-violet-500/15 bg-violet-950/10 hover:border-violet-500/25',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-label={expanded ? 'Collapse thinking' : 'Expand thinking'}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-500/8 transition-colors duration-200 cursor-pointer group"
      >
        {/* Animated brain icon */}
        <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
          {isStreaming ? (
            <>
              <Brain className="w-3.5 h-3.5 text-violet-400 relative z-10" />
              <span className="orbit-dot-1 absolute w-1 h-1 rounded-full bg-violet-400/70" />
              <span className="orbit-dot-2 absolute w-1 h-1 rounded-full bg-fuchsia-400/70" />
              <span className="orbit-dot-3 absolute w-1 h-1 rounded-full bg-violet-300/60" />
            </>
          ) : (
            <Lightbulb className="w-3.5 h-3.5 text-violet-400/70 group-hover:text-violet-400 transition-colors" />
          )}
        </div>

        {/* Label */}
        <span className={cn('text-xs font-medium flex-1 transition-all duration-300', isStreaming ? 'thinking-shimmer' : 'text-violet-400/80')}>
          {isStreaming
            ? 'Thinking...'
            : duration
              ? `Thought for ${(duration / 1000).toFixed(1)}s`
              : 'Reasoning'}
        </span>

        {/* Stats */}
        <span className="text-[10px] text-violet-500/40 mr-1">
          {wordCount.toLocaleString()} words
        </span>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronUp className="w-3 h-3 text-violet-500/40 shrink-0" />
        </motion.div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="thinking-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2 },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div
              ref={scrollRef}
              className="px-4 pb-4 max-h-56 overflow-y-auto border-t border-violet-500/10 scroll-smooth"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.2) transparent' }}
            >
              <p className="text-[11px] text-violet-300/55 whitespace-pre-wrap font-mono leading-relaxed pt-3 select-text">
                {content}
                {isStreaming && (
                  <span className="inline-block w-1 h-3 bg-violet-400/60 ml-0.5 animate-pulse rounded-sm" />
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
