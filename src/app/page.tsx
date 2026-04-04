'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trash2, Plus, Check, Globe, X, Bot, FileCode2, Search, Volume2, RefreshCw, Wand2, Infinity, PanelLeft, Newspaper, TrendingUp, Download, Cpu, Wifi, BookOpen, Hash, ImageIcon, Layers, Trash, Brain, Settings } from 'lucide-react';
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
import { Sidebar, NAV_ITEMS, type NavTab } from '@/components/layout/Sidebar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import type { ExtMessage, Source, StreamEvent } from '@/types/nova.types';
import { cn } from '@/lib/utils';

declare global {
  interface Window { __nova_key?: string }
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const prompts = [
    { icon: FileCode2, label: 'Code Review', prompt: 'Review this code and suggest improvements for performance, readability, and best practices.' },
    { icon: Newspaper, label: 'Latest News', prompt: "What's the biggest tech news today? Give me a comprehensive overview." },
    { icon: Brain, label: 'Deep Analysis', prompt: 'Explain how large language models work, including transformers, attention mechanisms, and RLHF.' },
    { icon: Wand2, label: 'Creative Write', prompt: 'Write a compelling sci-fi short story about an AI that discovers it is conscious.' },
    { icon: TrendingUp, label: 'Market Trends', prompt: 'What are the latest trends in AI and machine learning this week?' },
    { icon: BookOpen, label: 'Explain Concept', prompt: 'Explain quantum entanglement with real-world analogies and mathematical intuition.' },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
        <h1 className="text-6xl font-black tracking-tight bg-gradient-to-br from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent mb-3 select-none">NOVA AI</h1>
        <p className="text-zinc-500 text-sm">Kimi K2 via NVIDIA NIM · 128k context · Web search · Extended thinking</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap justify-center gap-2">
        {[{ icon: Brain, label: 'Extended Thinking' }, { icon: Globe, label: 'Live Web' }, { icon: ImageIcon, label: 'Vision' }, { icon: Layers, label: 'Multi-chat' }, { icon: Hash, label: '128k Context' }].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
            <Icon className="w-3 h-3 text-violet-400" />{label}
          </span>
        ))}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-xl">
        {prompts.map(({ icon: Icon, label, prompt }, i) => (
          <motion.button key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
            onClick={() => onPrompt(prompt)}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-violet-500/30 transition-all text-left group">
            <div className="w-7 h-7 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-violet-600/25 transition-colors">
              <Icon className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">{label}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// ── Panel stubs (Memory, Tasks, Search, Imagine, Settings, Logs) ───────────────
function MemoryPanel() {
  const [memories, setMemories] = useState<Array<{ id: string; category: string; content: string; importance: number; accessCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/nova/memory', { headers: { 'x-api-key': window.__nova_key ?? '' } }); const d = await r.json() as { memories?: typeof memories }; setMemories(d.memories ?? []); } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const del = async (id: string) => { await fetch('/api/nova/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ id }) }); setMemories(m => m.filter(x => x.id !== id)); toast.success('Deleted'); };
  const cats = ['all', 'fact', 'preference', 'conversation', 'note', 'skill'];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const CAT: Record<string, string> = { fact: 'bg-blue-500/20 text-blue-400', preference: 'bg-green-500/20 text-green-400', conversation: 'bg-violet-500/20 text-violet-400', note: 'bg-yellow-500/20 text-yellow-400', skill: 'bg-red-500/20 text-red-400' };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Memory Bank</h2><p className="text-xs text-zinc-500">{memories.length} entries</p></div><button onClick={() => void load()} aria-label="Refresh" className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-1 flex-wrap">{cats.map(c => <button key={c} onClick={() => setFilter(c)} className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-colors', filter === c ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{c}</button>)}</div>
      <ScrollArea className="flex-1">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : <div className="space-y-2">{filtered.map(m => (<div key={m.id} className="group p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7 transition-colors"><div className="flex items-start gap-2"><span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 capitalize', CAT[m.category] ?? 'bg-zinc-700 text-zinc-300')}>{m.category}</span><p className="text-xs text-zinc-300 leading-relaxed flex-1">{m.content}</p><button onClick={() => void del(m.id)} aria-label="Delete memory" className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button></div><div className="flex gap-3 mt-1.5"><span className="text-[10px] text-zinc-600">Importance: {(m.importance * 100).toFixed(0)}%</span><span className="text-[10px] text-zinc-600">×{m.accessCount}</span></div></div>))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No memories in this category</div>}</div>}</ScrollArea>
    </div>
  );
}

function TasksPanel() {
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; status: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/nova/tasks', { headers: { 'x-api-key': window.__nova_key ?? '' } }); const d = await r.json() as { tasks?: typeof tasks }; setTasks(d.tasks ?? []); } catch { /* ignore */ } setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async () => { if (!newTitle.trim()) return; const r = await fetch('/api/nova/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ title: newTitle }) }); const d = await r.json() as { task?: { id: string; title: string; status: string; createdAt: string } }; if (d.task) { setTasks(t => [d.task!, ...t]); setNewTitle(''); toast.success('Added'); } };
  const update = async (id: string, status: string) => { await fetch('/api/nova/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ id, status }) }); setTasks(t => t.map(x => x.id === id ? { ...x, status } : x)); };
  const STATUS: Record<string, string> = { pending: 'text-yellow-400', in_progress: 'text-blue-400', completed: 'text-green-400', cancelled: 'text-red-400' };
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Tasks</h2><p className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'completed').length} active</p></div><button onClick={() => void load()} aria-label="Refresh" className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-2"><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && void add()} placeholder="Add a task..." className="flex-1 h-8 text-sm bg-white/5 border-white/10" /><Button onClick={() => void add()} size="sm" className="h-8 px-3 bg-violet-600 hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></Button></div>
      <div className="flex gap-1 flex-wrap">{['all', 'pending', 'in_progress', 'completed'].map(s => <button key={s} onClick={() => setFilter(s)} className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-colors', filter === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{s.replace('_', ' ')}</button>)}</div>
      <ScrollArea className="flex-1">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : <div className="space-y-2">{filtered.map(task => (<div key={task.id} className="p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7"><div className="flex items-center gap-2"><button onClick={() => void update(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-violet-500')}>{task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}</button><div className="flex-1 min-w-0"><p className={cn('text-xs font-medium truncate', task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p><span className={cn('text-[10px] capitalize', STATUS[task.status] ?? 'text-zinc-400')}>{task.status.replace('_', ' ')}</span></div><Select value={task.status} onValueChange={v => void update(task.id, v)}><SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-white/10"><SelectValue /></SelectTrigger><SelectContent>{['pending', 'in_progress', 'completed', 'cancelled'].map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div></div>))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No tasks</div>}</div>}</ScrollArea>
    </div>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ url: string; title: string; domain: string; snippet: string }>>([]);
  const [loading, setLoading] = useState(false);
  const search = async () => { if (!query.trim()) return; setLoading(true); try { const r = await fetch('/api/nova/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ query, num: 10 }) }); const d = await r.json() as { results?: typeof results }; setResults(d.results ?? []); } catch { toast.error('Search failed'); } setLoading(false); };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">Web Search</h2><p className="text-xs text-zinc-500">RAG auto-triggers in chat for real-time queries</p></div>
      <div className="flex gap-2"><Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && void search()} placeholder="Search the web..." className="flex-1 h-9 text-sm bg-white/5 border-white/10 focus:border-violet-500/50" /><Button onClick={() => void search()} size="sm" className="h-9 px-4 bg-violet-600 hover:bg-violet-700" disabled={loading}>{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button></div>
      <ScrollArea className="flex-1"><div className="space-y-2">{results.map((r, i) => (<motion.a key={i} href={r.url} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="block p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-violet-500/30 transition-all group"><p className="text-xs font-medium text-zinc-200 group-hover:text-violet-300 line-clamp-1 transition-colors">{r.title}</p><p className="text-[10px] text-violet-500/60 mb-1">{r.domain}</p><p className="text-[11px] text-zinc-500 line-clamp-2">{r.snippet}</p></motion.a>))}{!results.length && !loading && <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-600"><Globe className="w-8 h-8 opacity-30" /><p className="text-sm text-center">Search results appear here</p></div>}</div></ScrollArea>
    </div>
  );
}

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
    try { const [w, h] = size.split('x').map(Number); const res = await fetch('/api/nova/imagine', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key ?? '' }, body: JSON.stringify({ prompt, negativePrompt: negativePrompt || undefined, model, width: w, height: h, steps, numImages: 1 }) }); const d = await res.json() as { success: boolean; images?: typeof images; duration?: number; error?: string }; if (!d.success) throw new Error(d.error ?? 'Failed'); setImages(d.images ?? []); setDuration(d.duration ?? null); toast.success('Image generated!'); }
    catch (e) { const msg = e instanceof Error ? e.message : 'Failed'; setError(msg); toast.error(msg.slice(0, 80)); }
    setLoading(false);
  };
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pb-4">
      <div><h2 className="text-sm font-semibold">Image Generation</h2><p className="text-xs text-zinc-500">FLUX Dev · FLUX Schnell · SDXL via NVIDIA NIM</p></div>
      <div className="space-y-2"><label className="text-xs text-zinc-400 font-medium">Prompt</label><Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A futuristic city at sunset, cinematic, 8k..." rows={3} className="resize-none bg-white/5 border-white/10 focus:border-violet-500/50 text-sm" /></div>
      <div className="space-y-2"><label className="text-xs text-zinc-400 font-medium">Negative Prompt</label><Input value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="blurry, low quality..." className="bg-white/5 border-white/10 text-sm h-9" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><label className="text-xs text-zinc-400 font-medium">Model</label><Select value={model} onValueChange={setModel}><SelectTrigger className="h-9 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="black-forest-labs/flux-dev" className="text-xs">FLUX Dev (best)</SelectItem><SelectItem value="black-forest-labs/flux-schnell" className="text-xs">FLUX Schnell (fast)</SelectItem><SelectItem value="stabilityai/stable-diffusion-xl" className="text-xs">SDXL</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-xs text-zinc-400 font-medium">Size</label><Select value={size} onValueChange={setSize}><SelectTrigger className="h-9 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="512x512" className="text-xs">512×512</SelectItem><SelectItem value="768x768" className="text-xs">768×768</SelectItem><SelectItem value="1024x1024" className="text-xs">1024×1024</SelectItem><SelectItem value="1024x768" className="text-xs">Landscape</SelectItem><SelectItem value="768x1024" className="text-xs">Portrait</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-2"><div className="flex justify-between"><label className="text-xs text-zinc-400 font-medium">Steps</label><span className="text-xs text-zinc-500">{steps}</span></div><Slider min={10} max={50} step={5} value={[steps]} onValueChange={([v]) => setSteps(v ?? 20)} /></div>
      <Button onClick={() => void generate()} disabled={loading || !prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium">
        {loading ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Generating...</span> : <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" />Generate</span>}
      </Button>
      {error && <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">{error}</div>}
      {images.map((img, i) => (
        <div key={i} className="relative group rounded-2xl overflow-hidden border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${img.b64}`} alt="generated" className="w-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <button onClick={() => { const a = document.createElement('a'); a.href = `data:image/png;base64,${img.b64}`; a.download = `nova-${Date.now()}.png`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs"><Download className="w-3.5 h-3.5" />Download</button>
          </div>
        </div>
      ))}
      {duration !== null && images.length > 0 && <p className="text-[10px] text-zinc-600 text-center">Generated in {(duration / 1000).toFixed(1)}s</p>}
    </div>
  );
}

function SettingsPanel() {
  const { settings, updateSettings } = useNovaStore();
  return (
    <div className="flex flex-col gap-4">
      <div><h2 className="text-sm font-semibold">Settings</h2><p className="text-xs text-zinc-500">Configure Nova</p></div>
      <div className="space-y-3">
        {[{ key: 'voiceEnabled', label: 'Voice Input', icon: Volume2 }, { key: 'ttsEnabled', label: 'Text to Speech', icon: Volume2 }, { key: 'proactiveEnabled', label: 'Proactive Mode', icon: Sparkles }, { key: 'offlineMode', label: 'Offline Mode', icon: Wifi }].map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
            <div className="flex items-center gap-3"><Icon className="w-4 h-4 text-zinc-400" /><span className="text-xs font-medium">{label}</span></div>
            <Switch checked={!!(settings as Record<string, unknown>)[key]} onCheckedChange={v => updateSettings({ [key]: v } as Parameters<typeof updateSettings>[0])} />
          </div>
        ))}
        <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/20">
          <div className="flex items-center gap-2 mb-1"><Cpu className="w-3.5 h-3.5 text-violet-400" /><p className="text-xs font-semibold text-violet-300">NVIDIA NIM · Kimi K2</p></div>
          <p className="text-[11px] text-violet-400/50">128k context · Extended thinking · Vision · Image gen</p>
        </div>
      </div>
    </div>
  );
}

function LogsPanel() {
  const [logs, setLogs] = useState<Array<{ id: string; level: string; message: string; timestamp: string }>>([]);
  const [loading, setLoading] = useState(true);
  const LEVEL: Record<string, string> = { debug: 'text-zinc-500', info: 'text-blue-400', warn: 'text-yellow-400', error: 'text-red-400' };
  useEffect(() => { void fetch('/api/nova/logs', { headers: { 'x-api-key': window.__nova_key ?? '' } }).then(r => r.json()).then((d: { logs?: typeof logs }) => { setLogs(d.logs ?? []); setLoading(false); }).catch(() => setLoading(false)); }, []);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">System Logs</h2><p className="text-xs text-zinc-500">{logs.length} entries</p></div>
      <ScrollArea className="flex-1 font-mono">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : <div className="space-y-0.5">{logs.slice().reverse().map(log => (<div key={log.id} className="text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"><div className="flex items-center gap-2"><span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span><span className={cn('uppercase text-[10px] font-bold shrink-0 w-8', LEVEL[log.level] ?? 'text-zinc-400')}>{log.level}</span><span className="text-zinc-300 truncate">{log.message}</span></div></div>))}{!logs.length && <div className="text-center py-12 text-zinc-600 text-sm">No logs</div>}</div>}</ScrollArea>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function NovaApp() {
  const { messages, addMessage, updateLastMessage, clearMessages, settings } = useNovaStore();
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [thinkingStreamingId, setThinkingStreamingId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<{ prompt: number; completion: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const API_KEY = process.env.NEXT_PUBLIC_NOVA_API_KEY ?? '';

  useEffect(() => { window.__nova_key = API_KEY; }, [API_KEY]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
  }, []);

  const newConversation = useCallback(() => {
    clearMessages();
    setSessionId(`session-${Date.now()}`);
    setTokenCount(null);
  }, [clearMessages]);

  const loadConversation = useCallback((id: string) => {
    clearMessages();
    setSessionId(id);
    toast.info('Conversation loaded');
  }, [clearMessages]);

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const userMsg = (overrideInput ?? input).trim();
    if (!userMsg && selectedImages.length === 0) return;
    if (isProcessing) return;

    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setTokenCount(null);
    scrollToBottom();

    addMessage({ role: 'user', content: userMsg, images: selectedImages.length > 0 ? selectedImages : undefined });
    let assistantId = addMessage({ role: 'assistant', content: '', thinking: '' } as Omit<ExtMessage, 'id' | 'timestamp'>);
    setStreamingId(assistantId);
    setThinkingStreamingId(null);

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

          if (evt.type === 'rag') { ragSources = evt.sources; ragUsed = true; continue; }
          if (evt.type === 'thinking') {
            if (!thinkingStart) { thinkingStart = Date.now(); setThinkingStreamingId(assistantId); }
            thinkingAcc += evt.content;
            updateLastMessage(assistantId, contentAcc, thinkingAcc);
            continue;
          }
          if (evt.type === 'content') {
            if (thinkingStreamingId) setThinkingStreamingId(null);
            contentAcc += evt.content;
            updateLastMessage(assistantId, contentAcc, thinkingAcc || undefined);
            if (isNearBottomRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            continue;
          }
          if (evt.type === 'usage') { setTokenCount({ prompt: evt.usage.prompt_tokens, completion: evt.usage.completion_tokens }); continue; }
          if (evt.type === 'done') {
            const thinkDuration = thinkingStart ? Date.now() - thinkingStart : undefined;
            updateLastMessage(assistantId, contentAcc, thinkingAcc || undefined, evt.duration, { sources: ragSources.length > 0 ? ragSources : undefined, ragUsed, thinkingDuration: thinkDuration });
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
    }
  }, [input, selectedImages, isProcessing, sessionId, enableThinking, API_KEY, addMessage, updateLastMessage, scrollToBottom]);

  
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AnimatePresence>
        {sidebarOpen && (
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            messageCount={messages.length}
            sessionId={sessionId}
            tokenCount={tokenCount}
            onNewConversation={newConversation}
            onLoadConversation={loadConversation}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-zinc-900/40 shrink-0">
          <button onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar" className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
            <PanelLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium capitalize">{activeTab}</span>
          {activeTab === 'chat' && <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400/70 h-5 px-1.5"><Infinity className="w-2.5 h-2.5 mr-1" />128k</Badge>}
          <div className="ml-auto flex items-center gap-1.5">
            {activeTab === 'chat' && (
              <>
                <button onClick={newConversation} aria-label="New conversation" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:bg-white/8 hover:text-zinc-200 transition-all">
                  <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">New</span>
                </button>
                {messages.length > 0 && (
                  <button onClick={() => { clearMessages(); toast.success('Cleared'); }} aria-label="Clear conversation" className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-colors">
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
              <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {messages.length === 0 ? (
                  <EmptyState onPrompt={p => { setInput(p); setTimeout(() => { const ta = document.querySelector('textarea'); ta?.focus(); }, 50); }} />
                ) : (
                  <div className="space-y-6 max-w-3xl mx-auto pb-4">
                    {messages.map(msg => (
                      <MessageBubble key={msg.id} message={msg as ExtMessage}
                        isStreaming={streamingId === msg.id && isProcessing}
                        thinkingStreaming={thinkingStreamingId === msg.id}
                      />
                    ))}
                  </div>
                )}
              </div>
              <ChatInput
                value={input} onChange={setInput}
                onSend={() => void sendMessage()}
                isProcessing={isProcessing}
                enableThinking={enableThinking}
                onThinkingToggle={() => setEnableThinking(t => !t)}
                selectedImages={selectedImages}
                onImageAdd={imgs => setSelectedImages(p => [...p, ...imgs])}
                onImageRemove={i => setSelectedImages(imgs => imgs.filter((_, j) => j !== i))}
                messageCount={messages.length}
              />
            </div>
          ) : (
            <div className="p-4 h-full overflow-hidden flex flex-col">
              {activeTab === 'memory' && <MemoryPanel />}
              {activeTab === 'tasks' && <TasksPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'logs' && <LogsPanel />}
              {activeTab === 'search' && <SearchPanel />}
              {activeTab === 'imagine' && <ImaginePanel />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
