import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MODELS } from './list.js';

export function createModel(id: string): BaseChatModel {
  const info = MODELS.find(m => m.id === id);
  if (!info) {
    throw new Error(`Unknown model: "${id}". Valid models: ${MODELS.map(m => m.id).join(', ')}`);
  }
  if (info.provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Claude models.');
    return new ChatAnthropic({ model: id, anthropicApiKey: apiKey });
  }
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI models.');
  return new ChatOpenAI({ model: id, openAIApiKey: apiKey });
}
