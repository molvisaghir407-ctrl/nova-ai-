import { create } from 'zustand';
import type { ExtMessage, ConversationMeta, Source } from '@/types/nova.types';

export type { ExtMessage, Source };

export interface Message extends ExtMessage {}

export interface Task { id: string; title: string; description?: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled'; priority: number; dueDate?: Date; createdAt: Date }
export interface Memory { id: string; category: string; content: string; importance: number; createdAt: Date }
export interface Settings { wakeWord: string; voiceEnabled: boolean; ttsEnabled: boolean; ttsSpeed: number; ttsVoice: string; theme: 'light' | 'dark' | 'system'; language: string; proactiveEnabled: boolean; offlineMode: boolean; logLevel: string; safetyLevel: 'strict' | 'balanced' | 'permissive' }

interface NovaState {
  messages: ExtMessage[];
  sessions: ConversationMeta[];
  tasks: Task[];
  memories: Memory[];
  settings: Settings;
  systemStats: { uptime: number; messageCount: number; memoryCount: number; taskCount: number };

  addMessage(msg: Omit<ExtMessage, 'id' | 'timestamp'>): string;
  updateLastMessage(id: string, content: string, thinking?: string, duration?: number, extra?: { sources?: Source[]; ragUsed?: boolean; thinkingDuration?: number }): void;
  clearMessages(): void;
  setTasks(tasks: Task[]): void;
  addTask(task: Task): void;
  updateTask(id: string, updates: Partial<Task>): void;
  setMemories(memories: Memory[]): void;
  addMemory(memory: Memory): void;
  setSettings(settings: Settings): void;
  updateSettings(updates: Partial<Settings>): void;
  setSystemStats(stats: Partial<NovaState['systemStats']>): void;
}

export const useNovaStore = create<NovaState>(set => ({
  messages: [],
  sessions: [],
  tasks: [],
  memories: [],
  settings: { wakeWord: 'Hey Nova', voiceEnabled: true, ttsEnabled: true, ttsSpeed: 1.0, ttsVoice: 'default', theme: 'dark', language: 'en-US', proactiveEnabled: true, offlineMode: false, logLevel: 'info', safetyLevel: 'balanced' },
  systemStats: { uptime: 0, messageCount: 0, memoryCount: 0, taskCount: 0 },

  addMessage(msg) {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set(s => ({ messages: [...s.messages, { ...msg, id, timestamp: new Date() }], systemStats: { ...s.systemStats, messageCount: s.systemStats.messageCount + 1 } }));
    return id;
  },

  updateLastMessage(id, content, thinking, duration, extra) {
    set(s => {
      const msgs = [...s.messages];
      const idx = msgs.findIndex(m => m.id === id);
      if (idx === -1) return {};
      const msg = msgs[idx]!;
      msgs[idx] = {
        ...msg, content,
        thinking: thinking !== undefined ? (thinking || msg.thinking) : msg.thinking,
        duration: duration ?? msg.duration,
        ...(extra ?? {}),
      };
      return { messages: msgs };
    });
  },

  clearMessages: () => set(s => ({ messages: [], systemStats: { ...s.systemStats, messageCount: 0 } })),
  setTasks: tasks => set(s => ({ tasks, systemStats: { ...s.systemStats, taskCount: tasks.length } })),
  addTask: task => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, updates) => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) })),
  setMemories: memories => set(s => ({ memories, systemStats: { ...s.systemStats, memoryCount: memories.length } })),
  addMemory: memory => set(s => ({ memories: [memory, ...s.memories] })),
  setSettings: settings => set({ settings }),
  updateSettings: updates => set(s => ({ settings: { ...s.settings, ...updates } })),
  setSystemStats: stats => set(s => ({ systemStats: { ...s.systemStats, ...stats } })),
}));
