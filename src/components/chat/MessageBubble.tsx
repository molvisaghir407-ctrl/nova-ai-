'use client';
import { useState, memo } from 'react';
import { User, Sparkles, Copy, CheckCircle, Zap, Globe, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { StreamingText } from './StreamingText';
import { ThinkingBlock } from './ThinkingBlock';
import type { ExtMessage, Source } from '@/types/nova.types';
import { cn } from '@/lib/utils';

function SourcePills({ sources }: { sources: Source[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 3);
  return (
    <div className="mt-2 space-y-1.5">
      <span className="text-[10px] text-zinc-600 flex items-center gap-1"><Globe className="w-2.5 h-2.5" />Sources</span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s, i) => (
          <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.snippet}
            className="source-pill flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-white/8 hover:bg-zinc-700 hover:border-violet-500/30 text-[10px] text-zinc-500 hover:text-zinc-200 transition-all group"
            style={{ animationDelay: `${i * 50}ms` }}>
            <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
            <span className="truncate max-w-[110px]">{s.domain || s.title}</span>
          </a>
        ))}
        {sources.length > 3 && (
          <button onClick={() => setShowAll(s => !s)} className="px-2 py-1 rounded-lg bg-zinc-800/60 border border-white/6 text-[10px] text-zinc-600 hover:text-zinc-300">
            {showAll ? 'Less' : `+${sources.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ExtMessage;
  isStreaming?: boolean;
  thinkingStreaming?: boolean;
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, thinkingStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>

      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm',
        isUser ? 'bg-gradient-to-br from-blue-500 to-violet-600' : 'bg-gradient-to-br from-violet-600 to-fuchsia-600')}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
      </div>

      <div className={cn('flex flex-col gap-1.5 min-w-0', isUser ? 'items-end max-w-[78%]' : 'items-start max-w-[85%] flex-1')}>

        {!isUser && isStreaming && !message.thinking && !message.content && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/60 border border-white/8 text-xs text-zinc-400">
            <Globe className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span>Searching...</span>
            {[0, 0.15, 0.3].map(d => <span key={d} className="w-1 h-1 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: `${d}s` }} />)}
          </motion.div>
        )}

        {!isUser && message.thinking && (
          <div className="w-full">
            <ThinkingBlock content={message.thinking} isStreaming={thinkingStreaming} duration={message.thinkingDuration} />
          </div>
        )}

        {(message.content || (isStreaming && !thinkingStreaming)) && (
          <div className={cn('relative rounded-2xl text-sm',
            isUser ? 'bg-gradient-to-br from-blue-600 to-violet-700 text-white rounded-tr-sm px-4 py-3' : 'bg-zinc-800/70 border border-white/8 text-zinc-100 rounded-tl-sm px-4 py-3 w-full')}>
            {isUser ? (
              <>
                {message.images?.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img} alt="attachment" className="max-h-48 rounded-xl object-cover border border-white/20 mb-2" />
                ))}
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </>
            ) : (
              <StreamingText content={message.content} isStreaming={!!isStreaming} />
            )}
          </div>
        )}

        {!isUser && !isStreaming && message.ragUsed && message.sources && message.sources.length > 0 && (
          <SourcePills sources={message.sources} />
        )}

        <div className={cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]', isUser ? 'flex-row-reverse' : '')}>
          <span className="text-zinc-600">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {!isUser && (
            <button onClick={copy} aria-label="Copy message" className="text-zinc-600 hover:text-zinc-400">
              {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {message.duration !== undefined && !isStreaming && <span className="text-zinc-700 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{(message.duration / 1000).toFixed(1)}s</span>}
          {message.ragUsed === true && <span className="text-violet-600/70 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />web</span>}
        </div>
      </div>
    </motion.div>
  );
});
