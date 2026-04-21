import { describe, it, expect, vi } from 'vitest';
import { Agent } from './Agent.js';
import type { Provider } from '../providers/types.js';

describe('Agent', () => {
  it('delegates suggest to the provider', async () => {
    const provider: Provider = { suggest: vi.fn().mockResolvedValue('const x = 1;') };
    const agent = new Agent(provider);
    const result = await agent.suggest('declare a variable', 'typescript');
    expect(result).toBe('const x = 1;');
    expect(provider.suggest).toHaveBeenCalledWith('declare a variable', 'typescript');
  });

  it('propagates provider errors', async () => {
    const provider: Provider = { suggest: vi.fn().mockRejectedValue(new Error('API error')) };
    const agent = new Agent(provider);
    await expect(agent.suggest('foo')).rejects.toThrow('API error');
  });
});
