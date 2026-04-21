import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeProvider } from './claude.js';
import Anthropic from '@anthropic-ai/sdk';

vi.mock('@anthropic-ai/sdk');

describe('ClaudeProvider', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);
  });

  it('returns trimmed text from API response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '  function foo() {}  ' }],
    });
    const provider = new ClaudeProvider('test-key');
    const result = await provider.suggest('write a foo function');
    expect(result).toBe('function foo() {}');
  });

  it('includes language in the system prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'fn foo() {}' }],
    });
    const provider = new ClaudeProvider('test-key');
    await provider.suggest('write a foo function', 'rust');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Use rust'),
      })
    );
  });

  it('throws when response content is not text', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'image', source: {} }] });
    const provider = new ClaudeProvider('test-key');
    await expect(provider.suggest('foo')).rejects.toThrow('Unexpected response type');
  });
});
