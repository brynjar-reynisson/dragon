import OpenAI from 'openai';
import type { Provider } from './types.js';

export class OpenAIProvider implements Provider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async suggest(prompt: string, language?: string): Promise<string> {
    const langInstruction = language ? ` Use ${language}.` : '';
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a coding assistant. Return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.${langInstruction}`,
        },
        { role: 'user', content: prompt },
      ],
    });
    const choice = response.choices[0];
    if (!choice) throw new Error('OpenAI returned no choices');
    return (choice.message.content ?? '').trim();
  }
}
