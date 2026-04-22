# Ollama Dynamic Model Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch locally installed Ollama models at startup, deduplicate to one per model family (newest pull date), and merge them into the TUI model picker after the static cloud models.

**Architecture:** `App` owns a `models` state initialized from the static `MODELS` array; a `useEffect` on mount calls `fetchOllamaModels()` and appends results. `createModel` is refactored to accept a `ModelInfo` object instead of a raw string, so the Ollama branch can be reached without a static lookup. `InputBar` receives `models` as a prop instead of importing `MODELS` directly.

**Tech Stack:** TypeScript, React/Ink, `@langchain/ollama` (`ChatOllama`), Vitest, `ink-testing-library`

---

## File Map

| File | Change |
|---|---|
| `src/models/list.ts` | Add `'ollama'` to `ModelProvider` union |
| `src/models/ollama.ts` | **New** — `fetchOllamaModels(): Promise<ModelInfo[]>` |
| `src/models/ollama.test.ts` | **New** — tests for fetch, deduplication, error paths |
| `src/models/registry.ts` | Change `createModel(id)` → `createModel(info: ModelInfo)`; add `ChatOllama` branch |
| `src/models/registry.test.ts` | Update calls to pass `ModelInfo`; add `ChatOllama` test; remove unknown-id test |
| `src/agent/Agent.ts` | Constructor resolves `ModelInfo` from `MODELS`; `setModel` takes `ModelInfo` |
| `src/agent/Agent.test.ts` | Update `createModel` call assertions; add unknown-id test; update `setModel` test |
| `src/ui/App.tsx` | Add `models` state + `useEffect`; update `handleModelChange`; pass `models` to `InputBar` |
| `src/ui/App.test.tsx` | Mock `fetchOllamaModels`; update `setModel` assertion |
| `src/ui/InputBar.tsx` | Accept `models: ModelInfo[]` prop; remove direct `MODELS` import |
| `src/ui/InputBar.test.tsx` | Add `models` to `makeProps` |
| `CLAUDE.md` | Add Ollama to architecture section |

---

### Task 1: Install `@langchain/ollama` and extend `ModelProvider`

**Files:**
- Modify: `src/models/list.ts`

- [ ] **Step 1: Install the package**

```bash
npm install @langchain/ollama
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Add `'ollama'` to `ModelProvider`**

Replace the contents of `src/models/list.ts` with:

```typescript
export type ModelProvider = 'anthropic' | 'openai' | 'ollama';

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

- [ ] **Step 3: Verify the build is still clean**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/models/list.ts package.json package-lock.json
git commit -m "feat: add ollama to ModelProvider and install @langchain/ollama"
```

---

### Task 2: `fetchOllamaModels()` — TDD

**Files:**
- Create: `src/models/ollama.ts`
- Create: `src/models/ollama.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/models/ollama.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOllamaModels } from './ollama.js';

describe('fetchOllamaModels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty array when fetch rejects (Ollama not running)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));
    expect(await fetchOllamaModels()).toEqual([]);
  });

  it('returns empty array when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));
    expect(await fetchOllamaModels()).toEqual([]);
  });

  it('returns empty array when models list is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );
    expect(await fetchOllamaModels()).toEqual([]);
  });

  it('keeps the model with the most recent modified_at per family', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { name: 'llama3.2:3b', modified_at: '2024-01-01T00:00:00Z' },
            { name: 'llama3.2:latest', modified_at: '2024-01-02T00:00:00Z' },
          ],
        }),
        { status: 200 },
      ),
    );
    expect(await fetchOllamaModels()).toEqual([
      { id: 'llama3.2:latest', provider: 'ollama' },
    ]);
  });

  it('handles multiple distinct model families', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { name: 'llama3.2:latest', modified_at: '2024-01-02T00:00:00Z' },
            { name: 'mistral:7b', modified_at: '2023-12-01T00:00:00Z' },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchOllamaModels();
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: 'llama3.2:latest', provider: 'ollama' });
    expect(result).toContainEqual({ id: 'mistral:7b', provider: 'ollama' });
  });

  it('returns single model when only one variant is installed', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: 'codellama:13b', modified_at: '2024-03-01T00:00:00Z' }],
        }),
        { status: 200 },
      ),
    );
    expect(await fetchOllamaModels()).toEqual([
      { id: 'codellama:13b', provider: 'ollama' },
    ]);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/models/ollama.test.ts
