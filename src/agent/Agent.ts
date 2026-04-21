import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createModel } from '../models/registry.js';

export class Agent {
  private model: BaseChatModel;

  constructor(initialModelId: string) {
    this.model = createModel(initialModelId);
  }

  setModel(id: string): void {
    this.model = createModel(id);
  }

  async suggest(prompt: string, language?: string): Promise<string> {
    const langInstruction = language ? ` Use ${language}.` : '';
    const system = `You are a coding assistant. Return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.${langInstruction}`;
    const result = await this.model.invoke([
      new SystemMessage(system),
      new HumanMessage(prompt),
    ]);
    if (typeof result.content !== 'string') throw new Error('Unexpected response type');
    return result.content.trim();
  }
}
