import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/registry.js', () => ({ createModel: vi.fn() }));
vi.mock('../tool/listFiles.js', () => ({
  listFilesTool: { name: 'list_files', invoke: vi.fn() },
  listFilesInDir: vi.fn().mockResolvedValue('src/\npackage.json'),
}));

import { Agent } from './Agent.js';
import { createModel } from '../models/registry.js';
import { listFilesTool, listFilesInDir } from '../tool/listFiles.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

describe('Agent', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;
  let mockBoundInvoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBoundInvoke = vi.fn();
    mockInvoke = vi.fn();
    vi.mocked(createModel).mockReturnValue({
      invoke: mockInvoke,
      bindTools: vi.fn().mockReturnValue({ invoke: mockBoundInvoke }),
    } as unknown as BaseChatModel);
  });

  it('resolves ModelInfo and calls createModel on construction', () => {
    new Agent('claude-sonnet-4-6');
    expect(createModel).toHaveBeenCalledWith({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('throws for unknown model id in constructor', () => {
    expect(() => new Agent('unknown-model')).toThrow('Unknown model: "unknown-model"');
  });

  it('returns trimmed text from suggest when no tool calls', async () => {
    mockBoundInvoke.mockResolvedValue({ content: '  const x = 1;  ', tool_calls: [] });
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
    mockBoundInvoke.mockResolvedValue({ content: [{ type: 'image' }], tool_calls: [] });
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('Unexpected response type');
  });

  it('propagates model errors', async () => {
    mockBoundInvoke.mockRejectedValue(new Error('API error'));
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('API error');
  });

  it('invokes tool and continues loop when model returns tool calls', async () => {
    vi.mocked(listFilesTool.invoke).mockResolvedValue('src/\npackage.json');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'call-1', name: 'list_files', args: { path: '.' } }],
      })
      .mockResolvedValueOnce({ content: 'const x = 1;', tool_calls: [] });

    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.suggest('list my project files then write code');

    expect(listFilesTool.invoke).toHaveBeenCalledWith({ path: '.' });
    expect(result).toBe('const x = 1;');
    expect(mockBoundInvoke).toHaveBeenCalledTimes(2);
  });

  it('init() lists files directly and passes them to the model', async () => {
    vi.mocked(listFilesInDir).mockResolvedValue('src/\npackage.json');
    mockInvoke.mockResolvedValue({ content: '# My Project\nA coding assistant.' });
    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.init();
    expect(listFilesInDir).toHaveBeenCalledWith('.');
    expect(result).toBe('# My Project\nA coding assistant.');
  });

  it('init() throws when model response is not a string', async () => {
    vi.mocked(listFilesInDir).mockResolvedValue('src/');
    mockInvoke.mockResolvedValue({ content: [{ type: 'image' }] });
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.init()).rejects.toThrow('Unexpected response type');
  });
});
