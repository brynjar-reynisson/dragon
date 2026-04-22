# Google Models & Provider Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Gemini models and filter the model picker by API key availability, showing dim notices for missing providers.

**Architecture:** A new `availability.ts` module encapsulates which providers have API keys and returns messages for missing ones. `App.tsx` uses `availableModels()` as its initial models state and passes `unavailableProviderMessages()` to `InputBar`. `InputBar` renders dim notice lines below the model list in the picker. `index.tsx` uses `availableModels()` for startup resolution so the app never crashes due to a missing key.

**Tech Stack:** TypeScript, React/Ink, LangChain `@langchain/google-genai`, Vitest

---

### Task 1: Add Google to `src/models/list.ts`

**Files:**
- Modify: `src/models/list.ts`

No separate test file — this is pure static data. The change is immediately verified by the existing type-checker and will be exercised by later tasks.

- [ ] **Step 1: Update `src/models/list.ts`**

Replace the file with:

```typescript
export type ModelProvider = 'anthropic' | 'openai' | 'ollama' | 'google';

export interface ModelInfo {
  id: string;
  provider: ModelProvider;
}

export const MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-6', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  { id: 'gpt-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', provider: 'openai' },
  { id: 'gemini-2.5-pro', provider: 'google' },
  { id: 'gemini-2.5-flash', provider: 'google' },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
```

- [ ] **Step 2: Run the test suite to verify nothing broke**

```bash
npm test
```

Expected: all 56 tests pass (no code paths reference `'google'` yet so no breaks)

- [ ] **Step 3: Commit**

```bash
git add src/models/list.ts
git commit -m "feat: add google to ModelProvider and gemini models to MODELS"
```

---

### Task 2: Install `@langchain/google-genai` and add Google branch to `src/models/registry.ts`

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/models/registry.ts`
- Modify: `src/models/registry.test.ts`

- [ ] **Step 1: Install the package**

```bash
npm install @langchain/google-genai
```

Expected: package added to `dependencies` in `package.json`, `package-lock.json` updated.

- [ ] **Step 2: Write the two new failing tests in `src/models/registry.test.ts`**

The existing file saves/restores `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `beforeEach`/`afterEach`. Add `GOOGLE_API_KEY` to the same save/restore block, add a mock for `@langchain/google-genai`, and add two new tests. Replace the full file with:

```typescript
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
```

- [ ] **Step 3: Run registry tests to verify the two new ones fail**

```bash
npx vitest run src/models/registry.test.ts
```

Expected: 7 pass, 2 fail (`ChatGoogleGenerativeAI` not yet imported/handled)

- [ ] **Step 4: Update `src/models/registry.ts`**

Replace the file with:

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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
  if (info.provider === 'google') {
    const apiKey = process.env['GOOGLE_API_KEY'];
    if (!apiKey) throw new Error('GOOGLE_API_KEY is required for Google models.');
    return new ChatGoogleGenerativeAI({ model: info.id, apiKey });
  }
  const _exhaustive: never = info.provider;
  throw new Error(`Unsupported provider: ${_exhaustive}`);
}
```

- [ ] **Step 5: Run registry tests to verify all 9 pass**

```bash
npx vitest run src/models/registry.test.ts
```

Expected: 9 tests pass

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/models/registry.ts src/models/registry.test.ts
git commit -m "feat: add Google Gemini support to registry via ChatGoogleGenerativeAI"
```

---

### Task 3: Create `src/models/availability.ts` (TDD)

**Files:**
- Create: `src/models/availability.ts`
- Create: `src/models/availability.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/models/availability.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/models/availability.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/models/availability.ts`**

```typescript
import { MODELS, type ModelInfo, type ModelProvider } from './list.js';

const PROVIDER_ENV: Partial<Record<ModelProvider, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

const PROVIDER_DISPLAY: Partial<Record<ModelProvider, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

function hasKey(provider: ModelProvider): boolean {
  const envVar = PROVIDER_ENV[provider];
  if (!envVar) return true;
  return !!process.env[envVar];
}

export function availableModels(): ModelInfo[] {
  return MODELS.filter(m => hasKey(m.provider));
}

export function unavailableProviderMessages(): string[] {
  const seen = new Set<ModelProvider>();
  const messages: string[] = [];
  for (const m of MODELS) {
    if (seen.has(m.provider)) continue;
    seen.add(m.provider);
    if (!hasKey(m.provider)) {
      const envVar = PROVIDER_ENV[m.provider]!;
      const display = PROVIDER_DISPLAY[m.provider]!;
      messages.push(`${display} models are not available without ${envVar}`);
    }
  }
  return messages;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/models/availability.test.ts
```

