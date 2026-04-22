# Model Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the last selected model to `~/.dragon/state.json` and restore it on startup, with a one-line notice if an Ollama model is no longer available.

**Architecture:** A new `persistence.ts` module exposes two synchronous functions (`loadSavedModel` / `saveModel`). `index.tsx` reads the saved model at startup and resolves a static `startupModelId` (falling back to env/default if the saved model is not in the static MODELS list). `App.tsx` receives `savedModelId` as a prop and, after the Ollama fetch resolves, silently switches to the saved model if found, or shows a one-line notice if not.

**Tech Stack:** Node.js `fs` (sync), `os`, `path`; React/Ink `useState`/`useEffect`; Vitest with `vi.mock`

---

### Task 1: `src/models/persistence.ts` — TDD

**Files:**
- Create: `src/models/persistence.ts`
- Create: `src/models/persistence.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/models/persistence.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('os', () => ({ homedir: vi.fn().mockReturnValue('/home/user') }));
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('loadSavedModel', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns the saved model id when state file is valid', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ model: 'llama3.2' }));
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBe('llama3.2');
  });

  it('returns null when the file does not exist', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });

  it('returns null when the model field is missing', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ other: 'value' }));
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });

  it('returns null when the model field is not a string', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ model: 42 }));
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });

  it('returns null when the file contains invalid JSON', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue('not json');
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });
});

describe('saveModel', () => {
  beforeEach(() => { vi.resetModules(); });

  it('writes the model id to the state file', async () => {
    const { writeFileSync, mkdirSync } = await import('fs');
    const { saveModel } = await import('./persistence.js');
    saveModel('llama3.2');
    expect(mkdirSync).toHaveBeenCalledWith('/home/user/.dragon', { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      '/home/user/.dragon/state.json',
      JSON.stringify({ model: 'llama3.2' })
    );
  });

  it('swallows errors silently', async () => {
    const { writeFileSync } = await import('fs');
    vi.mocked(writeFileSync).mockImplementation(() => { throw new Error('EACCES'); });
    const { saveModel } = await import('./persistence.js');
    expect(() => saveModel('llama3.2')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/models/persistence.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/models/persistence.ts`**

```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATE_DIR = join(homedir(), '.dragon');
const STATE_FILE = join(STATE_DIR, 'state.json');

export function loadSavedModel(): string | null {
  try {
    const raw = readFileSync(STATE_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'model' in parsed) {
      const { model } = parsed as Record<string, unknown>;
      if (typeof model === 'string') return model;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveModel(id: string): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify({ model: id }));
  } catch {
    // persistence failure must not crash the app
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/models/persistence.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/models/persistence.ts src/models/persistence.test.ts
git commit -m "feat: add model persistence module (loadSavedModel / saveModel)"
```

---

### Task 2: Update `src/index.tsx` — startup model resolution

**Files:**
- Modify: `src/index.tsx`

No new tests needed — this is wiring in a top-level entry file. The persistence module is tested in Task 1; index.tsx has no isolated logic worth unit-testing.

- [ ] **Step 1: Update `src/index.tsx`**

Replace the file content with:

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
import { DEFAULT_MODEL_ID, MODELS } from './models/list.js';
import { loadSavedModel } from './models/persistence.js';

const savedModelId = loadSavedModel();
const envModelId = process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID;
const startupModelId = (savedModelId !== null && MODELS.some(m => m.id === savedModelId))
  ? savedModelId
  : envModelId;

