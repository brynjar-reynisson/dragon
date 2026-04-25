import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/registry.js', () => ({ createModel: vi.fn() }));

import { Agent } from './Agent.js';
import { createModel } from '../models/registry.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

describe('Agent', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke = vi.fn();
    vi.mocked(createModel).mockReturnValue({ invoke: mockInvoke } as unknown as BaseChatModel);
  });

  it('resolves ModelInfo and calls createModel on construction', () => {
    new Agent('claude-sonnet-4-6');
    expect(createModel).toHaveBeenCalledWith({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('throws for unknown model id in constructor', () => {
    expect(() => new Agent('unknown-model')).toThrow('Unknown model: "unknown-model"');
  });

  it('returns trimmed text from suggest', async () => {
    mockInvoke.mockResolvedValue({ content: '  const x = 1;  ' });
    const agent = new Agent('claude-sonnet-4-6');
    expect(await agent.suggest('declare a variable')).toBe('const x = 1;');
  });

  it('setModel calls createModel with the provided ModelInfo', () => {
    const agent = new Agent('claude-sonnet-4-6');
    vi.mocked(createModel).mockClear();
    agent.setModel({ id: 'llama3.2:latest', provider: 'ollama' });
    expect(createModel).toHaveBeenCalledWith({ id: 'llama3.2:latest', provider: 'ollama' });
  });

  it('throws when response content is not a string', async () => {
    mockInvoke.mockResolvedValue({ content: [{ type: 'image' }] });
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('Unexpected response type');
  });

  it('propagates model errors', async () => {
    mockInvoke.mockRejectedValue(new Error('API error'));
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('API error');
  });
});