Expected: 10 tests pass

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/models/availability.ts src/models/availability.test.ts
git commit -m "feat: add availability module (availableModels / unavailableProviderMessages)"
```

---

### Task 4: Update `src/index.tsx` — startup resolution using `availableModels()`

**Files:**
- Modify: `src/index.tsx`

No new tests — this is top-level wiring. Availability is tested in Task 3; startup behaviour is validated by running the app.

- [ ] **Step 1: Replace `src/index.tsx`**

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
import { availableModels, unavailableProviderMessages } from './models/availability.js';
import { loadSavedModel } from './models/persistence.js';

const savedModelId = loadSavedModel();
const envModelId = process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID;
const available = availableModels();

let startupModelId: string;
if (savedModelId !== null && available.some(m => m.id === savedModelId)) {
  startupModelId = savedModelId;
} else if (available.some(m => m.id === envModelId)) {
  startupModelId = envModelId;
} else if (available.length > 0) {
  startupModelId = available[0].id;
} else {
  const msgs = unavailableProviderMessages();
  process.stderr.write(`No models available. Provide at least one API key:\n${msgs.join('\n')}\n`);
  process.exit(1);
}

let agent: Agent;
try {
  agent = new Agent(startupModelId);
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

render(<App agent={agent} initialModelId={startupModelId} savedModelId={savedModelId} />);
```

- [ ] **Step 2: Run the full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: use availableModels() for startup resolution with graceful fallback"
```

---

### Task 5: Add `unavailableNotices` prop to `src/ui/InputBar.tsx`

**Files:**
- Modify: `src/ui/InputBar.tsx`
- Modify: `src/ui/InputBar.test.tsx`

- [ ] **Step 1: Write the new failing tests**

Replace `src/ui/InputBar.test.tsx` with:

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
```

- [ ] **Step 2: Run tests to verify the two new ones fail**

```bash
npx vitest run src/ui/InputBar.test.tsx
```

Expected: 12 existing tests pass, 2 new tests fail (prop not on component yet)

- [ ] **Step 3: Update `src/ui/InputBar.tsx`**

Add `unavailableNotices: string[]` to the `Props` interface and render it in the picker. Replace the Props interface and the picker render block:

Props interface (replace existing):
```typescript
interface Props {
  disabled: boolean;
  selectedModel: string;
  models: ModelInfo[];
  unavailableNotices: string[];
  onSubmit: (query: string, language?: string) => void;
  onModelChange: (id: string) => void;
}
```

Update the destructure line (replace existing):
```typescript
export function InputBar({ disabled, selectedModel, models, unavailableNotices, onSubmit, onModelChange }: Props) {
```

Replace the picker render block (the `{inputMode === 'selectingModel' && modelSelectMode === 'picker' && ...}` section):
```tsx
{inputMode === 'selectingModel' && modelSelectMode === 'picker' && (
  <Box flexDirection="column">
    {models.map((m, i) => (
      <Text key={m.id} color={i === modelCursor ? 'cyan' : undefined}>
        {i === modelCursor ? '▶ ' : '  '}{m.id}
      </Text>
    ))}
    {unavailableNotices.map(msg => (
      <Text key={msg} dimColor>{msg}</Text>
    ))}
  </Box>
)}
```

- [ ] **Step 4: Run InputBar tests to verify all 14 pass**

```bash
npx vitest run src/ui/InputBar.test.tsx
```

Expected: 14 tests pass

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all tests pass (App.tsx doesn't pass `unavailableNotices` yet — TypeScript compile error but Vitest tests pass; this is resolved in Task 6)

- [ ] **Step 6: Commit**

```bash
git add src/ui/InputBar.tsx src/ui/InputBar.test.tsx
git commit -m "feat: add unavailableNotices prop to InputBar, render below model list"
```

---

### Task 6: Update `src/ui/App.tsx` to use `availableModels()` and pass notices to `InputBar`

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/App.test.tsx`

- [ ] **Step 1: Write the updated test file**

Replace `src/ui/App.test.tsx` with:

```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Agent } from '../agent/Agent.js';

vi.mock('../models/ollama.js', () => ({
  fetchOllamaModels: vi.fn().mockResolvedValue([]),
}));

vi.mock('../models/persistence.js', () => ({
  saveModel: vi.fn(),
}));

