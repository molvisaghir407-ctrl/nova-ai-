'use client';
import { useState, memo } from 'react';
import { User, Sparkles, Copy, CheckCircle, Zap, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StreamingText } from './StreamingText';
import { ThinkingBlock } from './ThinkingBlock';
import type { ExtMessage, Source } from '@/types/nova.types';
import { cn } from '@/lib/utils';

// ── Source pills ──────────────────────────────────────────────────────────────
function SourcePills({ sources }: { sources: Source[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
      className="mt-3 space-y-2"
    >
      <span className="text-[10px] text-zinc-600 flex items-center gap-1.5 font-medium uppercase tracking-wider">
        <Globe className="w-2.5 h-2.5 text-violet-500/50" />
        {sources.length} source{sources.length !== 1 ? 's' : ''} used
      </span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s, i) => (
          <motion.a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.snippet?.slice(0, 120)}
            initial={{ opacity: 0, scale: 0.9, y: 3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.18 }}
            className="source-pill flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-white/8 hover:bg-zinc-700/80 hover:border-violet-500/40 text-[10px] text-zinc-500 hover:text-zinc-200 transition-all duration-200 group cursor-pointer"
          >
            <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
            <span className="truncate max-w-[120px]">{s.domain || s.title}</span>
            <span className="text-violet-600/50 font-mono text-[9px] shrink-0">[{s.id}]</span>
          </motion.a>
        ))}
        {sources.length > 4 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-white/6 text-[10px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700/60 hover:border-white/10 transition-all duration-200 cursor-pointer"
          >
            {showAll ? '↑ Less' : `+${sources.length - 4} more`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Loading shimmer (while waiting for first token) ───────────────────────────
function WaitingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-800/70 border border-white/8 w-fit"
    >
      <RefreshCw className="w-3.5 h-3.5 text-violet-400/70 animate-spin" />
      <div className="flex gap-1">
        {[0, 0.15, 0.3].map(d => (
          <span
            key={d}
            className="w-1.5 h-1.5 rounded-full bg-violet-400/50 animate-bounce"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Main bubble ───────────────────────────────────────────────────────────────
interface MessageBubbleProps {
  message: ExtMessage;
  isStreaming?: boolean;
  thinkingStreaming?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  thinkingStreaming,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn('group flex gap-3 nova-message-row', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-md transition-transform duration-200 group-hover:scale-105',
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-violet-600 shadow-blue-900/30'
            : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-violet-900/30',
        )}
      >
        {isUser
          ? <User className="w-4 h-4 text-white" />
          : <Sparkles className="w-4 h-4 text-white" />
        }
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex flex-col gap-1.5 min-w-0',
          isUser ? 'items-end max-w-[78%]' : 'items-start max-w-[88%] flex-1',
        )}
      >
        {/* Thinking block */}
        {!isUser && message.thinking && (
          <div className="w-full">
            <ThinkingBlock
              content={message.thinking}
              isStreaming={thinkingStreaming}
              duration={message.thinkingDuration}
            />
          </div>
        )}

        {/* Waiting indicator — before any content or thinking arrives */}
        {!isUser && isStreaming && !message.thinking && !message.content && (
          <WaitingIndicator />
        )}

        {/* Main message bubble */}
        {(message.content || (isStreaming && !thinkingStreaming)) && (
          <div
            className={cn(
              'relative rounded-2xl text-sm transition-all duration-200',
              isUser
                ? 'bg-gradient-to-br from-blue-600 to-violet-700 text-white rounded-tr-sm px-4 py-3'
                : 'bg-zinc-800/70 border border-white/8 text-zinc-100 rounded-tl-sm px-4 py-3 w-full hover:border-white/12 nova-bubble-inner',
            )}
          >
            {isUser ? (
              <>
                {message.images?.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={img}
                    alt="attachment"
                    className="max-h-48 rounded-xl object-cover border border-white/20 mb-2 shadow-sm"
                  />
                ))}
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </>
            ) : (
              <StreamingText content={message.content} isStreaming={!!isStreaming} />
            )}
          </div>
        )}

        {/* Source pills */}
        {!isUser && !isStreaming && message.ragUsed && message.sources && message.sources.length > 0 && (
          <SourcePills sources={message.sources} />
        )}

        {/* Meta actions — visible on hover */}
        <AnimatePresence>
          <div
            className={cn(
              'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[10px]',
              isUser ? 'flex-row-reverse' : '',
            )}
          >
            <span className="text-zinc-600">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {!isUser && (
              <button
                onClick={copy}
                aria-label="Copy message"
                className="text-zinc-600 hover:text-zinc-300 transition-colors duration-150 cursor-pointer p-0.5 rounded hover:bg-white/8"
              >
                {copied
                  ? <CheckCircle className="w-3 h-3 text-green-400" />
                  : <Copy className="w-3 h-3" />
                }
              </button>
            )}

            {message.duration !== undefined && !isStreaming && (
              <span className="text-zinc-700 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                {(message.duration / 1000).toFixed(1)}s
              </span>
            )}

            {message.ragUsed === true && (
              <span className="text-violet-600/60 flex items-center gap-0.5">
                <Globe className="w-2.5 h-2.5" />web
              </span>
            )}
          </div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
