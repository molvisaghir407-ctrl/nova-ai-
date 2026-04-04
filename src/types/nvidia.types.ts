export interface NIMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | NIMContentPart[];
}

export interface NIMContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface NIMStreamDelta {
  content?: string;
  reasoning_content?: string;
  role?: string;
}

export interface NIMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: NIMStreamDelta;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NIMThinkingConfig {
  type: 'enabled' | 'disabled';
  budget_tokens?: number;
}

export interface NIMChatOptions {
  model: string;
  messages: NIMChatMessage[];
  stream: boolean;
  max_tokens: number;
  temperature: number;
  top_p: number;
  thinking?: NIMThinkingConfig;
}

export type NIMTask =
  | 'chat_general' | 'chat_fast' | 'chat_thinking'
  | 'code_generation' | 'code_review' | 'math_reasoning'
  | 'vision_analysis' | 'vision_fast'
  | 'image_gen_hq' | 'image_gen_fast'
  | 'long_context' | 'summarize' | 'rerank';