vi.mock('../models/availability.js', () => ({
  availableModels: vi.fn().mockReturnValue([
    { id: 'claude-sonnet-4-6', provider: 'anthropic' },
    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
    { id: 'gpt-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', provider: 'openai' },
    { id: 'gemini-2.5-pro', provider: 'google' },
    { id: 'gemini-2.5-flash', provider: 'google' },
  ]),
  unavailableProviderMessages: vi.fn().mockReturnValue([]),
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
    const { lastFrame } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    expect(lastFrame()).toContain('Ctrl+L');
    expect(lastFrame()).toContain('Type a request');
  });

  it('displays the initial model id', () => {
    const { lastFrame } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    expect(lastFrame()).toContain('claude-sonnet-4-6');
  });

  it('shows snippet after successful suggest', async () => {
    vi.mocked(agent.suggest).mockResolvedValue('const x = 1;');
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('declare a variable');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('shows error when suggest fails', async () => {
    vi.mocked(agent.suggest).mockRejectedValue(new Error('API rate limit'));
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('API rate limit');
  });

  it('calls agent.setModel with resolved ModelInfo when model is selected', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/model');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('falls back to ollama provider for free-text model names not in the list', () => {
    const { stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/model');
    stdin.write(' ');
    stdin.write('deepseek-r1:14b');
    stdin.write('\r');
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'deepseek-r1:14b', provider: 'ollama' });
  });

  it('shows error when setModel throws', () => {
    vi.mocked(agent.setModel).mockImplementation(() => { throw new Error('Unknown model'); });
    const { lastFrame, stdin } = render(<App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />);
    stdin.write('/model');
    stdin.write('\r');
    expect(lastFrame()).toContain('Unknown model');
  });

  it('shows notice when savedModelId is not found after Ollama fetch', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    const { lastFrame } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('Previously selected model "llama3.2" is not available.');
  });

  it('silently switches to savedModelId when found in Ollama results', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([{ id: 'llama3.2', provider: 'ollama' }]);
    render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(agent.setModel).toHaveBeenCalledWith({ id: 'llama3.2', provider: 'ollama' });
  });

  it('does not show notice when savedModelId equals initialModelId (already resolved at startup)', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    const { lastFrame } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="claude-sonnet-4-6" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).not.toContain('Previously selected model');
  });

  it('clears notice when a new model is selected', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    const { lastFrame, stdin } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('Previously selected model "llama3.2" is not available.');
    stdin.write('/model');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).not.toContain('Previously selected model');
  });

  it('clears notice when a query is submitted', async () => {
    const { fetchOllamaModels } = await import('../models/ollama.js');
    vi.mocked(fetchOllamaModels).mockResolvedValueOnce([]);
    vi.mocked(agent.suggest).mockResolvedValue('const x = 1;');
    const { lastFrame, stdin } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId="llama3.2" />
    );
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('Previously selected model "llama3.2" is not available.');
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).not.toContain('Previously selected model');
  });

  it('passes unavailable provider notices to InputBar', async () => {
    const { unavailableProviderMessages } = await import('../models/availability.js');
    vi.mocked(unavailableProviderMessages).mockReturnValueOnce([
      'Google models are not available without GOOGLE_API_KEY',
    ]);
    const { lastFrame, stdin } = render(
      <App agent={agent} initialModelId="claude-sonnet-4-6" savedModelId={null} />
    );
    stdin.write('/model');
    expect(lastFrame()).toContain('Google models are not available without GOOGLE_API_KEY');
  });
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: 12 existing tests pass, 1 new test fails (App not yet passing the notices prop)

- [ ] **Step 3: Update `src/ui/App.tsx`**

Replace the file with:

```typescript
import React, { useEffect, useState } from 'react';
import { Box, Text, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';
import { type ModelInfo } from '../models/list.js';
import { fetchOllamaModels } from '../models/ollama.js';
import { saveModel } from '../models/persistence.js';
import { availableModels, unavailableProviderMessages } from '../models/availability.js';

interface Props {
  agent: Agent;
  initialModelId: string;
  savedModelId: string | null;
}

export function App({ agent, initialModelId, savedModelId }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const [models, setModels] = useState<ModelInfo[]>(availableModels());
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  useEffect(() => {
    fetchOllamaModels().then(ollamaModels => {
      const merged = ollamaModels.length > 0 ? [...availableModels(), ...ollamaModels] : availableModels();
      if (ollamaModels.length > 0) setModels(merged);

      if (savedModelId !== null && savedModelId !== initialModelId) {
        const found = merged.find(m => m.id === savedModelId);
        if (found) {
          agent.setModel(found);
          setSelectedModel(savedModelId);
        } else {
          setNotice(`Previously selected model "${savedModelId}" is not available.`);
        }
      }
    });
  }, [savedModelId, initialModelId, agent]);

  const handleSubmit = async (query: string, language?: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
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
      setNotice(null);
      saveModel(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <SnippetView snippet={snippet} loading={loading} error={error} />
      {notice && <Text dimColor>{notice}</Text>}
      <InputBar
        disabled={loading}
        selectedModel={selectedModel}
        models={models}
        unavailableNotices={unavailableProviderMessages()}
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run App tests to verify all 13 pass**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: 13 tests pass

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat: use availableModels() in App, pass unavailableNotices to InputBar"
```

