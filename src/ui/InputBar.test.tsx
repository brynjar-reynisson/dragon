import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { InputBar } from './InputBar.js';
import { MODELS } from '../models/list.js';

function makeProps(overrides: Partial<Parameters<typeof InputBar>[0]> = {}) {
  return {
    disabled: false,
    selectedModel: 'claude-sonnet-4-6',
    models: MODELS,
    unavailableNotices: [],
    onSubmit: vi.fn(),
    onModelChange: vi.fn(),
    ...overrides,
  };
}

describe('InputBar', () => {
  it('shows model badge and keyboard hints', () => {
    const { lastFrame } = render(<InputBar {...makeProps()} />);
    expect(lastFrame()).toContain('[claude-sonnet-4-6]');
    expect(lastFrame()).toContain('Enter');
  });

  it('calls onSubmit with query when Enter is pressed', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<InputBar {...makeProps({ onSubmit })} />);
    stdin.write('debounce function');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('debounce function');
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

  it('calls onModelChange with selected model id on Enter in picker', () => {
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
    expect(lastFrame()).toContain('Enter: submit');
  });

  it('still renders when disabled', () => {
    const { lastFrame } = render(<InputBar {...makeProps({ disabled: true })} />);
    expect(lastFrame()).toContain('[claude-sonnet-4-6]');
  });

  it('shows dynamically provided models in picker', () => {
    const extraModels = [
      ...MODELS,
      { id: 'llama3.2:latest', provider: 'ollama' as const },
    ];
    const { lastFrame, stdin } = render(<InputBar {...makeProps({ models: extraModels })} />);
    stdin.write('/model');
    expect(lastFrame()).toContain('llama3.2:latest');
  });

  it('submits /init as a normal query on Enter', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<InputBar {...makeProps({ onSubmit })} />);
    stdin.write('/init');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('/init');
  });

  it('shows unavailable provider notices below model list in picker', () => {
    const { lastFrame, stdin } = render(
      <InputBar {...makeProps({ unavailableNotices: ['Google models are not available without GOOGLE_API_KEY'] })} />
    );
    stdin.write('/model');
    expect(lastFrame()).toContain('Google models are not available without GOOGLE_API_KEY');
  });

  it('does not show notice text when unavailableNotices is empty', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps({ unavailableNotices: [] })} />);
    stdin.write('/model');
    expect(lastFrame()).not.toContain('not available');
  });
});
