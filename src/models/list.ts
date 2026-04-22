export type ModelProvider = 'anthropic' | 'openai' | 'ollama' | 'google';

export interface ModelInfo {
  id: string;
  provider: ModelProvider;
}

export const MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-6', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  { id: 'gpt-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', provider: 'openai' },
  { id: 'gemini-2.5-pro', provider: 'google' },
  { id: 'gemini-2.5-flash', provider: 'google' },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
