'use client';

import { useState } from 'react';
import { Copy, Check, RotateCcw, Globe } from 'lucide-react';
import { StreamingText } from './StreamingText';
import { ThinkingBlock } from './ThinkingBlock';
import { ArtifactRenderer } from './ArtifactRenderer';
import type { ExtMessage } from '@/types/nova.types';

interface MessageBubbleProps {
  message: ExtMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

export function MessageBubble({ message, isStreaming = false, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`nova-message-row flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`nova-bubble-inner max-w-[85%] ${isUser ? 'max-w-[75%]' : 'max-w-[85%]'}`}>
        {/* Thinking block */}
        {!isUser && message.thinking && (
          <ThinkingBlock
            thinking={message.thinking}
            isStreaming={isStreaming && message.isThinking}
            duration={message.thinkingDuration}
          />
        )}

        {/* Waiting indicator */}
        {!isUser && isStreaming && !message.thinking && !message.content && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/50">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-zinc-500">Nova is thinking...</span>
          </div>
        )}

        {/* Main message bubble */}
        {(message.content || (isStreaming && !message.isThinking)) && (
          <div
            className={`relative px-4 py-3 rounded-2xl ${
              isUser
                ? 'bg-violet-600/20 border border-violet-500/20 text-zinc-100'
                : 'bg-zinc-900/60 border border-zinc-800/50 text-zinc-200'
            }`}
          >
            {isUser ? (
              <>
                {message.images?.map((img, i) => (
                  <img key={i} src={img} alt="Uploaded" className="max-w-[200px] rounded-lg mb-2 border border-zinc-700" />
                ))}
                <p className="text-[15px] leading-relaxed">{message.content}</p>
              </>
            ) : (
              <StreamingText content={message.content} isStreaming={isStreaming && !message.isThinking} />
            )}

            {/* Artifacts */}
            {!isUser && message.artifacts && message.artifacts.length > 0 && (
              <div className="mt-3">
                {message.artifacts.map((artifact) => (
                  <ArtifactRenderer key={artifact.id} artifact={artifact} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Source pills */}
        {!isUser && !isStreaming && message.ragUsed && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.sources.map((source, i) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-pill inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-900/60 border border-zinc-800/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-violet-500/30 transition-all"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Globe className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{source.domain || source.title}</span>
              </a>
            ))}
          </div>
        )}

        {/* Meta actions */}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-[11px] text-zinc-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {!isUser && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
              title="Copy"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-600" />}
            </button>
          )}

          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
              title="Regenerate"
            >
              <RotateCcw className="w-3 h-3 text-zinc-600" />
            </button>
          )}

          {message.duration !== undefined && !isStreaming && (
            <span className="text-[11px] text-zinc-600 ml-auto">
              {(message.duration / 1000).toFixed(1)}s
            </span>
          )}

          {message.ragUsed === true && (
            <span className="text-[11px] text-violet-500/60 ml-auto flex items-center gap-0.5">
              <Globe className="w-3 h-3" />
              web
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
