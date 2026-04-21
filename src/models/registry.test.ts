import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { createModel } from './registry.js';

vi.mock('@langchain/anthropic', () => ({ ChatAnthropic: vi.fn() }));
vi.mock('@langchain/openai', () => ({ ChatOpenAI: vi.fn() }));

describe('createModel', () => {
  let savedAnt: string | undefined;
  let savedOai: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    savedAnt = process.env['ANTHROPIC_API_KEY'];
    savedOai = process.env['OPENAI_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'test-ant';
    process.env['OPENAI_API_KEY'] = 'test-oai';
    vi.mocked(ChatAnthropic).mockImplementation(() => ({}) as any);
    vi.mocked(ChatOpenAI).mockImplementation(() => ({}) as any);
  });

  afterEach(() => {
    if (savedAnt !== undefined) process.env['ANTHROPIC_API_KEY'] = savedAnt;
    else delete process.env['ANTHROPIC_API_KEY'];
    if (savedOai !== undefined) process.env['OPENAI_API_KEY'] = savedOai;
    else delete process.env['OPENAI_API_KEY'];
  });

  it('constructs ChatAnthropic for claude-sonnet-4-6', () => {
    createModel('claude-sonnet-4-6');
    expect(ChatAnthropic).toHaveBeenCalledWith({ model: 'claude-sonnet-4-6', anthropicApiKey: 'test-ant' });
  });

  it('constructs ChatAnthropic for claude-haiku-4-5-20251001', () => {
    createModel('claude-haiku-4-5-20251001');
    expect(ChatAnthropic).toHaveBeenCalledWith({ model: 'claude-haiku-4-5-20251001', anthropicApiKey: 'test-ant' });
  });

  it('constructs ChatOpenAI for gpt-4o', () => {
    createModel('gpt-4o');
    expect(ChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-4o', openAIApiKey: 'test-oai' });
  });

  it('constructs ChatOpenAI for gpt-4o-mini', () => {
    createModel('gpt-4o-mini');
    expect(ChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-4o-mini', openAIApiKey: 'test-oai' });
  });

  it('throws for unknown model id', () => {
    expect(() => createModel('unknown-model')).toThrow('Unknown model: "unknown-model"');
  });

  it('throws when ANTHROPIC_API_KEY is missing for a Claude model', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => createModel('claude-sonnet-4-6')).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws when OPENAI_API_KEY is missing for an OpenAI model', () => {
    delete process.env['OPENAI_API_KEY'];
    expect(() => createModel('gpt-4o')).toThrow('OPENAI_API_KEY');
  });
});
