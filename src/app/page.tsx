'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Menu, Plus, Trash2, MessageSquare, Zap, Sparkles } from 'lucide-react';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useNovaStore } from '@/lib/nova/store';
import type { StreamEvent, ExtMessage, ArtifactData } from '@/types/nova.types';

export default function Home() {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const messages = useNovaStore((s) => s.messages);
  const sessions = useNovaStore((s) => s.sessions);
  const addMessage = useNovaStore((s) => s.addMessage);
  const updateLastMessage = useNovaStore((s) => s.updateLastMessage);
  const clearMessages = useNovaStore((s) => s.clearMessages);
  const isThinkingMode = useNovaStore((s) => s.isThinkingMode);
  const setStreaming = useNovaStore((s) => s.setStreaming);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const extractArtifacts = (content: string): { text: string; artifacts: ArtifactData[] } => {
    const artifacts: ArtifactData[] = [];
    let idCounter = 0;

    // Extract code blocks as artifacts
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let cleanedText = content;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      if (code.length > 100) {
        const artifact: ArtifactData = {
          id: `art-${Date.now()}-${idCounter++}`,
          type: 'code',
          title: `${language.charAt(0).toUpperCase() + language.slice(1)} Code`,
          language,
          content: code,
        };
        artifacts.push(artifact);
      }
    }

    return { text: cleanedText, artifacts };
  };

  const handleSend = async () => {
    if ((!input.trim() && images.length === 0) || isProcessing) return;

    const userMsg = input.trim();
    setInput('');
    setImages([]);
    setIsProcessing(true);
    setStreaming(true);

    const userMessageId = addMessage({
      role: 'user',
      content: userMsg,
      images: images.length > 0 ? images : undefined,
    });

    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      isThinking: isThinkingMode,
    });

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          images,
          enableThinking: isThinkingMode,
          stream: true,
          maxTokens: 16000,
          includeContext: true,
          enableRAG: true,
          ragThreshold: 100,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let fullThinking = '';
      let thinkingDuration = 0;
      let thinkingStart = 0;
      let sources: StreamEvent['sources'] = [];
      let ragUsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json) as StreamEvent;

            if (event.type === 'thinking') {
              if (!thinkingStart) thinkingStart = Date.now();
              fullThinking += event.content || '';
              updateLastMessage(assistantMessageId, '', fullThinking, undefined, { isThinking: true });
            } else if (event.type === 'content') {
              if (thinkingStart && !thinkingDuration) {
                thinkingDuration = Date.now() - thinkingStart;
              }
              fullContent += event.content || '';
              updateLastMessage(assistantMessageId, fullContent, fullThinking, undefined, {
                isThinking: false,
                thinkingDuration,
              });
            } else if (event.type === 'rag') {
              sources = event.sources;
              ragUsed = true;
            } else if (event.type === 'error') {
              toast.error(event.message || 'Stream error');
            } else if (event.type === 'done') {
              const { text, artifacts } = extractArtifacts(fullContent);
              updateLastMessage(assistantMessageId, text, fullThinking, event.duration, {
                sources,
                ragUsed,
                thinkingDuration,
                artifacts,
                isThinking: false,
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(err.message.slice(0, 100));
        updateLastMessage(assistantMessageId, `Error: ${err.message.slice(0, 200)}`, undefined, undefined, { isThinking: false });
      }
    } finally {
      setIsProcessing(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleNewChat = () => {
    clearMessages();
    setInput('');
    setImages([]);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div className="mobile-sidebar-backdrop md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          mobileSidebarOpen ? 'mobile-sidebar-fixed' : 'hidden md:flex'
        } w-[260px] flex-col border-r border-zinc-800/50 bg-[#09090b]`}
      >
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 transition-colors text-sm text-zinc-400 hover:text-zinc-200 truncate"
                >
                  {session.title || 'New conversation'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-500">Nova AI Online</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-zinc-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h1 className="font-semibold text-sm">Nova AI</h1>
              {isThinkingMode && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  THINK
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-red-400 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="nova-scroll-area flex-1 overflow-y-auto px-4 py-6"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Nova AI</h2>
              <p className="text-zinc-500 text-sm max-w-md mb-6">
                DeepSeek reasoning · Grok-speed UI · Claude artifacts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {[
                  'Explain quantum computing simply',
                  'Build a React todo app',
                  'Analyze the latest tech trends',
                  'Solve this math problem step by step',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); }}
                    className="prompt-card text-left px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-all text-sm text-zinc-400 hover:text-zinc-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-1">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isProcessing && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800/50 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onImageAdd={(imgs) => setImages((prev) => [...prev, ...imgs])}
              selectedImages={images}
              onImageRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              isProcessing={isProcessing}
            />
            <p className="text-center text-[11px] text-zinc-700 mt-2">
              Nova AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
