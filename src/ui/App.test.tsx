import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Agent } from '../agent/Agent.js';

vi.mock('../execution.js', () => ({
  executeCommand: vi.fn().mockResolvedValue('command output'),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../models/ollama.js', () => ({
  fetchOllamaModels: vi.fn().mockResolvedValue([]),
}));

vi.mock('../models/persistence.js', () => ({
  saveModel: vi.fn(),
}));

vi.mock('../models/availability.js', () => ({
  availableModels: vi.fn().mockReturnValue([
    { id: 'claude-sonnet-4-6', provider: 'anthropic' },
    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
    { id: 'gpt-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', provider: 'openai' },
    { id: 'gemini-2.5-pro', provider: 'google' },
    { id: 'gemini-2.5-flash', provider: 'google' },
    { id: 'deepseek-v4-pro', provider: 'deepseek' },
  ]),
  unavailableProviderMessages: vi.fn().mockReturnValue([]),
}));

describe('App', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = {
      suggest: vi.fn(),
      setModel: vi.fn(),
      init: vi.fn(),
    } as unknown as Agent;
  });

  it('renders input bar and empty snippet hint on load', () => {
    const { lastFrame } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    expect(lastFrame()).toContain('Enter: submit');
    expect(lastFrame()).toContain('Type a request');
  });

  it('displays the initial model id', () => {
    const { lastFrame } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    expect(lastFrame()).toContain('claude-sonnet-4-6');
  });

  it('shows snippet after successful suggest', async () => {
    vi.mocked(agent.suggest).mockResolvedValue('const x = 1;');
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('declare a variable');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('shows error when suggest fails', async () => {
    vi.mocked(agent.suggest).mockRejectedValue(new Error('API rate limit'));
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('API rate limit');
  });

  it('calls agent.setModel with resolved ModelInfo when model is selected', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/model');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('falls back to ollama provider for free-text model names not in the list', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/model');
    stdin.write(' ');
    stdin.write('deepseek-r1:14b');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'deepseek-r1:14b', provider: 'ollama' });
  });

  it('shows error when setModel throws', () => {
    vi.mocked(agent.setModel).mockImplementation(() => { throw new Error('Unknown model'); });
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/model');
    stdin.write('\r');
    expect(lastFrame()).toContain('Unknown model');
  });

  it('shows notice when savedModelId is not found after Ollama fetch', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    const { lastFrame } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('Previously selected model "llama3.2" is not available.');
  });

  it('silently switches to savedModelId when found in Ollama results', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([{ id: 'llama3.2', provider: 'ollama' }]);
    render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'llama3.2', provider: 'ollama' });
  });

  it('does not show notice when savedModelId equals initialModelId (already resolved at startup)', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    const { lastFrame } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="claude-sonnet-4-6" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).not.toContain('Previously selected model');
  });

  it('clears notice when a new model is selected', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    const { lastFrame, stdin } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('Previously selected model "llama3.2" is not available.');
    stdin.write('/model');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).not.toContain('Previously selected model');
  });

  it('clears notice when a query is submitted', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    vi.mocked(agent.suggest).mockResolvedValue('const x = 1;');
    const { lastFrame, stdin } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('Previously selected model "llama3.2" is not available.');
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).not.toContain('Previously selected model');
  });

  it('calls agent.init and writes dragon.md when /init is submitted', async () => {
    const { writeFile } = await import('node:fs/promises');
    vi.mocked(agent.init).mockResolvedValue('# My Project\nA coding assistant.');
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/init');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(agent.init).toHaveBeenCalledWith(expect.any(Function));
    expect(writeFile).toHaveBeenCalledWith('./dragon.md', '# My Project\nA coding assistant.', 'utf-8');
    expect(lastFrame()).toContain('# My Project');
    expect(agent.suggest).not.toHaveBeenCalled();
  });

  it('displays tool calls as they are fired during loading', async () => {
    vi.mocked(agent.suggest).mockImplementation(async (_q, onToolCall) => {
      onToolCall?.('read_file', { path: 'package.json' });
      return 'const x = 1;';
    });
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('describe the project');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('executes platform shell command when query starts with !', async () => {
    const { executeCommand } = await import('../execution.js');
    vi.mocked(executeCommand).mockResolvedValueOnce('hello');
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('! echo hello');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(vi.mocked(executeCommand)).toHaveBeenCalledWith('echo hello', 'platform');
    expect(lastFrame()).toContain('hello');
  });

  it('executes powershell command when query starts with !!', async () => {
    const { executeCommand } = await import('../execution.js');
    vi.mocked(executeCommand).mockResolvedValueOnce('ps-output');
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('!! Get-Date');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(vi.mocked(executeCommand)).toHaveBeenCalledWith('Get-Date', 'powershell');
  });

  it('does not call agent.suggest for shell commands', async () => {
    const { executeCommand } = await import('../execution.js');
    vi.mocked(executeCommand).mockResolvedValueOnce('ok');
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('! dir');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(agent.suggest).not.toHaveBeenCalled();
  });

  it('pushes previous query and snippet into history when a new request is submitted', async () => {
    vi.mocked(agent.suggest).mockResolvedValue('const x = 1;');
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('first query');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
    stdin.write('second query');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('> first query');
    expect(lastFrame()).toContain('> second query');
  });

  it('passes unavailable provider notices to InputBar', async () => {
    const { unavailableProviderMessages } = await import('../models/availability.js');
    vi.mocked(unavailableProviderMessages).mockReturnValueOnce([
      'Google models are not available without GOOGLE_API_KEY',
    ]);
    const { lastFrame, stdin } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />
    );
    stdin.write('/model');
    expect(lastFrame()).toContain('Google models are not available without GOOGLE_API_KEY');
  });
});
