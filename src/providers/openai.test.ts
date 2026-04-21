import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from './openai.js';
import OpenAI from 'openai';

vi.mock('openai');

describe('OpenAIProvider', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);
  });

  it('returns trimmed text from API response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '  const x = 1;  ' } }],
    });
    const provider = new OpenAIProvider('test-key');
    const result = await provider.suggest('declare a variable');
    expect(result).toBe('const x = 1;');
  });

  it('includes language in the system prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'let x = 1' } }],
    });
    const provider = new OpenAIProvider('test-key');
    await provider.suggest('declare a variable', 'typescript');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Use typescript'),
          }),
        ]),
      })
    );
  });

  it('handles null message content gracefully', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });
    const provider = new OpenAIProvider('test-key');
    const result = await provider.suggest('foo');
    expect(result).toBe('');
  });
});
