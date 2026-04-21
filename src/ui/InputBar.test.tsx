import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { InputBar } from './InputBar.js';

describe('InputBar', () => {
  it('shows keyboard hints', () => {
    const { lastFrame } = render(
      <InputBar disabled={false} onSubmit={vi.fn()} />
    );
    expect(lastFrame()).toContain('Ctrl+L');
    expect(lastFrame()).toContain('Enter');
  });

  it('calls onSubmit with query and no language when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<InputBar disabled={false} onSubmit={onSubmit} />);
    stdin.write('debounce function');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('debounce function', undefined);
  });

  it('still renders when disabled', () => {
    const { lastFrame } = render(
      <InputBar disabled={true} onSubmit={vi.fn()} />
    );
    expect(lastFrame()).toContain('Ctrl+L');
  });
});
