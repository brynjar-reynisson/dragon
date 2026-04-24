import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';
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
  if (info.provider === 'google') {
    const apiKey = process.env['GOOGLE_API_KEY'];
    if (!apiKey) throw new Error('GOOGLE_API_KEY is required for Google models.');
    return new ChatGoogleGenerativeAI({ model: info.id, apiKey });
  }
  if (info.provider === 'deepseek') {
    const apiKey = process.env['DEEPSEEK_API_KEY'];
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required for DeepSeek models.');
    return new ChatDeepSeek({ model: info.id, apiKey });
  }
  const _exhaustive: never = info.provider;
  throw new Error(`Unsupported provider: ${_exhaustive}`);
}
