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

  it('calls createModel with initial model id on construction', () => {
    new Agent('claude-sonnet-4-6');
    expect(createModel).toHaveBeenCalledWith('claude-sonnet-4-6');
  });

  it('returns trimmed text from suggest', async () => {
    mockInvoke.mockResolvedValue({ content: '  const x = 1;  ' });
    const agent = new Agent('claude-sonnet-4-6');
    expect(await agent.suggest('declare a variable')).toBe('const x = 1;');
  });

  it('includes language in system message when provided', async () => {
    mockInvoke.mockResolvedValue({ content: 'fn foo() {}' });
    const agent = new Agent('claude-sonnet-4-6');
    await agent.suggest('write foo', 'rust');
    const [systemMsg] = mockInvoke.mock.calls[0][0];
    expect(systemMsg.content).toContain('Use rust');
  });

  it('setModel calls createModel with new id', () => {
    const agent = new Agent('claude-sonnet-4-6');
    vi.mocked(createModel).mockClear();
    agent.setModel('gpt-4o');
    expect(createModel).toHaveBeenCalledWith('gpt-4o');
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
