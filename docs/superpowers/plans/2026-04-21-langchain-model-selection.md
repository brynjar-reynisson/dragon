# LangChain Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom Provider abstraction with LangChain chat models; add an in-TUI `/model` command that shows a navigable picker or accepts free-text model names, with the active model displayed top-right in the input box.

**Architecture:** A new `src/models/` layer holds a hardcoded model list and a `createModel(id)` factory that constructs the correct LangChain chat model. `Agent` owns a `BaseChatModel` instance and exposes `setModel(id)` for swapping at runtime. `App` owns `selectedModel` state and wires model changes between the UI and the Agent. `InputBar` gains a third mode (`selectingModel`) triggered by typing `/model`, with an arrow-key picker and a Space-to-freetext sub-mode.

**Tech Stack:** TypeScript 5, Ink v5, React 18, `@langchain/core`, `@langchain/anthropic`, `@langchain/openai`, Vitest, ink-testing-library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/models/list.ts` | Create | Hardcoded `MODELS` array with id + provider, `DEFAULT_MODEL_ID` |
| `src/models/registry.ts` | Create | `createModel(id)` → `BaseChatModel`; reads API keys from env |
| `src/models/registry.test.ts` | Create | Tests for registry |
| `src/agent/Agent.ts` | Rewrite | Owns `BaseChatModel`, exposes `setModel(id)`, calls `model.invoke()` |
| `src/agent/Agent.test.ts` | Rewrite | Tests for redesigned Agent |
| `src/index.tsx` | Modify | Read `DRAGON_MODEL` env var, construct `Agent`, pass `initialModelId` to `App` |
| `src/providers/` | Delete | Entire directory removed |
| `src/ui/App.tsx` | Modify | Add `initialModelId` prop, `selectedModel` state, `handleModelChange` |
| `src/ui/App.test.tsx` | Modify | Add `initialModelId` prop to all renders, add model-change tests |
| `src/ui/InputBar.tsx` | Rewrite | Add `selectedModel`/`onModelChange` props, model badge, `/model` selector |
| `src/ui/InputBar.test.tsx` | Rewrite | Tests for model badge and `/model` flow |
| `.env.example` | Modify | Replace `DRAGON_PROVIDER` with `DRAGON_MODEL` |
| `CLAUDE.md` | Modify | Update configuration table |

---

### Task 1: Create feature branch

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feature/langchain-model-selection
```

Expected: `Switched to a new branch 'feature/langchain-model-selection'`

---

### Task 2: Install LangChain packages

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @langchain/core @langchain/anthropic @langchain/openai
```

Expected: packages added to `node_modules/`, `package-lock.json` updated, no errors.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add langchain dependencies"
```

---

### Task 3: Create model list

**Files:**
- Create: `src/models/list.ts`

- [ ] **Step 1: Create `src/models/list.ts`**

```typescript
export type ModelProvider = 'anthropic' | 'openai';

export interface ModelInfo {
  id: string;
  provider: ModelProvider;
}

export const MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-6', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  { id: 'gpt-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', provider: 'openai' },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/models/list.ts
git commit -m "feat: add hardcoded model list"
```

---

### Task 4: Create model registry

**Files:**
- Create: `src/models/registry.test.ts`
- Create: `src/models/registry.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/models/registry.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/models/registry.test.ts
```

Expected: FAIL — `Cannot find module './registry.js'`

- [ ] **Step 3: Create `src/models/registry.ts`**

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MODELS } from './list.js';

