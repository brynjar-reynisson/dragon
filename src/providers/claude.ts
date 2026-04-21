import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from './types.js';

export class ClaudeProvider implements Provider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async suggest(prompt: string, language?: string): Promise<string> {
    const langInstruction = language ? ` Use ${language}.` : '';
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a coding assistant. Return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.${langInstruction}`,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');
    return content.text.trim();
  }
}
