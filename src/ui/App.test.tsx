import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Agent } from '../agent/Agent.js';

describe('App', () => {
  it('renders input bar and empty snippet hint on load', () => {
    const agent = { suggest: vi.fn() } as unknown as Agent;
    const { lastFrame } = render(<App agent={agent} />);
    expect(lastFrame()).toContain('Ctrl+L');
    expect(lastFrame()).toContain('Type a request');
  });

  it('shows snippet after successful suggest', async () => {
    const agent = {
      suggest: vi.fn().mockResolvedValue('const x = 1;'),
    } as unknown as Agent;
    const { lastFrame, stdin } = render(<App agent={agent} />);
    stdin.write('declare a variable');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('shows error message when suggest fails', async () => {
    const agent = {
      suggest: vi.fn().mockRejectedValue(new Error('API rate limit')),
    } as unknown as Agent;
    const { lastFrame, stdin } = render(<App agent={agent} />);
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('API rate limit');
  });
});
