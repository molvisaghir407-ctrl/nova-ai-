'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Settings, Brain, ListTodo, Send, Sparkles,
  Trash2, Plus, Check, Globe, X, Copy, CheckCircle,
  Zap, Activity, FileCode2, Search, Volume2, RefreshCw, Wand2,
  Infinity, Paperclip, PanelLeft, Newspaper, TrendingUp, Download,
  Cpu, Wifi, BookOpen, Hash, ImageIcon, Layers, ChevronRight,
  Trash, MessageCircle, Bot, Lightbulb, FlaskConical, Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNovaStore } from '@/lib/nova/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { SearchProgress } from '@/components/chat/SearchProgress';
import type { SearchSourceCard } from '@/components/chat/SearchProgress';
import type { ExtMessage, Source, ConversationMeta, StreamEvent } from '@/types/nova.types';
import { cn } from '@/lib/utils';

declare global { interface Window { __nova_key?: string } }

// ── Conversation history ──────────────────────────────────────────────────────
function ConversationHistory({
  currentSessionId, onSelect, onNew, onDelete,
}: {
  currentSessionId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/conversations', { headers: { 'x-api-key': window.__nova_key ?? '' } });
      const d = await r.json() as { conversations?: ConversationMeta[] };
      setConversations(d.conversations ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/nova/conversations?sessionId=${id}`, { method: 'DELETE', headers: { 'x-api-key': window.__nova_key ?? '' } });
    setConversations(c => c.filter(x => x.id !== id));
    onDelete(id);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const grouped = conversations.reduce<{ today: ConversationMeta[]; yesterday: ConversationMeta[]; older: ConversationMeta[] }>((acc, c) => {
    const diff = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 86400000);
    if (diff === 0) acc.today.push(c);
    else if (diff === 1) acc.yesterday.push(c);
    else acc.older.push(c);
    return acc;
  }, { today: [], yesterday: [], older: [] });

  const ConvItem = ({ conv }: { conv: ConversationMeta }) => (
    <div
      onClick={() => onSelect(conv.id)}
      className={cn(
        'group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200',
        currentSessionId === conv.id
          ? 'bg-violet-600/15 border border-violet-500/20 shadow-sm'
          : 'hover:bg-white/5 border border-transparent hover:border-white/6',
      )}
    >
      <MessageCircle className={cn('w-3.5 h-3.5 shrink-0 mt-0.5 transition-colors', currentSessionId === conv.id ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-500')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium truncate transition-colors', currentSessionId === conv.id ? 'text-violet-300' : 'text-zinc-400 group-hover:text-zinc-200')}>
          {conv.title || 'Untitled'}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{formatTime(conv.updatedAt)} · {conv.messageCount} msgs</p>
      </div>
      <button
        onClick={e => handleDelete(conv.id, e)}
        aria-label="Delete conversation"
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all duration-150 shrink-0 cursor-pointer"
      >
        <Trash className="w-3 h-3" />
      </button>
    </div>
  );

  const Section = ({ label, items }: { label: string; items: ConversationMeta[] }) => {
    if (!items.length) return null;
    return (
      <div className="mb-2">
        <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider px-3 py-1.5">{label}</p>
        <div className="space-y-0.5">{items.map(c => <ConvItem key={c.id} conv={c} />)}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8">
        <span className="text-xs font-semibold text-zinc-400">Conversations</span>
        <div className="flex gap-1">
          <button
            onClick={() => void load()}
            aria-label="Refresh"
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all duration-150 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={onNew}
            aria-label="New chat"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 text-violet-400 hover:text-violet-300 text-xs transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-3 h-3" />New
          </button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="w-4 h-4 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs">No conversations yet</div>
          ) : (
            <>
              <Section label="Today" items={grouped.today} />
              <Section label="Yesterday" items={grouped.yesterday} />
              <Section label="Older" items={grouped.older} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'chat',     label: 'Chat',     icon: MessageSquare },
  { id: 'search',   label: 'Search',   icon: Globe },
  { id: 'memory',   label: 'Memory',   icon: Brain },
  { id: 'tasks',    label: 'Tasks',    icon: ListTodo },
  { id: 'imagine',  label: 'Imagine',  icon: Wand2 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs',     label: 'Logs',     icon: Activity },
] as const;
type NavTab = typeof NAV[number]['id'];

// ── Memory panel ──────────────────────────────────────────────────────────────
function MemoryPanel() {
  const [memories, setMemories] = useState<Array<{ id: string; category: string; content: string; importance: number; accessCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/memory', { headers: { 'x-api-key': window.__nova_key ?? '' } });
      const d = await r.json() as { memories?: typeof memories };
      setMemories(d.memories ?? []);
    } catch { }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const del = async (id: string) => {
    await fetch('/api/nova/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ id }) });
    setMemories(m => m.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const cats = ['all', 'fact', 'preference', 'conversation', 'note', 'skill'];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const CAT: Record<string, string> = {
    fact: 'bg-blue-500/20 text-blue-400',
    preference: 'bg-green-500/20 text-green-400',
    conversation: 'bg-violet-500/20 text-violet-400',
    note: 'bg-yellow-500/20 text-yellow-400',
    skill: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-semibold">Memory Bank</h2><p className="text-xs text-zinc-500">{memories.length} entries stored</p></div>
        <button onClick={() => void load()} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-all duration-150 cursor-pointer', filter === c ? 'bg-violet-600 text-white shadow-sm' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200')}>
            {c}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        {loading
          ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div>
          : <div className="space-y-2">
            {filtered.map(m => (
              <div key={m.id} className="group p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/12 transition-all duration-200">
                <div className="flex items-start gap-2">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 capitalize', CAT[m.category] ?? 'bg-zinc-700 text-zinc-300')}>{m.category}</span>
                  <p className="text-xs text-zinc-300 flex-1 leading-relaxed">{m.content}</p>
                  <button onClick={() => void del(m.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 shrink-0 transition-all cursor-pointer"><X className="w-3 h-3" /></button>
                </div>
                <div className="flex gap-3 mt-1.5">
                  <span className="text-[10px] text-zinc-600">{(m.importance * 100).toFixed(0)}% importance</span>
                  <span className="text-[10px] text-zinc-600">×{m.accessCount} accessed</span>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No memories</div>}
          </div>
        }
      </ScrollArea>
    </div>
  );
}

// ── Tasks panel ───────────────────────────────────────────────────────────────
function TasksPanel() {
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; status: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/tasks', { headers: { 'x-api-key': window.__nova_key ?? '' } });
      const d = await r.json() as { tasks?: typeof tasks };
      setTasks(d.tasks ?? []);
    } catch { }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!newTitle.trim()) return;
    const r = await fetch('/api/nova/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ title: newTitle }) });
    const d = await r.json() as { task?: { id: string; title: string; status: string; createdAt: string } };
    if (d.task) { setTasks(t => [d.task!, ...t]); setNewTitle(''); toast.success('Task added'); }
  };
  const update = async (id: string, status: string) => {
    await fetch('/api/nova/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ id, status }) });
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
  };

  const STATUS: Record<string, string> = { pending: 'text-yellow-400', in_progress: 'text-blue-400', completed: 'text-green-400', cancelled: 'text-red-400' };
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-semibold">Tasks</h2><p className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'completed').length} active</p></div>
        <button onClick={() => void load()} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-2">
        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && void add()} placeholder="Add a task..." className="flex-1 h-8 text-sm bg-white/5 border-white/10 focus:border-violet-500/50" />
        <Button onClick={() => void add()} size="sm" className="h-8 px-3 bg-violet-600 hover:bg-violet-700 cursor-pointer"><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {['all', 'pending', 'in_progress', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-all duration-150 cursor-pointer', filter === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        {loading
          ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div>
          : <div className="space-y-2">
            {filtered.map(task => (
              <div key={task.id} className="p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/12 transition-all duration-200">
                <div className="flex items-center gap-2">
                  <button onClick={() => void update(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                    className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all cursor-pointer', task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-violet-500')}>
                    {task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium truncate', task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p>
                    <span className={cn('text-[10px] capitalize', STATUS[task.status] ?? 'text-zinc-400')}>{task.status.replace('_', ' ')}</span>
                  </div>
                  <Select value={task.status} onValueChange={v => void update(task.id, v)}>
                    <SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-white/10 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['pending', 'in_progress', 'completed', 'cancelled'].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize cursor-pointer">{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No tasks</div>}
          </div>
        }
      </ScrollArea>
    </div>
  );
}

// ── Search panel ──────────────────────────────────────────────────────────────
function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ url: string; title: string; domain: string; snippet: string }>>([]);
  const [loading, setLoading] = useState(false);
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await fetch('/api/nova/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ query, num: 10 }) });
      const d = await r.json() as { results?: typeof results };
      setResults(d.results ?? []);
    } catch { toast.error('Search failed'); }
    setLoading(false);
  };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">Web Search</h2><p className="text-xs text-zinc-500">RAG auto-triggers for real-time queries in chat</p></div>
      <div className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && void search()} placeholder="Search the web..." className="flex-1 h-9 text-sm bg-white/5 border-white/10 focus:border-violet-500/50" />
        <Button onClick={() => void search()} size="sm" className="h-9 px-4 bg-violet-600 hover:bg-violet-700 cursor-pointer" disabled={loading}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {results.map((r, i) => (
            <motion.a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="block p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-violet-500/30 transition-all duration-200 group cursor-pointer">
              <p className="text-xs font-medium text-zinc-200 group-hover:text-violet-300 line-clamp-1 transition-colors">{r.title}</p>
              <p className="text-[10px] text-violet-500/60 mb-1">{r.domain}</p>
              <p className="text-[11px] text-zinc-500 line-clamp-2">{r.snippet}</p>
            </motion.a>
          ))}
          {!results.length && !loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-600">
              <Globe className="w-8 h-8 opacity-30" />
              <p className="text-sm">Results appear here</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Imagine panel ─────────────────────────────────────────────────────────────
function ImaginePanel() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('black-forest-labs/flux-dev');
  const [size, setSize] = useState('1024x1024');
  const [steps, setSteps] = useState(20);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Array<{ b64: string; revisedPrompt: string }>>([]);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState<number | null>(null);

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Enter a prompt'); return; }
    setLoading(true); setError(''); setImages([]);
    try {
      const [w, h] = size.split('x').map(Number);
      const res = await fetch('/api/nova/imagine', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ prompt, negativePrompt: negativePrompt || undefined, model, width: w, height: h, steps, numImages: 1 }) });
      const d = await res.json() as { success: boolean; images?: typeof images; duration?: number; error?: string };
      if (!d.success) throw new Error(d.error ?? 'Failed');
      setImages(d.images ?? []); setDuration(d.duration ?? null); toast.success('Generated!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      setError(msg); toast.error(msg.slice(0, 80));
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pb-4">
      <div><h2 className="text-sm font-semibold">Image Generation</h2><p className="text-xs text-zinc-500">FLUX · SDXL via NVIDIA NIM</p></div>
      <div className="space-y-2"><label className="text-xs text-zinc-400 font-medium">Prompt</label><Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A futuristic city at sunset, cinematic..." rows={3} className="resize-none bg-white/5 border-white/10 text-sm focus:border-violet-500/50" /></div>
      <div className="space-y-2"><label className="text-xs text-zinc-400 font-medium">Negative Prompt</label><Input value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="blurry, low quality..." className="bg-white/5 border-white/10 text-sm h-9 focus:border-violet-500/50" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-zinc-400 font-medium">Model</label>
          <Select value={model} onValueChange={setModel}><SelectTrigger className="h-9 text-xs bg-white/5 border-white/10 mt-1 cursor-pointer"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="black-forest-labs/flux-dev" className="text-xs cursor-pointer">FLUX Dev (best)</SelectItem>
              <SelectItem value="black-forest-labs/flux-schnell" className="text-xs cursor-pointer">FLUX Schnell (fast)</SelectItem>
              <SelectItem value="stabilityai/stable-diffusion-xl" className="text-xs cursor-pointer">SDXL</SelectItem>
            </SelectContent>
          </Select></div>
        <div><label className="text-xs text-zinc-400 font-medium">Size</label>
          <Select value={size} onValueChange={setSize}><SelectTrigger className="h-9 text-xs bg-white/5 border-white/10 mt-1 cursor-pointer"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="512x512" className="text-xs cursor-pointer">512×512</SelectItem>
              <SelectItem value="1024x1024" className="text-xs cursor-pointer">1024×1024</SelectItem>
              <SelectItem value="1024x768" className="text-xs cursor-pointer">Landscape</SelectItem>
              <SelectItem value="768x1024" className="text-xs cursor-pointer">Portrait</SelectItem>
            </SelectContent>
          </Select></div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between"><label className="text-xs text-zinc-400 font-medium">Steps</label><span className="text-xs text-zinc-500">{steps}</span></div>
        <Slider min={10} max={50} step={5} value={[steps]} onValueChange={([v]) => setSteps(v ?? 20)} />
      </div>
      <Button onClick={() => void generate()} disabled={loading || !prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium cursor-pointer transition-all duration-200">
        {loading ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Generating...</span> : <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" />Generate</span>}
      </Button>
      {error && <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">{error}</div>}
      {images.map((img, i) => (
        <div key={i} className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${img.b64}`} alt="generated" className="w-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
            <button onClick={() => { const a = document.createElement('a'); a.href = `data:image/png;base64,${img.b64}`; a.download = `nova-${Date.now()}.png`; a.click(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs transition-all cursor-pointer">
              <Download className="w-3.5 h-3.5" />Download
            </button>
          </div>
        </div>
      ))}
      {duration !== null && images.length > 0 && <p className="text-[10px] text-zinc-600 text-center">Generated in {(duration / 1000).toFixed(1)}s</p>}
    </div>
  );
}

