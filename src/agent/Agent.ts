import type { Provider } from '../providers/types.js';

export class Agent {
  constructor(private readonly provider: Provider) {}

  suggest(prompt: string, language?: string): Promise<string> {
    return this.provider.suggest(prompt, language);
  }
}
