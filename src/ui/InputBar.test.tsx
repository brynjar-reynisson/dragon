import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { InputBar } from './InputBar.js';

function makeProps(overrides: Partial<Parameters<typeof InputBar>[0]> = {}) {
  return {
    disabled: false,
    selectedModel: 'claude-sonnet-4-6',
    onSubmit: vi.fn(),
    onModelChange: vi.fn(),
    ...overrides,
  };
}

describe('InputBar', () => {
  it('shows model badge and keyboard hints', () => {
    const { lastFrame } = render(<InputBar {...makeProps()} />);
    expect(lastFrame()).toContain('[claude-sonnet-4-6]');
    expect(lastFrame()).toContain('Ctrl+L');
    expect(lastFrame()).toContain('Enter');
  });

  it('calls onSubmit with query and no language when Enter is pressed', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<InputBar {...makeProps({ onSubmit })} />);
    stdin.write('debounce function');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('debounce function', undefined);
  });

  it('shows model picker when /model is typed', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps()} />);
    stdin.write('/model');
    expect(lastFrame()).toContain('claude-sonnet-4-6');
    expect(lastFrame()).toContain('gpt-4o');
    expect(lastFrame()).toContain('↑↓: navigate');
  });

  it('highlights first model with cursor indicator', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps()} />);
    stdin.write('/model');
    expect(lastFrame()).toContain('▶ claude-sonnet-4-6');
  });

  it('moves cursor down with down arrow', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps()} />);
    stdin.write('/model');
    stdin.write('\x1b[B');
    expect(lastFrame()).toContain('▶ claude-haiku-4-5-20251001');
  });

  it('calls onModelChange with selected model on Enter in picker', () => {
    const onModelChange = vi.fn();
    const { stdin } = render(<InputBar {...makeProps({ onModelChange })} />);
    stdin.write('/model');
    stdin.write('\x1b[B');
    stdin.write('\r');
    expect(onModelChange).toHaveBeenCalledWith('claude-haiku-4-5-20251001');
  });

  it('switches to freetext mode on Space in picker', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps()} />);
    stdin.write('/model');
    stdin.write(' ');
    expect(lastFrame()).toContain('model:');
  });

  it('calls onModelChange with typed model name in freetext mode', () => {
    const onModelChange = vi.fn();
    const { stdin } = render(<InputBar {...makeProps({ onModelChange })} />);
    stdin.write('/model');
    stdin.write(' ');
    stdin.write('gpt-4o-mini');
    stdin.write('\r');
    expect(onModelChange).toHaveBeenCalledWith('gpt-4o-mini');
  });

  it('cancels model selection with Esc and returns to default hints', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps()} />);
    stdin.write('/model');
    expect(lastFrame()).toContain('↑↓: navigate');
    stdin.write('\x1b');
    expect(lastFrame()).toContain('Ctrl+L');
  });

  it('still renders when disabled', () => {
    const { lastFrame } = render(<InputBar {...makeProps({ disabled: true })} />);
    expect(lastFrame()).toContain('[claude-sonnet-4-6]');
  });
});
