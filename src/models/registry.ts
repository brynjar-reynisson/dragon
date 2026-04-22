import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ModelInfo } from './list.js';

export function createModel(info: ModelInfo): BaseChatModel {
  if (info.provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Claude models.');
    return new ChatAnthropic({ model: info.id, anthropicApiKey: apiKey });
  }
  if (info.provider === 'openai') {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI models.');
    return new ChatOpenAI({ model: info.id, apiKey });
  }
  if (info.provider === 'ollama') {
    return new ChatOllama({ model: info.id });
  }
  const _exhaustive: never = info.provider;
  throw new Error(`Unsupported provider: ${_exhaustive}`);
}
