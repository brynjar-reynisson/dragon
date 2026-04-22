import { MODELS, type ModelInfo, type ModelProvider } from './list.js';

const PROVIDER_ENV: Partial<Record<ModelProvider, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

const PROVIDER_DISPLAY: Partial<Record<ModelProvider, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

function hasKey(provider: ModelProvider): boolean {
  const envVar = PROVIDER_ENV[provider];
  if (!envVar) return true;
  return !!process.env[envVar];
}

export function availableModels(): ModelInfo[] {
  return MODELS.filter(m => hasKey(m.provider));
}

export function unavailableProviderMessages(): string[] {
  const seen = new Set<ModelProvider>();
  const messages: string[] = [];
  for (const m of MODELS) {
    if (seen.has(m.provider)) continue;
    seen.add(m.provider);
    if (!hasKey(m.provider)) {
      const envVar = PROVIDER_ENV[m.provider]!;
      const display = PROVIDER_DISPLAY[m.provider]!;
      messages.push(`${display} models are not available without ${envVar}`);
    }
  }
  return messages;
}
