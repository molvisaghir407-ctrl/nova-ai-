'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
  duration?: number;
}

export function ThinkingBlock({ thinking, isStreaming = false, duration }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = thinking && thinking.length > 0;

  if (!hasContent && !isStreaming) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10 hover:border-violet-500/20 transition-all w-full text-left group"
      >
        <div className="brain-container relative w-5 h-5 flex items-center justify-center">
          {isStreaming ? (
            <>
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
              <div className="neuron-dot absolute w-1 h-1 bg-violet-400 rounded-full" />
            </>
          ) : (
            <Sparkles className="w-4 h-4 text-violet-400" />
          )}
        </div>
        <span className="text-sm font-medium text-violet-300">
          {isStreaming ? 'Thinking...' : 'Reasoning'}
        </span>
        {duration !== undefined && !isStreaming && (
          <span className="text-xs text-zinc-500 ml-auto">{(duration / 1000).toFixed(1)}s</span>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500 ml-auto" />
        )}
      </button>

      <div className={`reasoning-chain ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="mt-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <div className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed font-mono text-[13px]">
            {thinking || (isStreaming ? (
              <span className="thinking-shimmer">Processing reasoning chain...</span>
            ) : '')}
          </div>
        </div>
      </div>
    </div>
  );
}
