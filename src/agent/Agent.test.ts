import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/registry.js', () => ({ createModel: vi.fn() }));
vi.mock('../tool/listFiles.js', () => ({
  listFilesTool: { name: 'list_files', invoke: vi.fn() },
  listFilesInDir: vi.fn().mockResolvedValue('src/\npackage.json'),
}));

vi.mock('../tool/readFile.js', () => ({
  readFileTool: { name: 'read_file', invoke: vi.fn() },
}));

vi.mock('../tool/grepFiles.js', () => ({
  grepFilesTool: { name: 'grep_files', invoke: vi.fn() },
}));

import { Agent } from './Agent.js';
import { createModel } from '../models/registry.js';
import { listFilesTool, listFilesInDir } from '../tool/listFiles.js';
import { readFileTool } from '../tool/readFile.js';
import { grepFilesTool } from '../tool/grepFiles.js';
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

  it('throws with type and content when response content is not a string', async () => {
    mockBoundInvoke.mockResolvedValue({ content: [{ type: 'image' }], tool_calls: [] });
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('Unexpected response type: object');
  });

  it('propagates model errors', async () => {
    mockBoundInvoke.mockRejectedValue(new Error('API error'));
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('API error');
  });

  it('suggest() invokes list_files tool and continues loop', async () => {
    vi.mocked(listFilesTool.invoke).mockResolvedValue('src/\npackage.json');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'call-1', name: 'list_files', args: { path: '.' } }],
        additional_kwargs: {},
      })
      .mockResolvedValueOnce({ content: 'const x = 1;', tool_calls: [] });

    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.suggest('list my project files then write code');

    expect(listFilesTool.invoke).toHaveBeenCalledWith({ path: '.' });
    expect(result).toBe('const x = 1;');
    expect(mockBoundInvoke).toHaveBeenCalledTimes(2);
  });

  it('suggest() fires onToolCall for each tool invocation', async () => {
    vi.mocked(listFilesTool.invoke).mockResolvedValue('src/');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'c1', name: 'list_files', args: { path: '.' } }],
        additional_kwargs: {},
      })
      .mockResolvedValueOnce({ content: 'done', tool_calls: [] });

    const onToolCall = vi.fn();
    const agent = new Agent('claude-sonnet-4-6');
    await agent.suggest('foo', onToolCall);

    expect(onToolCall).toHaveBeenCalledWith('list_files', { path: '.' });
  });

  it('suggest() handles thinking model by rebuilding conversation instead of passing back AIMessage', async () => {
    vi.mocked(listFilesTool.invoke).mockResolvedValue('src/');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'c1', name: 'list_files', args: { path: '.' } }],
        additional_kwargs: { reasoning_content: 'let me think...' },
      })
      .mockResolvedValueOnce({ content: 'const x = 1;', tool_calls: [], additional_kwargs: {} });

    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.suggest('foo');

    expect(result).toBe('const x = 1;');
    // Second call should receive a fresh HumanMessage with tool context, not the AIMessage
    const secondCallMessages = mockBoundInvoke.mock.calls[1][0] as Array<{ constructor: { name: string } }>;
    expect(secondCallMessages).toHaveLength(2); // SystemMessage + HumanMessage only
  });

  it('edit() returns suggested changes from the model', async () => {
    mockBoundInvoke.mockResolvedValue({
      content: 'FILE: src/app.ts\nDELETE:\nconst x = 1;\nREPLACE WITH:\nconst x = 2;\n---',
      tool_calls: [],
    });
    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.edit('rename x to use value 2 in src/app.ts');
    expect(result).toContain('FILE: src/app.ts');
    expect(result).toContain('REPLACE WITH:');
  });

  it('edit() fires onToolCall when tools are used', async () => {
    vi.mocked(grepFilesTool.invoke).mockResolvedValue('src/app.ts:1:const x = 1;');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'c1', name: 'grep_files', args: { pattern: 'const x' } }],
        additional_kwargs: {},
      })
      .mockResolvedValueOnce({
        content: 'FILE: src/app.ts\nDELETE:\nconst x = 1;\nREPLACE WITH:\nconst x = 2;\n---',
        tool_calls: [],
      });
    const onToolCall = vi.fn();
    const agent = new Agent('claude-sonnet-4-6');
    await agent.edit('rename x', onToolCall);
    expect(onToolCall).toHaveBeenCalledWith('grep_files', { pattern: 'const x' });
  });

  it('init() lists files and passes tree to the model', async () => {
    vi.mocked(listFilesInDir).mockResolvedValue('src/\npackage.json');
    mockBoundInvoke.mockResolvedValue({ content: '# My Project\nA coding assistant.', tool_calls: [] });
    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.init();
    expect(listFilesInDir).toHaveBeenCalledWith('.');
    expect(result).toBe('# My Project\nA coding assistant.');
  });

  it('init() invokes read_file tool when model requests it', async () => {
    vi.mocked(listFilesInDir).mockResolvedValue('package.json');
    vi.mocked(readFileTool.invoke).mockResolvedValue('{"name":"dragon"}');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'call-1', name: 'read_file', args: { path: 'package.json' } }],
        additional_kwargs: {},
      })
      .mockResolvedValueOnce({ content: '# Dragon\nA TUI coding assistant.', tool_calls: [] });

    const agent = new Agent('claude-sonnet-4-6');
    const result = await agent.init();

    expect(readFileTool.invoke).toHaveBeenCalledWith({ path: 'package.json' });
    expect(result).toBe('# Dragon\nA TUI coding assistant.');
  });

  it('init() fires onToolCall when reading files', async () => {
    vi.mocked(listFilesInDir).mockResolvedValue('package.json');
    vi.mocked(readFileTool.invoke).mockResolvedValue('{}');
    mockBoundInvoke
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'c1', name: 'read_file', args: { path: 'package.json' } }],
        additional_kwargs: {},
      })
      .mockResolvedValueOnce({ content: '# Done', tool_calls: [] });

    const onToolCall = vi.fn();
    const agent = new Agent('claude-sonnet-4-6');
    await agent.init(onToolCall);

    expect(onToolCall).toHaveBeenCalledWith('read_file', { path: 'package.json' });
  });

  it('init() throws with type and content when final model response is not a string', async () => {
    vi.mocked(listFilesInDir).mockResolvedValue('src/');
    mockBoundInvoke.mockResolvedValue({ content: [{ type: 'image' }], tool_calls: [] });
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.init()).rejects.toThrow('Unexpected response type: object');
  });
});