---

### Task 7: Update `.env.example` and `CLAUDE.md`

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `.env.example`**

Replace the file with:

```
# Model to use — must be a static model ID from src/models/list.ts (not Ollama IDs).
# Ollama models are available at runtime only and can be selected via the /model picker.
DRAGON_MODEL=claude-sonnet-4-6

# Required when using a Claude model
ANTHROPIC_API_KEY=

# Required when using an OpenAI model
OPENAI_API_KEY=

# Required when using a Google model
GOOGLE_API_KEY=
```

- [ ] **Step 2: Update `CLAUDE.md`**

**In the Environment Setup table**, add a `GOOGLE_API_KEY` row:

| Env var | Values | Default |
|---|---|---|
| `DRAGON_MODEL` | static model ID from `src/models/list.ts` only | `claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | string | required for Claude models |
| `OPENAI_API_KEY` | string | required for OpenAI models |
| `GOOGLE_API_KEY` | string | required for Google models |

**In the Model layer section**, replace the existing bullet list with:

```markdown
- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`; `ModelProvider` includes `'anthropic' | 'openai' | 'ollama' | 'google'`
- `registry.ts` — `createModel(info: ModelInfo): BaseChatModel`; switches on `provider`; constructs `ChatAnthropic`, `ChatOpenAI`, `ChatOllama`, or `ChatGoogleGenerativeAI`; throws for unknown provider or missing API key (safety net — not reachable through normal UI flow)
- `ollama.ts` — `fetchOllamaModels()`: hits `GET http://localhost:11434/api/tags` (2 s timeout); deduplicates to one model per base name (newest `modified_at`); returns `[]` on any error
- `persistence.ts` — `loadSavedModel(): string | null`; `saveModel(id: string): void`; state file at `~/.dragon/state.json`; errors silently swallowed
- `availability.ts` — `availableModels(): ModelInfo[]` filters `MODELS` to providers with a non-empty API key; `unavailableProviderMessages(): string[]` returns one dim message per missing cloud provider
```

**In the UI section**, update the `App.tsx` and `InputBar.tsx` descriptions:

```markdown
- `App.tsx` — root Ink component; owns state (`snippet`, `loading`, `error`, `notice`, `selectedModel`); uses `availableModels()` for initial models state; `savedModelId` prop drives deferred Ollama validation (silently switches if found, sets `notice` if not); `handleModelChange` calls `agent.setModel()`, `saveModel()`, and clears notice; renders `SnippetView`, optional dim notice line, then `InputBar`
- `InputBar.tsx` — three modes: `default` (normal query), `editingLang` (`Ctrl+L`), `selectingModel` (triggered by typing `/model`). Shows `[model-id]` badge pinned right. Model picker shows arrow-key list followed by dim `unavailableNotices` lines; `Space` switches to free-text model entry; `Esc` cancels.
```

- [ ] **Step 3: Run the full suite to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: add GOOGLE_API_KEY and document availability module in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `'google'` added to `ModelProvider` | Task 1 |
| `gemini-2.5-pro`, `gemini-2.5-flash` in MODELS | Task 1 |
| `@langchain/google-genai` installed | Task 2 |
| `registry.ts` Google branch (`ChatGoogleGenerativeAI`) | Task 2 |
| `availability.ts`: `availableModels()` / `unavailableProviderMessages()` | Task 3 |
| Empty string key treated as missing | Task 3 |
| `index.tsx` uses `availableModels()`, graceful fallback chain | Task 4 |
| Exit with message if no models available | Task 4 |
| `App.tsx` uses `availableModels()` for initial state | Task 6 |
| `App.tsx` passes `unavailableProviderMessages()` to InputBar | Task 6 |
| Ollama useEffect uses `availableModels()` for merged list | Task 6 |
| `InputBar.tsx` renders dim notices below model list | Task 5 |
| Tests for availability module | Task 3 |
| Tests for registry Google branch | Task 2 |
| Tests for InputBar notices | Task 5 |
| Tests for App notices passthrough | Task 6 |
| `.env.example` + `CLAUDE.md` updated | Task 7 |

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `unavailableNotices: string[]` — declared in `InputBar` Props (Task 5), passed as `unavailableProviderMessages()` from `App` (Task 6), tested as string array in both files
- `availableModels(): ModelInfo[]` — used in `App` initial state, Ollama useEffect, and `index.tsx`; all call sites consistent
- `ModelProvider` union — `'google'` added in Task 1, handled in `PROVIDER_ENV`/`PROVIDER_DISPLAY` in Task 3, handled in registry in Task 2, exhaustiveness guard still enforces completeness
