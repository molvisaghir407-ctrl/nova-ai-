export interface NovaSettings {
  // Chat
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  thinkingBudget: number;
  autoThinking: boolean;
  contextWindow: number;
  systemPromptAppend: string;
  // RAG
  ragEnabled: boolean;
  ragAgentCount: number;
  ragCacheEnabled: boolean;
  ragCacheTTL: number;
  ragMaxResults: number;
  ragAutoDetect: boolean;
  // Memory
  memoryEnabled: boolean;
  memoryAutoStore: boolean;
  memoryMaxEntries: number;
  // UI
  theme: 'dark' | 'darker' | 'midnight' | 'system';
  accentColor: 'violet' | 'cyan' | 'emerald' | 'rose' | 'amber';
  fontSize: 'sm' | 'base' | 'lg';
  animationsEnabled: boolean;
  codeTheme: 'oneDark' | 'github' | 'dracula' | 'nord';
  markdownEnabled: boolean;
  // Voice
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  ttsSpeed: number;
  ttsAutoPlay: boolean;
  // Privacy
  safetyLevel: 'strict' | 'balanced' | 'permissive';
  loggingEnabled: boolean;
  analyticsEnabled: boolean;
  // Advanced
  debugMode: boolean;
  experimentalFeatures: boolean;
  // Legacy compat
  proactiveEnabled: boolean;
  offlineMode: boolean;
  logLevel: string;
  ttsVoice: string;
  language: string;
  wakeWord: string;
}

export const DEFAULT_SETTINGS: NovaSettings = {
  defaultModel: 'moonshotai/kimi-k2-instruct',
  maxTokens: 16000,
  temperature: 0.6,
  topP: 0.95,
  thinkingBudget: 8000,
  autoThinking: false,
  contextWindow: 120,
  systemPromptAppend: '',
  ragEnabled: true,
  ragAgentCount: 10,
  ragCacheEnabled: true,
  ragCacheTTL: 30,
  ragMaxResults: 8,
  ragAutoDetect: true,
  memoryEnabled: true,
  memoryAutoStore: true,
  memoryMaxEntries: 1000,
  theme: 'dark',
  accentColor: 'violet',
  fontSize: 'base',
  animationsEnabled: true,
  codeTheme: 'oneDark',
  markdownEnabled: true,
  voiceEnabled: true,
  ttsEnabled: true,
  ttsSpeed: 1.0,
  ttsAutoPlay: false,
  safetyLevel: 'balanced',
  loggingEnabled: true,
  analyticsEnabled: false,
  debugMode: false,
  experimentalFeatures: false,
  proactiveEnabled: true,
  offlineMode: false,
  logLevel: 'info',
  ttsVoice: 'default',
  language: 'en-US',
  wakeWord: 'Hey Nova',
};