export function createModel(id: string): BaseChatModel {
  const info = MODELS.find(m => m.id === id);
  if (!info) {
    throw new Error(`Unknown model: "${id}". Valid models: ${MODELS.map(m => m.id).join(', ')}`);
  }
  if (info.provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Claude models.');
    return new ChatAnthropic({ model: id, anthropicApiKey: apiKey });
  }
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI models.');
  return new ChatOpenAI({ model: id, openAIApiKey: apiKey });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/models/registry.test.ts
```

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/models/registry.ts src/models/registry.test.ts
git commit -m "feat: add model registry with LangChain factories"
```

---

### Task 5: Redesign Agent

**Files:**
- Rewrite: `src/agent/Agent.ts`
- Rewrite: `src/agent/Agent.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/agent/Agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/registry.js', () => ({ createModel: vi.fn() }));

import { Agent } from './Agent.js';
import { createModel } from '../models/registry.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

describe('Agent', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke = vi.fn();
    vi.mocked(createModel).mockReturnValue({ invoke: mockInvoke } as unknown as BaseChatModel);
  });

  it('calls createModel with initial model id on construction', () => {
    new Agent('claude-sonnet-4-6');
    expect(createModel).toHaveBeenCalledWith('claude-sonnet-4-6');
  });

  it('returns trimmed text from suggest', async () => {
    mockInvoke.mockResolvedValue({ content: '  const x = 1;  ' });
    const agent = new Agent('claude-sonnet-4-6');
    expect(await agent.suggest('declare a variable')).toBe('const x = 1;');
  });

  it('includes language in system message when provided', async () => {
    mockInvoke.mockResolvedValue({ content: 'fn foo() {}' });
    const agent = new Agent('claude-sonnet-4-6');
    await agent.suggest('write foo', 'rust');
    const [systemMsg] = mockInvoke.mock.calls[0][0];
    expect(systemMsg.content).toContain('Use rust');
  });

  it('setModel calls createModel with new id', () => {
    const agent = new Agent('claude-sonnet-4-6');
    vi.mocked(createModel).mockClear();
    agent.setModel('gpt-4o');
    expect(createModel).toHaveBeenCalledWith('gpt-4o');
  });

  it('throws when response content is not a string', async () => {
    mockInvoke.mockResolvedValue({ content: [{ type: 'image' }] });
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('Unexpected response type');
  });

  it('propagates model errors', async () => {
    mockInvoke.mockRejectedValue(new Error('API error'));
    const agent = new Agent('claude-sonnet-4-6');
    await expect(agent.suggest('foo')).rejects.toThrow('API error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/agent/Agent.test.ts
```

Expected: FAIL — type errors or test failures because Agent still takes a Provider.

- [ ] **Step 3: Rewrite `src/agent/Agent.ts`**

```typescript
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createModel } from '../models/registry.js';

export class Agent {
  private model: BaseChatModel;

  constructor(initialModelId: string) {
    this.model = createModel(initialModelId);
  }

  setModel(id: string): void {
    this.model = createModel(id);
  }

  async suggest(prompt: string, language?: string): Promise<string> {
    const langInstruction = language ? ` Use ${language}.` : '';
    const system = `You are a coding assistant. Return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.${langInstruction}`;
    const result = await this.model.invoke([
      new SystemMessage(system),
      new HumanMessage(prompt),
    ]);
    if (typeof result.content !== 'string') throw new Error('Unexpected response type');
    return result.content.trim();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/agent/Agent.test.ts
```

Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/agent/Agent.ts src/agent/Agent.test.ts
git commit -m "feat: redesign Agent to own LangChain model instance"
```

---

### Task 6: Update entry point

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Rewrite `src/index.tsx`**

```typescript
#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
import { App } from './ui/App.js';
import { Agent } from './agent/Agent.js';
import { DEFAULT_MODEL_ID } from './models/list.js';

const modelId = process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID;
let agent: Agent;
try {
  agent = new Agent(modelId);
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

render(<App agent={agent} initialModelId={modelId} />);
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc --noEmit
```

Expected: errors about `App` not accepting `initialModelId` — that's correct, we haven't updated App yet.

- [ ] **Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: simplify entry point with DRAGON_MODEL env var"
```

---

### Task 7: Delete providers

**Files:**
- Delete: `src/providers/` (entire directory)

- [ ] **Step 1: Delete the providers directory**

```bash
rm -rf src/providers
```

- [ ] **Step 2: Run the existing passing tests to confirm no regressions**

```bash
npx vitest run src/agent/Agent.test.ts src/models/registry.test.ts
```

Expected: PASS — all passing, provider tests are gone (correct).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove providers directory replaced by LangChain registry"
```

---

### Task 8: Update App

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/App.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/ui/App.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Agent } from '../agent/Agent.js';

describe('App', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = {
      suggest: vi.fn(),
      setModel: vi.fn(),
    } as unknown as Agent;
  });

  it('renders input bar and empty snippet hint on load', () => {
    const { lastFrame } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    expect(lastFrame()).toContain('Ctrl+L');
    expect(lastFrame()).toContain('Type a request');
  });

  it('displays the initial model id', () => {
    const { lastFrame } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    expect(lastFrame()).toContain('claude-sonnet-4-6');
  });

  it('shows snippet after successful suggest', async () => {
    vi.mocked(agent.suggest).mockResolvedValue('const x = 1;');
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    stdin.write('declare a variable');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('shows error when suggest fails', async () => {
    vi.mocked(agent.suggest).mockRejectedValue(new Error('API rate limit'));
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('API rate limit');
  });

  it('calls agent.setModel when model is selected', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    stdin.write('/model');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith('claude-sonnet-4-6');
  });

  it('shows error when setModel throws', () => {
    vi.mocked(agent.setModel).mockImplementation(() => { throw new Error('Unknown model'); });
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    stdin.write('/model');
    stdin.write('\r');
    expect(lastFrame()).toContain('Unknown model');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: FAIL — `App` does not accept `initialModelId`.

- [ ] **Step 3: Update `src/ui/App.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { Box, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';

interface Props {
  agent: Agent;
  initialModelId: string;
}

export function App({ agent, initialModelId }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  const handleSubmit = async (query: string, language?: string) => {
    setLoading(true);
    setError(null);
    setSnippet('');
    try {
      const result = await agent.suggest(query, language);
      setSnippet(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (id: string) => {
    try {
      agent.setModel(id);
      setSelectedModel(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <SnippetView snippet={snippet} loading={loading} error={error} />
      <InputBar
        disabled={loading}
        selectedModel={selectedModel}
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they fail on InputBar props**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: type errors — `InputBar` does not yet accept `selectedModel`/`onModelChange`. That is expected; we fix this in Task 9.

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat: add selectedModel state and handleModelChange to App"
```

---

### Task 9: Update InputBar

**Files:**
- Rewrite: `src/ui/InputBar.tsx`
- Rewrite: `src/ui/InputBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/ui/InputBar.test.tsx`:

```typescript
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
    stdin.write('[B'); // down arrow
    expect(lastFrame()).toContain('▶ claude-haiku-4-5-20251001');
  });

  it('calls onModelChange with selected model on Enter in picker', () => {
    const onModelChange = vi.fn();
    const { stdin } = render(<InputBar {...makeProps({ onModelChange })} />);
    stdin.write('/model');
    stdin.write('[B'); // move to claude-haiku
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
    stdin.write(''); // Escape
    expect(lastFrame()).toContain('Ctrl+L');
  });

  it('still renders when disabled', () => {
    const { lastFrame } = render(<InputBar {...makeProps({ disabled: true })} />);
    expect(lastFrame()).toContain('[claude-sonnet-4-6]');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/ui/InputBar.test.tsx
```

Expected: FAIL — `InputBar` does not accept `selectedModel`/`onModelChange`.

- [ ] **Step 3: Rewrite `src/ui/InputBar.tsx`**

```typescript
import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { MODELS } from '../models/list.js';

type InputMode = 'default' | 'editingLang' | 'selectingModel';
type ModelSelectMode = 'picker' | 'freetext';

interface Props {
  disabled: boolean;
  selectedModel: string;
  onSubmit: (query: string, language?: string) => void;
  onModelChange: (id: string) => void;
}

export function InputBar({ disabled, selectedModel, onSubmit, onModelChange }: Props) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('default');
  const [modelSelectMode, setModelSelectMode] = useState<ModelSelectMode>('picker');
  const [modelCursor, setModelCursor] = useState(0);
  const [modelText, setModelText] = useState('');

  // Refs track latest values synchronously so submit handlers read the
  // correct value before React flushes the corresponding state update.
  const queryRef = useRef('');
  const languageRef = useRef('');
  const modelTextRef = useRef('');

  const handleQueryChange = (value: string) => {
    if (value === '/model') {
      queryRef.current = '';
      setQuery('');
      setInputMode('selectingModel');
      setModelSelectMode('picker');
      setModelCursor(0);
      return;
    }
    queryRef.current = value;
    setQuery(value);
  };

  const handleLanguageChange = (value: string) => {
    languageRef.current = value;
    setLanguage(value);
  };

  const handleModelTextChange = (value: string) => {
    modelTextRef.current = value;
    setModelText(value);
  };

  useInput((input, key) => {
    if (inputMode === 'selectingModel') {
      if (modelSelectMode === 'picker') {
        if (key.upArrow) { setModelCursor(c => Math.max(0, c - 1)); return; }
        if (key.downArrow) { setModelCursor(c => Math.min(MODELS.length - 1, c + 1)); return; }
        if (key.return) {
          onModelChange(MODELS[modelCursor].id);
          setInputMode('default');
          return;
        }
        if (input === ' ') {
          setModelSelectMode('freetext');
          setModelText('');
          modelTextRef.current = '';
          return;
        }
        if (key.escape) { setInputMode('default'); return; }
      }
      if (modelSelectMode === 'freetext' && key.escape) {
        setModelSelectMode('picker');
      }
      return;
    }

    if (key.ctrl && input === 'l') {
      setInputMode(prev => prev === 'editingLang' ? 'default' : 'editingLang');
      return;
    }
    if (key.escape && inputMode === 'editingLang') {
      setInputMode('default');
    }
  }, { isActive: !disabled });

  const handleQuerySubmit = (_value: string) => {
    const current = queryRef.current.trim();
    if (!current) return;
    onSubmit(current, languageRef.current.trim() || undefined);
    queryRef.current = '';
    setQuery('');
  };

  const handleLangSubmit = (_value: string) => {
    setLanguage(languageRef.current.trim());
    setInputMode('default');
  };

  const handleModelTextSubmit = (_value: string) => {
    const name = modelTextRef.current.trim();
    if (name) onModelChange(name);
    setInputMode('default');
    setModelText('');
    modelTextRef.current = '';
  };

  const hintsText = inputMode === 'selectingModel'
    ? '↑↓: navigate  •  Enter: select  •  Space: type name  •  Esc: cancel'
    : 'Ctrl+L: set language  •  Enter: submit  •  Ctrl+C: exit';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Box gap={1} flexGrow={1}>
          {inputMode === 'editingLang' ? (
            <>
              <Text>lang:</Text>
              <TextInput
                value={language}
                onChange={handleLanguageChange}
                onSubmit={handleLangSubmit}
                placeholder="e.g. typescript"
              />
            </>
          ) : inputMode === 'selectingModel' && modelSelectMode === 'freetext' ? (
            <>
              <Text>model:</Text>
              <TextInput
                value={modelText}
                onChange={handleModelTextChange}
                onSubmit={handleModelTextSubmit}
                placeholder="e.g. gpt-4o-mini"
              />
            </>
          ) : inputMode === 'selectingModel' ? (
            <Text dimColor>Select a model below or press Space to type a name...</Text>
          ) : (
            <>
              {language && <Text dimColor>[lang: {language}]</Text>}
              <TextInput
                value={query}
                onChange={handleQueryChange}
                onSubmit={handleQuerySubmit}
                placeholder="Describe the code you need..."
                focus={!disabled}
              />
            </>
          )}
        </Box>
        <Text dimColor>[{selectedModel}]</Text>
      </Box>
      {inputMode === 'selectingModel' && modelSelectMode === 'picker' && (
        <Box flexDirection="column">
          {MODELS.map((m, i) => (
            <Text key={m.id} color={i === modelCursor ? 'cyan' : undefined}>
              {i === modelCursor ? '▶ ' : '  '}{m.id}
            </Text>
          ))}
        </Box>
      )}
      <Text dimColor>{hintsText}</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npx vitest run
```

Expected: PASS — all tests passing across all test files.

- [ ] **Step 5: Commit**

```bash
git add src/ui/InputBar.tsx src/ui/InputBar.test.tsx
git commit -m "feat: add model badge and /model selector to InputBar"
```

---

### Task 10: Update config docs

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `.env.example`**

Replace the entire file:

```
# Model to use — see src/models/list.ts for valid values
DRAGON_MODEL=claude-sonnet-4-6

# Required when using a Claude model
ANTHROPIC_API_KEY=

# Required when using an OpenAI model
OPENAI_API_KEY=
```

- [ ] **Step 2: Update the Configuration section in `CLAUDE.md`**

Find the Configuration table that reads:

```markdown
| Env var | Values | Default |
|---|---|---|
| `DRAGON_PROVIDER` | `claude`, `openai` | `claude` |
| `ANTHROPIC_API_KEY` | string | required for claude |
| `OPENAI_API_KEY` | string | required for openai |
```

Replace it with:

```markdown
| Env var | Values | Default |
|---|---|---|
| `DRAGON_MODEL` | any model ID from `src/models/list.ts` | `claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | string | required for Claude models |
| `OPENAI_API_KEY` | string | required for OpenAI models |
```

Also update the README.md configuration table the same way — find and replace `DRAGON_PROVIDER` row with `DRAGON_MODEL`.

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md README.md
git commit -m "docs: replace DRAGON_PROVIDER with DRAGON_MODEL in config docs"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Type-check the entire project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 4: Smoke test — missing API key**

```bash
npm run dev
```

Expected: prints `Error: ANTHROPIC_API_KEY is required for Claude models.` and exits cleanly (no API key set in env).

- [ ] **Step 5: Commit and push**

```bash
git add .
git commit -m "feat: langchain model selection — iteration 2 complete"
```