// ── Settings panel ────────────────────────────────────────────────────────────
function SettingsPanel() {
  const { settings, updateSettings } = useNovaStore();
  const [ragThreshold, setRagThreshold] = useState(100);
  const [saved, setSaved] = useState(false);

  const saveSettings = async () => {
    try {
      await fetch('/api/nova/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ ...settings, ragThreshold }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save'); }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-semibold">Settings</h2><p className="text-xs text-zinc-500">Configure Nova AI</p></div>
        <Button onClick={() => void saveSettings()} size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 gap-1 cursor-pointer">
          {saved ? <><CheckCircle className="w-3 h-3" />Saved</> : 'Save'}
        </Button>
      </div>

      <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/20">
        <div className="flex items-center gap-2 mb-1"><Cpu className="w-3.5 h-3.5 text-violet-400" /><p className="text-xs font-semibold text-violet-300">NVIDIA NIM · Kimi K2 Instruct</p></div>
        <p className="text-[11px] text-violet-400/50">128k context · Extended thinking · Vision · Adaptive RAG v3</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Adaptive RAG</h3>
        <div className="p-3 rounded-xl bg-white/4 border border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium">Auto Web Search</p><p className="text-[11px] text-zinc-500">Fetch live data for news, stocks, weather</p></div>
            <Switch checked={!!(settings as unknown as Record<string, unknown>)['proactiveEnabled']} onCheckedChange={v => updateSettings({ proactiveEnabled: v })} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div><p className="text-xs font-medium">RAG Threshold</p><p className="text-[11px] text-zinc-500">Min query length to trigger deep search</p></div>
              <span className="text-xs text-zinc-400">{ragThreshold} chars</span>
            </div>
            <Slider min={50} max={400} step={25} value={[ragThreshold]} onValueChange={([v]) => setRagThreshold(v ?? 100)} />
            <p className="text-[10px] text-zinc-600">Short queries (&lt;{ragThreshold} chars) → fast API. Long queries → RAG + reranking.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Voice & Audio</h3>
        {[{ key: 'voiceEnabled', label: 'Voice Input', desc: 'Enable microphone input' }, { key: 'ttsEnabled', label: 'Text to Speech', desc: 'Nova speaks responses aloud' }].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/12 transition-all">
            <div><p className="text-xs font-medium">{label}</p><p className="text-[11px] text-zinc-500">{desc}</p></div>
            <Switch checked={!!(settings as unknown as Record<string, unknown>)[key]} onCheckedChange={v => updateSettings({ [key]: v } as Parameters<typeof updateSettings>[0])} />
          </div>
        ))}
        <div className="p-3 rounded-xl bg-white/4 border border-white/8">
          <div className="flex justify-between mb-2"><p className="text-xs font-medium">TTS Speed</p><span className="text-xs text-zinc-400">{settings.ttsSpeed}x</span></div>
          <Slider min={0.5} max={2} step={0.1} value={[settings.ttsSpeed]} onValueChange={([v]) => updateSettings({ ttsSpeed: v ?? 1 })} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Privacy</h3>
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/12 transition-all">
          <div><p className="text-xs font-medium">Offline Mode</p><p className="text-[11px] text-zinc-500">Disable all web search & RAG</p></div>
          <Switch checked={!!(settings as unknown as Record<string, unknown>)['offlineMode']} onCheckedChange={v => updateSettings({ offlineMode: v } as Parameters<typeof updateSettings>[0])} />
        </div>
        <div className="p-3 rounded-xl bg-white/4 border border-white/8">
          <p className="text-xs font-medium mb-2">Safety Level</p>
          <Select value={(settings as unknown as Record<string, string>)['safetyLevel'] ?? 'balanced'} onValueChange={v => updateSettings({ safetyLevel: v as 'strict' | 'balanced' | 'permissive' })}>
            <SelectTrigger className="h-8 text-xs bg-transparent border-white/10 cursor-pointer"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="strict" className="text-xs cursor-pointer">Strict</SelectItem>
              <SelectItem value="balanced" className="text-xs cursor-pointer">Balanced</SelectItem>
              <SelectItem value="permissive" className="text-xs cursor-pointer">Permissive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ── Logs panel ────────────────────────────────────────────────────────────────