let agent: Agent;
try {
  agent = new Agent(startupModelId);
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

render(<App agent={agent} initialModelId={startupModelId} savedModelId={savedModelId} />);
```

- [ ] **Step 2: Run full suite**

```bash
npm test
```

Expected: all existing tests still pass (App.test.tsx will fail on missing prop — that's expected and will be fixed in Task 3)

- [ ] **Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: resolve saved model at startup, pass savedModelId to App"
```

---

### Task 3: Update `src/ui/App.tsx` + `src/ui/App.test.tsx`

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/App.test.tsx`

- [ ] **Step 1: Write the new/updated tests first**

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
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: existing tests fail (missing `savedModelId` prop); new tests fail (prop not on component yet)

- [ ] **Step 3: Update `src/ui/App.tsx`**

Replace the file content with:

```typescript
import React, { useEffect, useState } from 'react';
import { Box, Text, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';
import { MODELS, type ModelInfo } from '../models/list.js';
import { fetchOllamaModels } from '../models/ollama.js';
import { saveModel } from '../models/persistence.js';

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
  const [models, setModels] = useState<ModelInfo[]>(MODELS);
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  useEffect(() => {
    fetchOllamaModels().then(ollamaModels => {
      const merged = ollamaModels.length > 0 ? [...MODELS, ...ollamaModels] : MODELS;
      if (ollamaModels.length > 0) setModels(merged);

      if (savedModelId !== null && savedModelId !== initialModelId) {
        const found = merged.find(m => m.id === savedModelId);
        if (found) {
          agent.setModel(found);
          setSelectedModel(savedModelId);
          saveModel(savedModelId);
        } else {
          setNotice(`Previously selected model "${savedModelId}" is not available.`);
        }
      }
    });
  }, []);

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
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run src/ui/App.test.tsx
```

Expected: PASS (12 tests)

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat: add savedModelId prop, notice state, and Ollama deferred validation to App"
```

---

### Task 4: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Model layer section in `CLAUDE.md`**

In the `### Model layer (src/models/)` section, add a bullet for `persistence.ts`:

The current content is:
```markdown
### Model layer (`src/models/`)

- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`
- `registry.ts` — `createModel(id): BaseChatModel`; constructs `ChatAnthropic` or `ChatOpenAI` from env API keys; throws immediately for unknown IDs or missing keys
```

Replace it with:
```markdown
### Model layer (`src/models/`)

- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`
- `registry.ts` — `createModel(info: ModelInfo): BaseChatModel`; switches on `provider`; constructs `ChatAnthropic`, `ChatOpenAI`, or `ChatOllama`; throws for unknown provider or missing API key
- `ollama.ts` — `fetchOllamaModels()`: hits `GET http://localhost:11434/api/tags` (2 s timeout); deduplicates to one model per base name (newest `modified_at`); returns `[]` on any error
- `persistence.ts` — `loadSavedModel(): string | null`; `saveModel(id: string): void`; state file at `~/.dragon/state.json`; errors silently swallowed
```

- [ ] **Step 2: Update the `App.tsx` description to mention `savedModelId` and `notice`**

Find the current App.tsx line in the UI section:
```markdown
- `App.tsx` — root Ink component; owns state (`snippet`, `loading`, `error`, `language`, `selectedModel`); `handleModelChange` calls `agent.setModel()` and updates `selectedModel`; renders `InputBar` above `SnippetView`
```

Replace with:
```markdown
- `App.tsx` — root Ink component; owns state (`snippet`, `loading`, `error`, `notice`, `selectedModel`); `savedModelId` prop drives deferred Ollama validation (silently switches if found, sets `notice` if not); `handleModelChange` calls `agent.setModel()`, `saveModel()`, and clears notice; renders `SnippetView`, optional dim notice line, then `InputBar`
```

- [ ] **Step 3: Update `src/index.tsx` description**

The index.tsx description (if present in CLAUDE.md) should note that it reads `loadSavedModel()` at startup. If there is no explicit index.tsx entry, no change needed.

- [ ] **Step 4: Run full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document persistence module and updated App/index startup flow in CLAUDE.md"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `src/models/persistence.ts` with `loadSavedModel` / `saveModel` | Task 1 |
| State file at `~/.dragon/state.json`, format `{ "model": "<id>" }` | Task 1 |
| `loadSavedModel` returns null on any read/parse error | Task 1 |
| `saveModel` swallows errors silently | Task 1 |
| `index.tsx` calls `loadSavedModel`, resolves `startupModelId` | Task 2 |
| Static model match → use savedModelId as startupModelId | Task 2 |
| No match → fallback to env/default | Task 2 |
| Pass `savedModelId` to App | Task 2 |
| `App.tsx` new `savedModelId` prop | Task 3 |
| `App.tsx` new `notice` state | Task 3 |
| Ollama useEffect: if savedModelId found in merged list → silent switch | Task 3 |
| Ollama useEffect: if not found → setNotice | Task 3 |
| `handleModelChange` calls `saveModel` and `setNotice(null)` | Task 3 |
| `handleSubmit` calls `setNotice(null)` | Task 3 |
| Notice rendered as dim line between SnippetView and InputBar | Task 3 |
| CLAUDE.md updated | Task 4 |

**Placeholder scan:** None found.

**Type consistency:**
- `savedModelId: string | null` — consistent across index.tsx (declared), App props (received), useEffect (checked)
- `ModelInfo` — `found` variable in useEffect is typed via `merged.find(m => m.id === savedModelId)` returning `ModelInfo | undefined`
- `saveModel(id: string)` — called with `savedModelId` (string, after null check) and `id` (string) in handleModelChange — correct