```

Expected: FAIL — `Cannot find module './ollama.js'`

- [ ] **Step 3: Implement `fetchOllamaModels`**

Create `src/models/ollama.ts`:

```typescript
import type { ModelInfo } from './list.js';

interface OllamaModel {
  name: string;
  modified_at: string;
}

export async function fetchOllamaModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return [];
    const data = await response.json() as { models: OllamaModel[] };

    const groups = new Map<string, OllamaModel>();
    for (const model of data.models) {
      const family = model.name.split(':')[0];
      const existing = groups.get(family);
      if (!existing || model.modified_at > existing.modified_at) {
        groups.set(family, model);
      }
    }

    return Array.from(groups.values()).map(m => ({ id: m.name, provider: 'ollama' as const }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/models/ollama.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/ollama.ts src/models/ollama.test.ts
git commit -m "feat: add fetchOllamaModels with deduplication by family"
```

---

### Task 3: Refactor `registry.ts` to accept `ModelInfo` and add `ChatOllama`

`createModel` currently takes a raw `id: string` and looks up provider in `MODELS`. Change it to accept a `ModelInfo` directly — callers are now responsible for resolving the `ModelInfo`. This removes the MODELS dependency from registry and enables the Ollama branch.

**Files:**
- Modify: `src/models/registry.ts`
- Modify: `src/models/registry.test.ts`

- [ ] **Step 1: Update the tests**

Replace the full contents of `src/models/registry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { createModel } from './registry.js';

vi.mock('@langchain/anthropic', () => ({ ChatAnthropic: vi.fn() }));
vi.mock('@langchain/openai', () => ({ ChatOpenAI: vi.fn() }));
vi.mock('@langchain/ollama', () => ({ ChatOllama: vi.fn() }));

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
    vi.mocked(ChatOllama).mockImplementation(() => ({}) as any);
  });

  afterEach(() => {
    if (savedAnt !== undefined) process.env['ANTHROPIC_API_KEY'] = savedAnt;
    else delete process.env['ANTHROPIC_API_KEY'];
    if (savedOai !== undefined) process.env['OPENAI_API_KEY'] = savedOai;
    else delete process.env['OPENAI_API_KEY'];
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
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx vitest run src/models/registry.test.ts
```

Expected: FAIL — type errors or wrong arguments.

- [ ] **Step 3: Rewrite `registry.ts`**

Replace the full contents of `src/models/registry.ts`:

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ModelInfo } from './list.js';

export function createModel(info: ModelInfo): BaseChatModel {
  if (info.provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Claude models.');
    return new ChatAnthropic({ model: info.id, anthropicApiKey: apiKey });
  }
  if (info.provider === 'openai') {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI models.');
    return new ChatOpenAI({ model: info.id, apiKey });
  }
  if (info.provider === 'ollama') {
    return new ChatOllama({ model: info.id });
  }
  const _exhaustive: never = info.provider;
  throw new Error(`Unsupported provider: ${_exhaustive}`);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/models/registry.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/registry.ts src/models/registry.test.ts
git commit -m "feat: refactor createModel to accept ModelInfo and add ChatOllama branch"
```

---

### Task 4: Update `Agent.ts` and `Agent.test.ts`

`Agent.constructor` now resolves `ModelInfo` from the static `MODELS` list (throwing "Unknown model" if not found) and is the source of that error. `setModel` changes to accept `ModelInfo` instead of a bare string, since the caller (`App`) has already resolved provider info.

**Files:**
- Modify: `src/agent/Agent.ts`
- Modify: `src/agent/Agent.test.ts`

- [ ] **Step 1: Update the tests**

Replace the full contents of `src/agent/Agent.test.ts`:

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

  it('resolves ModelInfo and calls createModel on construction', () => {
    new Agent('claude-sonnet-4-6');
    expect(createModel).toHaveBeenCalledWith({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('throws for unknown model id in constructor', () => {
    expect(() => new Agent('unknown-model')).toThrow('Unknown model: "unknown-model"');
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

  it('setModel calls createModel with the provided ModelInfo', () => {
    const agent = new Agent('claude-sonnet-4-6');
    vi.mocked(createModel).mockClear();
    agent.setModel({ id: 'llama3.2:latest', provider: 'ollama' });
    expect(createModel).toHaveBeenCalledWith({ id: 'llama3.2:latest', provider: 'ollama' });
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

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx vitest run src/agent/Agent.test.ts
```

Expected: FAIL — `createModel` called with wrong arguments, `setModel` type mismatch.

- [ ] **Step 3: Rewrite `Agent.ts`**

Replace the full contents of `src/agent/Agent.ts`:

```typescript
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createModel } from '../models/registry.js';
import { MODELS, type ModelInfo } from '../models/list.js';

export class Agent {
  private model: BaseChatModel;

  constructor(initialModelId: string) {
    const info = MODELS.find(m => m.id === initialModelId);
    if (!info) throw new Error(`Unknown model: "${initialModelId}"`);
    this.model = createModel(info);
  }

  setModel(info: ModelInfo): void {
    this.model = createModel(info);
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

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/agent/Agent.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/Agent.ts src/agent/Agent.test.ts
git commit -m "feat: Agent resolves ModelInfo in constructor; setModel accepts ModelInfo"
```

---

### Task 5: Update `App.tsx` — `models` state, `useEffect`, and `handleModelChange`

`App` gains a `models` state seeded with the static `MODELS`. A `useEffect` fetches Ollama models on mount and appends them. `handleModelChange` looks up the `ModelInfo` from `models` state (falling back to `{ id, provider: 'ollama' }` for free-text entries) before calling `agent.setModel`.

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/App.test.tsx`

- [ ] **Step 1: Update the tests**

Replace the full contents of `src/ui/App.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Agent } from '../agent/Agent.js';

vi.mock('../models/ollama.js', () => ({
  fetchOllamaModels: vi.fn().mockResolvedValue([]),
}));

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

  it('calls agent.setModel with resolved ModelInfo when model is selected', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    stdin.write('/model');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('falls back to ollama provider for free-text model names not in the list', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" />);
    stdin.write('/model');
    stdin.write(' ');
    stdin.write('deepseek-r1:14b');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'deepseek-r1:14b', provider: 'ollama' });
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

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: FAIL — `setModel` called with wrong args; `models` prop missing from `InputBar`.

- [ ] **Step 3: Rewrite `App.tsx`**

Replace the full contents of `src/ui/App.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Box, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';
import { MODELS, type ModelInfo } from '../models/list.js';
import { fetchOllamaModels } from '../models/ollama.js';

interface Props {
  agent: Agent;
  initialModelId: string;
}

export function App({ agent, initialModelId }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const [models, setModels] = useState<ModelInfo[]>(MODELS);
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  useEffect(() => {
    fetchOllamaModels().then(ollamaModels => {
      if (ollamaModels.length > 0) setModels([...MODELS, ...ollamaModels]);
    });
  }, []);

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
    const info: ModelInfo = models.find(m => m.id === id) ?? { id, provider: 'ollama' };
    try {
      agent.setModel(info);
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
        models={models}
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat: App fetches Ollama models on mount and merges into picker"
```

---

### Task 6: Update `InputBar.tsx` — accept `models` prop

`InputBar` currently imports `MODELS` directly for the picker list and cursor bounds. Replace this with a `models: ModelInfo[]` prop so the parent controls what models are shown.

**Files:**
- Modify: `src/ui/InputBar.tsx`
- Modify: `src/ui/InputBar.test.tsx`

- [ ] **Step 1: Update the tests**

Replace the full contents of `src/ui/InputBar.test.tsx`:

```typescript
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
    expect(lastFrame()).toContain('Ctrl+L');
  });

  it('Ctrl+L enters language mode showing lang: label', () => {
    const { lastFrame, stdin } = render(<InputBar {...makeProps()} />);
    stdin.write('\x0c');
    expect(lastFrame()).toContain('lang:');
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
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx vitest run src/ui/InputBar.test.tsx
```

Expected: FAIL — `models` prop not accepted by `InputBar`.

- [ ] **Step 3: Update `InputBar.tsx`**

Replace the full contents of `src/ui/InputBar.tsx`:

```typescript
import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ModelInfo } from '../models/list.js';

type InputMode = 'default' | 'editingLang' | 'selectingModel';
type ModelSelectMode = 'picker' | 'freetext';

interface Props {
  disabled: boolean;
  selectedModel: string;
  models: ModelInfo[];
  onSubmit: (query: string, language?: string) => void;
  onModelChange: (id: string) => void;
}

export function InputBar({ disabled, selectedModel, models, onSubmit, onModelChange }: Props) {
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

  // Mode refs so useInput always reads the latest mode even before React commits
  const inputModeRef = useRef<InputMode>('default');
  const modelSelectModeRef = useRef<ModelSelectMode>('picker');
  const modelCursorRef = useRef(0);

  const setInputModeSync = (mode: InputMode) => {
    inputModeRef.current = mode;
    setInputMode(mode);
  };

  const setModelSelectModeSync = (mode: ModelSelectMode) => {
    modelSelectModeRef.current = mode;
    setModelSelectMode(mode);
  };

  const setModelCursorSync = (cursor: number) => {
    modelCursorRef.current = cursor;
    setModelCursor(cursor);
  };

  const handleQueryChange = (value: string) => {
    if (value === '/model') {
      queryRef.current = '';
      setQuery('');
      setInputModeSync('selectingModel');
      setModelSelectModeSync('picker');
      setModelCursorSync(0);
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
    if (inputModeRef.current === 'selectingModel') {
      if (modelSelectModeRef.current === 'picker') {
        if (key.upArrow) {
          const next = Math.max(0, modelCursorRef.current - 1);
          setModelCursorSync(next);
          return;
        }
        if (key.downArrow) {
          const next = Math.min(models.length - 1, modelCursorRef.current + 1);
          setModelCursorSync(next);
          return;
        }
        if (key.return) {
          onModelChange(models[modelCursorRef.current].id);
          setInputModeSync('default');
          return;
        }
        if (input === ' ') {
          setModelSelectModeSync('freetext');
          setModelText('');
          modelTextRef.current = '';
          return;
        }
        if (key.escape) { setInputModeSync('default'); return; }
      }
      if (modelSelectModeRef.current === 'freetext' && key.escape) {
        setModelSelectModeSync('picker');
      }
      return;
    }

    if (key.ctrl && input === 'l') {
      const next = inputModeRef.current === 'editingLang' ? 'default' : 'editingLang';
      setInputModeSync(next);
      return;
    }
    if (key.escape && inputModeRef.current === 'editingLang') {
      setInputModeSync('default');
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
    setInputModeSync('default');
  };

  const handleModelTextSubmit = (_value: string) => {
    const name = modelTextRef.current.trim();
    if (name) onModelChange(name);
    setInputModeSync('default');
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
          {models.map((m, i) => (
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

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/ui/InputBar.test.tsx
```

Expected: 12 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/InputBar.tsx src/ui/InputBar.test.tsx
git commit -m "feat: InputBar accepts models prop; renders dynamic Ollama models in picker"
```

---

### Task 7: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Ollama to the architecture section**

In `CLAUDE.md`, update the **Model layer** subsection to document `ollama.ts` and the dynamic model fetch:

Find the block:
```
### Model layer (`src/models/`)

- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`
- `registry.ts` — `createModel(id): BaseChatModel`; constructs `ChatAnthropic` or `ChatOpenAI` from env API keys; throws immediately for unknown IDs or missing keys
```

Replace it with:
```
### Model layer (`src/models/`)

- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`; `ModelProvider` includes `'anthropic' | 'openai' | 'ollama'`
- `registry.ts` — `createModel(info: ModelInfo): BaseChatModel`; switches on `info.provider` to construct `ChatAnthropic`, `ChatOpenAI`, or `ChatOllama`; throws for missing API keys
- `ollama.ts` — `fetchOllamaModels(): Promise<ModelInfo[]>`; calls `GET http://localhost:11434/api/tags` (2 s timeout), groups by model family (base name before `:`), keeps newest `modified_at` per family; returns `[]` on any error
```

Also update the **Agent** subsection — find:
```
`suggest(query, language?)` which builds `[SystemMessage, HumanMessage]` and calls `model.invoke()`.
```
And update to:
```
`suggest(query, language?)` which builds `[SystemMessage, HumanMessage]` and calls `model.invoke()`. Constructor resolves `ModelInfo` from `MODELS` and throws for unknown startup model IDs.
```

- [ ] **Step 2: Verify the build and tests still pass**

```bash
npm run build && npm test
```

Expected: clean build, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Ollama dynamic model discovery"
```