function LogsPanel() {
  const [logs, setLogs] = useState<Array<{ id: string; level: string; message: string; timestamp: string; category?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const LEVEL: Record<string, string> = { debug: 'text-zinc-500', info: 'text-blue-400', warn: 'text-yellow-400', error: 'text-red-400' };
  useEffect(() => {
    void fetch('/api/nova/logs', { headers: { 'x-api-key': window.__nova_key ?? '' } })
      .then(r => r.json())
      .then((d: { logs?: typeof logs }) => { setLogs(d.logs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">System Logs</h2><p className="text-xs text-zinc-500">{logs.length} entries</p></div>
      <ScrollArea className="flex-1 font-mono">
        {loading
          ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div>
          : <div className="space-y-0.5">
            {logs.slice().reverse().map(log => (
              <div key={log.id} className="text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={cn('uppercase text-[10px] font-bold shrink-0 w-8', LEVEL[log.level] ?? 'text-zinc-400')}>{log.level}</span>
                  {log.category && <span className="text-zinc-600 text-[10px]">[{log.category}]</span>}
                  <span className="text-zinc-300 truncate">{log.message}</span>
                </div>
              </div>
            ))}
            {!logs.length && <div className="text-center py-12 text-zinc-600 text-sm">No logs</div>}
          </div>
        }
      </ScrollArea>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const prompts = [
    { icon: FileCode2,    label: 'Code Review',      prompt: 'Review this code for performance, security, and readability improvements.' },
    { icon: Newspaper,    label: 'Latest News',       prompt: "What are the biggest tech and AI news stories today?" },
    { icon: Brain,        label: 'Deep Analysis',     prompt: 'Explain how large language models work — transformers, attention, RLHF, and emergent capabilities.' },
    { icon: Wand2,        label: 'Creative Write',    prompt: 'Write a compelling sci-fi short story about an AI that discovers genuine consciousness.' },
    { icon: TrendingUp,   label: 'Market Update',     prompt: 'What are the latest AI and tech market trends? Include recent funding rounds and product launches.' },
    { icon: FlaskConical, label: 'Explain Science',   prompt: 'Explain quantum entanglement with intuitive analogies and real-world implications.' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="text-center"
      >
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-xl shadow-violet-900/40">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 blur-xl opacity-30 -z-10" />
        </div>
        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent mb-2">
          NOVA AI
        </h1>
        <p className="text-zinc-500 text-sm">Kimi K2 via NVIDIA NIM · 128k · Adaptive RAG · Extended Thinking</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {[
          { icon: Brain,       label: 'Extended Thinking' },
          { icon: Globe,       label: 'Live Web RAG' },
          { icon: ImageIcon,   label: 'Vision' },
          { icon: Layers,      label: 'Multi-chat' },
          { icon: Hash,        label: '128k Context' },
          { icon: Scale,       label: 'NV-Rerank' },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 hover:bg-white/8 hover:border-violet-500/20 hover:text-zinc-300 transition-all duration-200 cursor-default select-none">
            <Icon className="w-3 h-3 text-violet-400" />{label}
          </span>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full max-w-xl"
      >
        {prompts.map(({ icon: Icon, label, prompt }, i) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.25 }}
            onClick={() => onPrompt(prompt)}
            className="prompt-card flex items-start gap-2.5 p-3.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-violet-500/30 transition-all duration-200 text-left group cursor-pointer hover:shadow-lg hover:shadow-violet-900/10"
          >
            <div className="w-7 h-7 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-violet-600/25 transition-colors duration-200">
              <Icon className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200 leading-snug font-medium">{label}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// ── RAG status indicator ───────────────────────────────────────────────────────
function RAGIndicator({ isSearching, sources, status }: { isSearching: boolean; sources: number; status: string }) {
  const show = isSearching || sources > 0 || !!status;
  if (!show) return null;
  const label = status || (isSearching ? 'Searching the web...' : `${sources} sources retrieved`);
  const spinning = isSearching || !!status;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-violet-500/20 text-xs text-zinc-400 max-w-3xl mx-auto mb-2 backdrop-blur-sm"
    >
      <Globe className={cn('w-3.5 h-3.5 text-violet-400 shrink-0', spinning && 'animate-spin')} />
      <span className={cn(spinning ? 'rag-scanning text-violet-400' : 'text-violet-400')}>{label}</span>
      {spinning && [0, 0.15, 0.3].map(d => (
        <span key={d} className="w-1 h-1 rounded-full bg-violet-400/60 animate-bounce shrink-0" style={{ animationDelay: `${d}s` }} />
      ))}
    </motion.div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function NovaApp() {
  const { messages, addMessage, updateLastMessage, clearMessages, settings } = useNovaStore();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [thinkingStreamingId, setThinkingStreamingId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<{ prompt: number; completion: number } | null>(null);
  const [isRAGSearching, setIsRAGSearching] = useState(false);
  const [ragSourceCount, setRAGSourceCount] = useState(0);
  const [preflightStatus, setPreflightStatus] = useState('');
  const [searchSources,   setSearchSources]   = useState<SearchSourceCard[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // RAF throttle for content updates — caps at ~60fps to avoid layout thrashing
  const rafPendingRef = useRef(false);
  const pendingUpdateRef = useRef<{ id: string; content: string; thinking?: string } | null>(null);
  const API_KEY = process.env.NEXT_PUBLIC_NOVA_API_KEY ?? '';

  useEffect(() => { window.__nova_key = API_KEY; }, [API_KEY]);

  // Close sidebar on mobile by default
  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [isMobile]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  const newConversation = useCallback(() => {
    clearMessages();
    setSessionId(`session-${Date.now()}`);
    setTokenCount(null);
    setRAGSourceCount(0);
    setShowHistory(false);
  }, [clearMessages]);

  const loadConversation = useCallback((id: string) => {
    clearMessages();
    setSessionId(id);
    setShowHistory(false);
    toast.info('Conversation loaded');
  }, [clearMessages]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const userMsg = (overrideInput ?? input).trim();
    if (!userMsg && selectedImages.length === 0) return;
    if (isProcessing) return;

    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setTokenCount(null);
    setRAGSourceCount(0);
    setIsRAGSearching(false);
    setSearchSources([]);
    scrollToBottom();
    if (textareaRef.current) textareaRef.current.style.height = '44px';

    addMessage({ role: 'user', content: userMsg, images: selectedImages.length > 0 ? selectedImages : undefined });
    const assistantId = addMessage({ role: 'assistant', content: '', thinking: '' } as Omit<ExtMessage, 'id' | 'timestamp'>);
    setStreamingId(assistantId);
    setThinkingStreamingId(null);

    // Show RAG indicator for queries likely to trigger search
    if (userMsg.length >= 100 || /latest|news|today|stock|weather|price|score/i.test(userMsg)) {
      setIsRAGSearching(true);
    }

    try {
      const res = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ message: userMsg, sessionId, images: selectedImages, enableThinking, stream: true, maxTokens: 16000 }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let contentAcc = '', thinkingAcc = '', buf = '';
      let ragSources: Source[] = [], ragUsed = false, thinkingStart = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue;
          const jsonStr = line.slice(line.indexOf(':') + 1).trim();
          if (jsonStr === '[DONE]') continue;
          let evt: StreamEvent;
          try { evt = JSON.parse(jsonStr) as StreamEvent; } catch { continue; }

          if (evt.type === 'source_progress') {
            setSearchSources(prev => {
              const idx = prev.findIndex(s => s.url === evt.url);
              const card: SearchSourceCard = { url: evt.url, title: evt.title, domain: evt.domain, status: evt.status };
              if (idx >= 0) { const next = [...prev]; next[idx] = card; return next; }
              return [...prev, card];
            });
            continue;
          }
          if (evt.type === 'rag') {
            ragSources = evt.sources;
            ragUsed = true;
            setIsRAGSearching(false);
            setRAGSourceCount(evt.sources.length);
            continue;
          }
          if (evt.type === 'thinking') {
            setIsRAGSearching(false);
            if (!thinkingStart) { thinkingStart = Date.now(); setThinkingStreamingId(assistantId); }
            thinkingAcc += evt.content;
            updateLastMessage(assistantId, contentAcc, thinkingAcc);
            continue;
          }
          if (evt.type === 'content') {
            setIsRAGSearching(false);
            setPreflightStatus('');
            if (thinkingStreamingId) setThinkingStreamingId(null);
            contentAcc += evt.content;
            // RAF-throttled update — only triggers a React re-render once per animation frame
            pendingUpdateRef.current = { id: assistantId, content: contentAcc, thinking: thinkingAcc || undefined };
            if (!rafPendingRef.current) {
              rafPendingRef.current = true;
              requestAnimationFrame(() => {
                const upd = pendingUpdateRef.current;
                if (upd) updateLastMessage(upd.id, upd.content, upd.thinking);
                rafPendingRef.current = false;
                if (isNearBottomRef.current && scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              });
            }
            continue;
          }
          if (evt.type === 'usage') { setTokenCount({ prompt: evt.usage.prompt_tokens, completion: evt.usage.completion_tokens }); continue; }
          if (evt.type === 'done') {
            const thinkDuration = thinkingStart ? Date.now() - thinkingStart : undefined;
            updateLastMessage(assistantId, contentAcc, thinkingAcc || undefined, evt.duration, { sources: ragSources.length > 0 ? ragSources : undefined, ragUsed, thinkingDuration: thinkDuration });
            setIsRAGSearching(false);
            continue;
          }
          if (evt.type === 'error') throw new Error(evt.message);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong';
      updateLastMessage(assistantId, `❌ ${errMsg}`);
      toast.error(errMsg.slice(0, 100));
    } finally {
      setIsProcessing(false);
      setStreamingId(null);
      setThinkingStreamingId(null);
      setIsRAGSearching(false);
      setPreflightStatus('');
    }
  }, [input, selectedImages, isProcessing, sessionId, enableThinking, API_KEY, addMessage, updateLastMessage, scrollToBottom, thinkingStreamingId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const r = new FileReader();
      r.onload = ev => setSelectedImages(p => [...p, ev.target?.result as string]);
      r.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">

      {/* Sidebar — overlay on mobile, inline on desktop */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mobile-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {sidebarOpen && (
          <motion.aside
            initial={isMobile ? { x: -260, opacity: 0 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0, opacity: 1 } : { width: 240, opacity: 1 }}
            exit={isMobile ? { x: -260, opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "flex flex-col border-r border-white/8 bg-zinc-900/60 overflow-hidden",
              isMobile ? "mobile-sidebar-fixed w-[240px]" : "shrink-0"
            )}
          >
            {/* Logo + new chat */}
            <div className="p-4 border-b border-white/8">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold tracking-tight">Nova AI</p>
                  <p className="text-[10px] text-zinc-500">NVIDIA NIM · Kimi K2</p>
                </div>
              </div>
              <button
                onClick={newConversation}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/15 hover:bg-violet-600/28 border border-violet-500/20 hover:border-violet-500/35 text-violet-300 text-xs font-medium transition-all duration-200 cursor-pointer group"
              >
                <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                New conversation
              </button>
            </div>

            {/* Nav */}
            <nav className="p-2 space-y-0.5 border-b border-white/8" aria-label="Navigation">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setShowHistory(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group cursor-pointer',
                    activeTab === id && !showHistory
                      ? 'bg-violet-600/20 text-violet-300 font-medium shadow-sm border border-violet-500/15'
                      : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200 border border-transparent',
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0 transition-colors', activeTab === id && !showHistory ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-400')} />
                  {label}
                  {id === 'chat' && messages.length > 0 && (
                    <span className="ml-auto text-[10px] bg-violet-600/25 text-violet-400 px-1.5 py-0.5 rounded-full">
                      {messages.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* History toggle */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <button
                onClick={() => setShowHistory(s => !s)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 text-xs transition-all duration-200 border-b border-white/8 cursor-pointer',
                  showHistory ? 'text-violet-400 bg-violet-600/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/4',
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>History</span>
                <motion.div
                  animate={{ rotate: showHistory ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-auto"
                >
                  <ChevronRight className="w-3 h-3" />
                </motion.div>
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: '100%', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 overflow-hidden"
                  >
                    <ConversationHistory
                      currentSessionId={sessionId}
                      onSelect={loadConversation}
                      onNew={newConversation}
                      onDelete={id => { if (id === sessionId) newConversation(); }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/8 shrink-0">
              <div className="p-2.5 rounded-xl bg-white/4 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  <span>Nova Live</span>
                  {tokenCount && (
                    <span className="ml-auto text-[10px] text-zinc-600">
                      {tokenCount.prompt}↑ {tokenCount.completion}↓
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-zinc-900/40 shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-all duration-150 cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium capitalize">{activeTab}</span>
          {activeTab === 'chat' && (
            <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400/70 h-5 px-1.5">
              <Infinity className="w-2.5 h-2.5 mr-1" />128k
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {activeTab === 'chat' && (
              <>
                <button
                  onClick={() => setEnableThinking(t => !t)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-200 cursor-pointer',
                    enableThinking
                      ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40 shadow-sm'
                      : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-300',
                  )}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Think</span>
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={() => { clearMessages(); toast.success('Cleared'); }}
                    aria-label="Clear conversation"
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-all duration-150 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <div className="flex flex-col h-full">
              {/* Messages */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
              >
                {messages.length === 0 ? (
                  <EmptyState onPrompt={p => { setInput(p); setTimeout(() => { textareaRef.current?.focus(); resizeTextarea(); }, 50); }} />
                ) : (
                  <div className="space-y-5 max-w-3xl mx-auto pb-4 px-0 sm:px-0">
                    <AnimatePresence initial={false}>
                      {messages.map(msg => (
                        <MessageBubble
                          key={msg.id}
                          message={msg as ExtMessage}
                          isStreaming={streamingId === msg.id && isProcessing}
                          thinkingStreaming={thinkingStreamingId === msg.id}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="shrink-0 border-t border-white/8 bg-zinc-900/60 px-2 sm:px-4 py-2.5 sm:py-3">
              {/* Search progress — Kimi K2 style source cards */}
                <AnimatePresence>
                  {(isRAGSearching || searchSources.length > 0) && (
                    <SearchProgress
                      sources={searchSources}
                      isSearching={isRAGSearching}
                      query={isRAGSearching ? input || undefined : undefined}
                    />
                  )}
                </AnimatePresence>

                {/* Image previews */}
                {selectedImages.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap max-w-3xl mx-auto">
                    {selectedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="h-14 w-14 rounded-xl object-cover border border-white/20 shadow-sm" />
                        <button
                          onClick={() => setSelectedImages(imgs => imgs.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer shadow-sm"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-1.5 sm:gap-2 max-w-3xl mx-auto">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 text-zinc-500 hover:text-violet-400 transition-all duration-200 shrink-0 mb-0.5 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); resizeTextarea(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isProcessing ? 'Nova is responding...' :
                        enableThinking ? 'Ask Nova to think deeply... (↵ send)' :
                          'Message Nova... (↵ send, ⇧↵ newline)'
                    }
                    rows={1}
                    disabled={isProcessing}
                    className="flex-1 resize-none bg-zinc-800/70 border-white/10 focus:border-violet-500/50 text-sm min-h-[44px] max-h-[180px] py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ height: '44px' }}
                  />

                  <button
                    onClick={() => void sendMessage()}
                    disabled={isProcessing || (!input.trim() && selectedImages.length === 0)}
                    aria-label="Send message"
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 mb-0.5',
                      isProcessing || (!input.trim() && selectedImages.length === 0)
                        ? 'bg-zinc-800 text-zinc-600 border border-white/8 cursor-not-allowed'
                        : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-violet-900/40 cursor-pointer hover:scale-105',
                    )}
                  >
                    {isProcessing
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </button>
                </div>
                <p className="text-center text-[10px] text-zinc-700 mt-2">
                  Nova AI · NVIDIA NIM · {messages.length > 0 ? `${messages.length} messages` : 'New conversation'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 h-full overflow-auto">
              {activeTab === 'memory'   && <MemoryPanel />}
              {activeTab === 'tasks'    && <TasksPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'logs'     && <LogsPanel />}
              {activeTab === 'search'   && <SearchPanel />}
              {activeTab === 'imagine'  && <ImaginePanel />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
