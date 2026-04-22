import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { availableModels, unavailableProviderMessages } from './availability.js';

describe('availableModels', () => {
  let savedAnt: string | undefined;
  let savedOai: string | undefined;
  let savedGoog: string | undefined;

  beforeEach(() => {
    savedAnt = process.env['ANTHROPIC_API_KEY'];
    savedOai = process.env['OPENAI_API_KEY'];
    savedGoog = process.env['GOOGLE_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'test-ant';
    process.env['OPENAI_API_KEY'] = 'test-oai';
    process.env['GOOGLE_API_KEY'] = 'test-goog';
  });

  afterEach(() => {
    if (savedAnt !== undefined) process.env['ANTHROPIC_API_KEY'] = savedAnt;
    else delete process.env['ANTHROPIC_API_KEY'];
    if (savedOai !== undefined) process.env['OPENAI_API_KEY'] = savedOai;
    else delete process.env['OPENAI_API_KEY'];
    if (savedGoog !== undefined) process.env['GOOGLE_API_KEY'] = savedGoog;
    else delete process.env['GOOGLE_API_KEY'];
  });

  it('returns all models when all keys are present', () => {
    const models = availableModels();
    expect(models.some(m => m.provider === 'anthropic')).toBe(true);
    expect(models.some(m => m.provider === 'openai')).toBe(true);
    expect(models.some(m => m.provider === 'google')).toBe(true);
  });

  it('excludes google models when GOOGLE_API_KEY is absent', () => {
    delete process.env['GOOGLE_API_KEY'];
    const models = availableModels();
    expect(models.some(m => m.provider === 'google')).toBe(false);
    expect(models.some(m => m.provider === 'anthropic')).toBe(true);
    expect(models.some(m => m.provider === 'openai')).toBe(true);
  });

  it('excludes openai models when OPENAI_API_KEY is absent', () => {
    delete process.env['OPENAI_API_KEY'];
    const models = availableModels();
    expect(models.some(m => m.provider === 'openai')).toBe(false);
    expect(models.some(m => m.provider === 'anthropic')).toBe(true);
  });

  it('treats empty string key as absent', () => {
    process.env['GOOGLE_API_KEY'] = '';
    const models = availableModels();
    expect(models.some(m => m.provider === 'google')).toBe(false);
  });

  it('returns empty array when all cloud keys are absent', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
    expect(availableModels()).toHaveLength(0);
  });
});

describe('unavailableProviderMessages', () => {
  let savedAnt: string | undefined;
  let savedOai: string | undefined;
  let savedGoog: string | undefined;

  beforeEach(() => {
    savedAnt = process.env['ANTHROPIC_API_KEY'];
    savedOai = process.env['OPENAI_API_KEY'];
    savedGoog = process.env['GOOGLE_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'test-ant';
    process.env['OPENAI_API_KEY'] = 'test-oai';
    process.env['GOOGLE_API_KEY'] = 'test-goog';
  });

  afterEach(() => {
    if (savedAnt !== undefined) process.env['ANTHROPIC_API_KEY'] = savedAnt;
    else delete process.env['ANTHROPIC_API_KEY'];
    if (savedOai !== undefined) process.env['OPENAI_API_KEY'] = savedOai;
    else delete process.env['OPENAI_API_KEY'];
    if (savedGoog !== undefined) process.env['GOOGLE_API_KEY'] = savedGoog;
    else delete process.env['GOOGLE_API_KEY'];
  });

  it('returns empty array when all keys are present', () => {
    expect(unavailableProviderMessages()).toEqual([]);
  });

  it('returns one message when GOOGLE_API_KEY is missing', () => {
    delete process.env['GOOGLE_API_KEY'];
    const msgs = unavailableProviderMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Google');
    expect(msgs[0]).toContain('GOOGLE_API_KEY');
  });

  it('returns one message when OPENAI_API_KEY is missing', () => {
    delete process.env['OPENAI_API_KEY'];
    const msgs = unavailableProviderMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('OpenAI');
    expect(msgs[0]).toContain('OPENAI_API_KEY');
  });

  it('returns three messages when all cloud keys are missing', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
    const msgs = unavailableProviderMessages();
    expect(msgs).toHaveLength(3);
    expect(msgs.some(m => m.includes('Anthropic'))).toBe(true);
    expect(msgs.some(m => m.includes('OpenAI'))).toBe(true);
    expect(msgs.some(m => m.includes('Google'))).toBe(true);
  });

  it('treats empty string key as missing', () => {
    process.env['GOOGLE_API_KEY'] = '';
    const msgs = unavailableProviderMessages();
    expect(msgs.some(m => m.includes('Google'))).toBe(true);
  });
});
