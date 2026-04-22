import type { ModelInfo } from './list.js';

interface OllamaModel {
  name: string;
  modified_at: string;
}

export async function fetchOllamaModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return [];
    const data = await response.json() as { models: OllamaModel[] };
    if (!Array.isArray(data.models)) return [];

    const groups = new Map<string, OllamaModel>();
    for (const model of data.models) {
      const family = model.name.split(':')[0];
      const existing = groups.get(family);
      if (!existing || new Date(model.modified_at) > new Date(existing.modified_at)) {
        groups.set(family, model);
      }
    }

    return Array.from(groups.values()).map(m => ({ id: m.name, provider: 'ollama' as const }));
  } catch {
    return [];
  }
}
