import { create } from 'zustand';

export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  duration?: number;
  thinking?: string;
  images?: string[];
  // RAG fields
  sources?: Source[];
  ragUsed?: boolean;
  searchQuery?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  dueDate?: Date;
  createdAt: Date;
}

export interface Memory {
  id: string;
  category: 'fact' | 'preference' | 'conversation' | 'note' | 'skill';
  content: string;
  importance: number;
  createdAt: Date;
}

export interface Settings {
  wakeWord: string;
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  ttsSpeed: number;
  ttsVoice: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  proactiveEnabled: boolean;
  offlineMode: boolean;
  logLevel: string;
  safetyLevel: 'strict' | 'balanced' | 'permissive';
}

export interface SearchResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

interface NovaState {
  activeTab: string;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  sidebarOpen: boolean;
  messages: Message[];
  sessionId: string;
  voiceSupported: boolean;
  audioLevel: number;
  searchResults: SearchResult[];
  isSearching: boolean;
  tasks: Task[];
  memories: Memory[];
  settings: Settings;
  systemStats: { uptime: number; messageCount: number; memoryCount: number; taskCount: number };

  setActiveTab: (tab: string) => void;
  setIsListening: (v: boolean) => void;
  setIsProcessing: (v: boolean) => void;
  setIsSpeaking: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateLastMessage: (
    content: string,
    thinking?: string,
    duration?: number,
    extra?: { sources?: Source[]; ragUsed?: boolean; searchQuery?: string }
  ) => void;
  clearMessages: () => void;

  setVoiceSupported: (v: boolean) => void;
  setAudioLevel: (v: number) => void;
  setSearchResults: (v: SearchResult[]) => void;
  setIsSearching: (v: boolean) => void;
  setTasks: (v: Task[]) => void;
  addTask: (v: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setMemories: (v: Memory[]) => void;
  addMemory: (v: Memory) => void;
  setSettings: (v: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setSystemStats: (stats: Partial<NovaState['systemStats']>) => void;
}

export const useNovaStore = create<NovaState>((set) => ({
  activeTab: 'chat',
  isListening: false,
  isProcessing: false,
  isSpeaking: false,
  sidebarOpen: true,
  messages: [],
  sessionId: `session-${Date.now()}`,
  voiceSupported: false,
  audioLevel: 0,
  searchResults: [],
  isSearching: false,
  tasks: [],
  memories: [],
  settings: {
    wakeWord: 'Hey Nova', voiceEnabled: true, ttsEnabled: true, ttsSpeed: 1.0,
    ttsVoice: 'tongtong', theme: 'dark', language: 'en-US', proactiveEnabled: true,
    offlineMode: false, logLevel: 'info', safetyLevel: 'balanced',
  },
  systemStats: { uptime: 0, messageCount: 0, memoryCount: 0, taskCount: 0 },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsListening: (v) => set({ isListening: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setIsSpeaking: (v) => set({ isSpeaking: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  addMessage: (message) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((s) => ({
      messages: [...s.messages, { ...message, id, timestamp: new Date() }],
      systemStats: { ...s.systemStats, messageCount: s.systemStats.messageCount + 1 },
    }));
    return id;
  },

  updateLastMessage: (content, thinking, duration, extra) =>
    set((s) => {
      const msgs = [...s.messages];
      if (!msgs.length) return {};
      const last = msgs[msgs.length - 1];
      msgs[msgs.length - 1] = {
        ...last,
        content,
        // Keep old thinking if new one is empty string (means thinking just finished)
        thinking: thinking !== undefined ? (thinking || last.thinking) : last.thinking,
        duration: duration ?? last.duration,
        ...(extra || {}),
      };
      return { messages: msgs };
    }),

  clearMessages: () =>
    set((s) => ({
      messages: [],
      sessionId: `session-${Date.now()}`,
      systemStats: { ...s.systemStats, messageCount: 0 },
    })),

  setVoiceSupported: (v) => set({ voiceSupported: v }),
  setAudioLevel: (v) => set({ audioLevel: v }),
  setSearchResults: (v) => set({ searchResults: v }),
  setIsSearching: (v) => set({ isSearching: v }),
  setTasks: (tasks) => set((s) => ({ tasks, systemStats: { ...s.systemStats, taskCount: tasks.length } })),
  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks], systemStats: { ...s.systemStats, taskCount: s.systemStats.taskCount + 1 } })),
  updateTask: (id, updates) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t) })),
  setMemories: (memories) => set((s) => ({ memories, systemStats: { ...s.systemStats, memoryCount: memories.length } })),
  addMemory: (memory) => set((s) => ({ memories: [memory, ...s.memories], systemStats: { ...s.systemStats, memoryCount: s.systemStats.memoryCount + 1 } })),
  setSettings: (settings) => set({ settings }),
  updateSettings: (updates) => set((s) => ({ settings: { ...s.settings, ...updates } })),
  setSystemStats: (stats) => set((s) => ({ systemStats: { ...s.systemStats, ...stats } })),
}));
