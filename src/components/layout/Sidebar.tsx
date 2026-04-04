'use client';
import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Globe, Brain, ListTodo, Wand2, Settings, Activity, Database, Zap, Layers, Plus, ChevronRight, MessageCircle, Trash } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ConversationMeta } from '@/types/nova.types';

export const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'search', label: 'Search', icon: Globe },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'imagine', label: 'Imagine', icon: Wand2 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs', label: 'Logs', icon: Activity },
] as const;

export type NavTab = (typeof NAV_ITEMS)[number]['id'];

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  messageCount: number;
  sessionId: string;
  tokenCount: { prompt: number; completion: number } | null;
  onNewConversation: () => void;
  onLoadConversation: (id: string) => void;
}

function ConversationList({ currentId, onSelect, onNew }: { currentId: string; onSelect: (id: string) => void; onNew: () => void }) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const apiKey = typeof window !== 'undefined' ? (window as Window & { __nova_key?: string }).__nova_key ?? '' : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/conversations', { headers: { 'x-api-key': apiKey } });
      const d = await r.json() as { conversations?: ConversationMeta[] };
      setConversations(d.conversations ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [apiKey]);

  useState(() => { load(); });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/nova/conversations?sessionId=${id}`, { method: 'DELETE', headers: { 'x-api-key': apiKey } });
    setConversations(c => c.filter(x => x.id !== id));
    if (id === currentId) onNew();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8">
        <span className="text-xs font-medium text-zinc-400">Conversations</span>
        <button onClick={onNew} aria-label="New conversation" className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs transition-colors">
          <Plus className="w-3 h-3" />New
        </button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-6"><span className="w-4 h-4 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" /></div>
        ) : conversations.length === 0 ? (
          <p className="text-center py-6 text-zinc-600 text-xs">No saved conversations</p>
        ) : (
          <div className="p-2 space-y-0.5">
            {conversations.map(conv => (
              <button key={conv.id} onClick={() => onSelect(conv.id)}
                className={cn('w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all group', currentId === conv.id ? 'bg-violet-600/20 border border-violet-500/20' : 'hover:bg-white/5 border border-transparent')}>
                <MessageCircle className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', currentId === conv.id ? 'text-violet-400' : 'text-zinc-600')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium truncate', currentId === conv.id ? 'text-violet-300' : 'text-zinc-300')}>{conv.title || 'Untitled'}</p>
                  {conv.preview && <p className="text-[10px] text-zinc-600 truncate mt-0.5">{conv.preview}</p>}
                  <p className="text-[10px] text-zinc-700 mt-0.5">{conv.messageCount} msgs</p>
                </div>
                <button onClick={e => handleDelete(conv.id, e)} aria-label="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all shrink-0">
                  <Trash className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export const Sidebar = memo(function Sidebar({ activeTab, onTabChange, messageCount, sessionId, tokenCount, onNewConversation, onLoadConversation }: SidebarProps) {
  const [showConversations, setShowConversations] = useState(false);

  return (
    <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
      className="flex flex-col border-r border-white/8 bg-zinc-900/60 shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">Nova AI</p>
            <p className="text-[10px] text-zinc-500">NVIDIA NIM · Kimi K2</p>
          </div>
        </div>
      </div>
      {/* Nav */}
      <nav className="p-2 space-y-0.5 border-b border-white/8" aria-label="Main navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { onTabChange(id); setShowConversations(false); }}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group',
              activeTab === id && !showConversations ? 'bg-violet-600/20 text-violet-300 font-medium' : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200')}
            aria-current={activeTab === id ? 'page' : undefined}>
            <Icon className={cn('w-4 h-4 shrink-0', activeTab === id && !showConversations ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-400')} aria-hidden />
            {label}
            {id === 'chat' && messageCount > 0 && <span className="ml-auto text-[10px] bg-violet-600/25 text-violet-400 px-1.5 py-0.5 rounded-full">{messageCount}</span>}
          </button>
        ))}
      </nav>
      {/* Conversations toggle */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button onClick={() => setShowConversations(s => !s)}
          className={cn('flex items-center gap-2 px-3 py-2.5 text-xs transition-colors border-b border-white/8', showConversations ? 'text-violet-400 bg-violet-600/10' : 'text-zinc-500 hover:text-zinc-300')}
          aria-expanded={showConversations}>
          <Layers className="w-3.5 h-3.5" aria-hidden />
          <span>All Conversations</span>
          <ChevronRight className={cn('w-3 h-3 ml-auto transition-transform', showConversations && 'rotate-90')} aria-hidden />
        </button>
        <AnimatePresence>
          {showConversations && (
            <motion.div initial={{ height: 0 }} animate={{ height: '100%' }} exit={{ height: 0 }} className="flex-1 overflow-hidden">
              <ConversationList currentId={sessionId} onSelect={onLoadConversation} onNew={onNewConversation} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Footer stats */}
      <div className="p-3 border-t border-white/8 shrink-0">
        <div className="p-2.5 rounded-xl bg-white/4 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Database className="w-3 h-3" aria-hidden /><span>Memory active</span>
            <span className="ml-auto text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" aria-hidden />Live</span>
          </div>
          {tokenCount && <div className="text-[10px] text-zinc-600 flex items-center gap-1"><Zap className="w-2.5 h-2.5" aria-hidden />{tokenCount.prompt}↑ {tokenCount.completion}↓ tokens</div>}
        </div>
      </div>
    </motion.aside>
  );
});
