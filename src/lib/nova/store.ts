/**
 * Nova AI Assistant - Global State Management
 * Using Zustand for client-side state
 */

import { create } from 'zustand';

export interface Source {
  id: number; title: string; url: string; domain: string; snippet: string;
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
  // UI State
  activeTab: 'chat' | 'memory' | 'tasks' | 'settings' | 'logs';
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  sidebarOpen: boolean;

  // Chat State
  messages: Message[];
  sessionId: string;

  // Voice State
  voiceSupported: boolean;
  audioLevel: number;

  // Search State
  searchResults: SearchResult[];
  isSearching: boolean;

  // Data State
  tasks: Task[];
  memories: Memory[];
  settings: Settings;

  // System Stats
  systemStats: {
    uptime: number;
    messageCount: number;
    memoryCount: number;
    taskCount: number;
  };

  // Actions
  setActiveTab: (tab: NovaState['activeTab']) => void;
  setIsListening: (listening: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateLastMessage: (content: string, thinking?: string, duration?: number, extra?: { sources?: Source[]; ragUsed?: boolean; searchQuery?: string }) => void;
  clearMessages: () => void;
  
  setVoiceSupported: (supported: boolean) => void;
  setAudioLevel: (level: number) => void;
  
  setSearchResults: (results: SearchResult[]) => void;
  setIsSearching: (searching: boolean) => void;
  
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  
  setMemories: (memories: Memory[]) => void;
  addMemory: (memory: Memory) => void;
  
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  
  setSystemStats: (stats: Partial<NovaState['systemStats']>) => void;
}

export const useNovaStore = create<NovaState>((set) => ({
  // Initial UI State
  activeTab: 'chat',
  isListening: false,
  isProcessing: false,
  isSpeaking: false,
  sidebarOpen: true,

  // Initial Chat State
  messages: [],
  sessionId: `session-${Date.now()}`,

  // Initial Voice State
  voiceSupported: false,
  audioLevel: 0,

  // Initial Search State
  searchResults: [],
  isSearching: false,

  // Initial Data State
  tasks: [],
  memories: [],
  settings: {
    wakeWord: 'Hey Nova',
    voiceEnabled: true,
    ttsEnabled: true,
    ttsSpeed: 1.0,
    ttsVoice: 'tongtong',
    theme: 'dark',
    language: 'en-US',
    proactiveEnabled: true,
    offlineMode: false,
    logLevel: 'info',
  },

  // Initial System Stats
  systemStats: {
    uptime: 0,
    messageCount: 0,
    memoryCount: 0,
    taskCount: 0,
  },

  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsListening: (listening) => set({ isListening: listening }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  addMessage: (message) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id,
          timestamp: new Date(),
        },
      ],
      systemStats: {
        ...state.systemStats,
        messageCount: state.systemStats.messageCount + 1,
      },
    }));
    return id;
  },

  updateLastMessage: (content, thinking, duration, extra) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        messages[messages.length - 1] = {
          ...lastMessage,
          content,
          thinking: thinking || lastMessage.thinking,
          duration: duration || lastMessage.duration,
          ...(extra || {}),
        };
      }
      return { messages };
    }),

  clearMessages: () =>
    set((state) => ({
      messages: [],
      sessionId: `session-${Date.now()}`,
      systemStats: {
        ...state.systemStats,
        messageCount: 0,
      },
    })),

  setVoiceSupported: (supported) => set({ voiceSupported: supported }),
  setAudioLevel: (level) => set({ audioLevel: level }),

  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),

  setTasks: (tasks) =>
    set((state) => ({
      tasks,
      systemStats: {
        ...state.systemStats,
        taskCount: tasks.length,
      },
    })),

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks],
      systemStats: {
        ...state.systemStats,
        taskCount: state.systemStats.taskCount + 1,
      },
    })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    })),

  setMemories: (memories) =>
    set((state) => ({
      memories,
      systemStats: {
        ...state.systemStats,
        memoryCount: memories.length,
      },
    })),

  addMemory: (memory) =>
    set((state) => ({
      memories: [memory, ...state.memories],
      systemStats: {
        ...state.systemStats,
        memoryCount: state.systemStats.memoryCount + 1,
      },
    })),

  setSettings: (settings) => set({ settings }),

  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  setSystemStats: (stats) =>
    set((state) => ({
      systemStats: { ...state.systemStats, ...stats },
    })),
}));
