import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createModel } from './registry.js';

vi.mock('@langchain/anthropic', () => ({ ChatAnthropic: vi.fn() }));
vi.mock('@langchain/openai', () => ({ ChatOpenAI: vi.fn() }));
vi.mock('@langchain/ollama', () => ({ ChatOllama: vi.fn() }));
vi.mock('@langchain/google-genai', () => ({ ChatGoogleGenerativeAI: vi.fn() }));

describe('createModel', () => {
  let savedAnt: string | undefined;
  let savedOai: string | undefined;
  let savedGoog: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    savedAnt = process.env['ANTHROPIC_API_KEY'];
    savedOai = process.env['OPENAI_API_KEY'];
    savedGoog = process.env['GOOGLE_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'test-ant';
    process.env['OPENAI_API_KEY'] = 'test-oai';
    process.env['GOOGLE_API_KEY'] = 'test-goog';
    vi.mocked(ChatAnthropic).mockImplementation(() => ({}) as any);
    vi.mocked(ChatOpenAI).mockImplementation(() => ({}) as any);
    vi.mocked(ChatOllama).mockImplementation(() => ({}) as any);
    vi.mocked(ChatGoogleGenerativeAI).mockImplementation(() => ({}) as any);
  });

  afterEach(() => {
    if (savedAnt !== undefined) process.env['ANTHROPIC_API_KEY'] = savedAnt;
    else delete process.env['ANTHROPIC_API_KEY'];
    if (savedOai !== undefined) process.env['OPENAI_API_KEY'] = savedOai;
    else delete process.env['OPENAI_API_KEY'];
    if (savedGoog !== undefined) process.env['GOOGLE_API_KEY'] = savedGoog;
    else delete process.env['GOOGLE_API_KEY'];
  });

  it('constructs ChatAnthropic for an anthropic model', () => {
    createModel({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
    expect(ChatAnthropic).toHaveBeenCalledWith({ model: 'claude-sonnet-4-6', anthropicApiKey: 'test-ant' });
  });

  it('constructs ChatAnthropic for claude-haiku-4-5-20251001', () => {
    createModel({ id: 'claude-haiku-4-5-20251001', provider: 'anthropic' });
    expect(ChatAnthropic).toHaveBeenCalledWith({ model: 'claude-haiku-4-5-20251001', anthropicApiKey: 'test-ant' });
  });

  it('constructs ChatOpenAI for an openai model', () => {
    createModel({ id: 'gpt-4o', provider: 'openai' });
    expect(ChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-4o', apiKey: 'test-oai' });
  });

  it('constructs ChatOpenAI for gpt-4o-mini', () => {
    createModel({ id: 'gpt-4o-mini', provider: 'openai' });
    expect(ChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-4o-mini', apiKey: 'test-oai' });
  });

  it('constructs ChatOllama for an ollama model (no API key needed)', () => {
    createModel({ id: 'llama3.2:latest', provider: 'ollama' });
    expect(ChatOllama).toHaveBeenCalledWith({ model: 'llama3.2:latest' });
  });

  it('throws when ANTHROPIC_API_KEY is missing', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => createModel({ id: 'claude-sonnet-4-6', provider: 'anthropic' })).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws when OPENAI_API_KEY is missing', () => {
    delete process.env['OPENAI_API_KEY'];
    expect(() => createModel({ id: 'gpt-4o', provider: 'openai' })).toThrow('OPENAI_API_KEY');
  });

  it('constructs ChatGoogleGenerativeAI for a google model', () => {
    createModel({ id: 'gemini-2.5-pro', provider: 'google' });
    expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith({ model: 'gemini-2.5-pro', apiKey: 'test-goog' });
  });

  it('throws when GOOGLE_API_KEY is missing', () => {
    delete process.env['GOOGLE_API_KEY'];
    expect(() => createModel({ id: 'gemini-2.5-pro', provider: 'google' })).toThrow('GOOGLE_API_KEY');
  });
});
