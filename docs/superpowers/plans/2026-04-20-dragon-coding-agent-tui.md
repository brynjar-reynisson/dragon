# Dragon Coding Agent TUI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript terminal UI coding agent that accepts natural-language requests and returns syntax-highlighted code snippets, with pluggable AI providers (Claude and OpenAI).

**Architecture:** Ink-based TUI with three layers: UI components (App, InputBar, SnippetView), an Agent orchestration class, and swappable Provider implementations behind a shared interface. Active provider is chosen via `DRAGON_PROVIDER` env var at startup. All state is in-memory; no persistence between sessions.

**Tech Stack:** TypeScript 5, Ink v5, React 18, ink-text-input, ink-spinner, cli-highlight, @anthropic-ai/sdk, openai, Vitest, ink-testing-library, tsx

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript compiler config (NodeNext ESM) |
| `vitest.config.ts` | Vitest config with React plugin for JSX |
| `src/index.tsx` | Entry point: reads env, selects provider, mounts Ink app |
| `src/providers/types.ts` | `Provider` interface |
| `src/providers/claude.ts` | Anthropic SDK implementation of Provider |
| `src/providers/openai.ts` | OpenAI SDK implementation of Provider |
| `src/agent/Agent.ts` | Wraps a Provider, exposes `suggest(prompt, language?)` |
| `src/ui/App.tsx` | Root Ink component, owns all state |
| `src/ui/SnippetView.tsx` | Renders snippet (highlighted), loading spinner, or error |
| `src/ui/InputBar.tsx` | Text input + Ctrl+L language override |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dragon",
  "version": "0.1.0",
  "description": "A coding agent TUI",
  "type": "module",
  "bin": { "dragon": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.tsx",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.0",
    "cli-highlight": "^2.1.11",
    "ink": "^5.0.1",
    "ink-spinner": "^5.0.0",
    "ink-text-input": "^6.0.0",
    "openai": "^4.67.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "^18.3.11",
    "@vitejs/plugin-react": "^4.3.2",
    "ink-testing-library": "^4.0.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold dragon project"
```

---

### Task 2: Provider interface

**Files:**
- Create: `src/providers/types.ts`

- [ ] **Step 1: Create `src/providers/types.ts`**

```typescript
export interface Provider {
  suggest(prompt: string, language?: string): Promise<string>;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/providers/types.ts
git commit -m "feat: add Provider interface"
```

---

### Task 3: Agent

**Files:**
- Create: `src/agent/Agent.ts`
- Create: `src/agent/Agent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/agent/Agent.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Agent } from './Agent.js';
import type { Provider } from '../providers/types.js';

describe('Agent', () => {
  it('delegates suggest to the provider', async () => {
    const provider: Provider = { suggest: vi.fn().mockResolvedValue('const x = 1;') };
    const agent = new Agent(provider);
    const result = await agent.suggest('declare a variable', 'typescript');
    expect(result).toBe('const x = 1;');
    expect(provider.suggest).toHaveBeenCalledWith('declare a variable', 'typescript');
  });

  it('propagates provider errors', async () => {
    const provider: Provider = { suggest: vi.fn().mockRejectedValue(new Error('API error')) };
    const agent = new Agent(provider);
    await expect(agent.suggest('foo')).rejects.toThrow('API error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — "Cannot find module './Agent.js'"

- [ ] **Step 3: Create `src/agent/Agent.ts`**

```typescript
import type { Provider } from '../providers/types.js';

export class Agent {
  constructor(private provider: Provider) {}

  suggest(prompt: string, language?: string): Promise<string> {
    return this.provider.suggest(prompt, language);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/agent/Agent.ts src/agent/Agent.test.ts
git commit -m "feat: add Agent class"
```

---

### Task 4: Claude provider

**Files:**
- Create: `src/providers/claude.ts`
- Create: `src/providers/claude.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/providers/claude.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeProvider } from './claude.js';
import Anthropic from '@anthropic-ai/sdk';

vi.mock('@anthropic-ai/sdk');

describe('ClaudeProvider', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);
  });

  it('returns trimmed text from API response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '  function foo() {}  ' }],
    });
    const provider = new ClaudeProvider('test-key');
    const result = await provider.suggest('write a foo function');
    expect(result).toBe('function foo() {}');
  });

  it('includes language in the system prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'fn foo() {}' }],
    });
    const provider = new ClaudeProvider('test-key');
    await provider.suggest('write a foo function', 'rust');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Use rust'),
      })
    );
  });

  it('throws when response content is not text', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'image', source: {} }] });
    const provider = new ClaudeProvider('test-key');
    await expect(provider.suggest('foo')).rejects.toThrow('Unexpected response type');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — "Cannot find module './claude.js'"

- [ ] **Step 3: Create `src/providers/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from './types.js';

export class ClaudeProvider implements Provider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async suggest(prompt: string, language?: string): Promise<string> {
    const langInstruction = language ? ` Use ${language}.` : '';
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a coding assistant. Return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.${langInstruction}`,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');
    return content.text.trim();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/providers/claude.ts src/providers/claude.test.ts
git commit -m "feat: add Claude provider"
```

---

### Task 5: OpenAI provider

**Files:**
- Create: `src/providers/openai.ts`
- Create: `src/providers/openai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/providers/openai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from './openai.js';
import OpenAI from 'openai';

vi.mock('openai');

describe('OpenAIProvider', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);
  });

  it('returns trimmed text from API response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '  const x = 1;  ' } }],
    });
    const provider = new OpenAIProvider('test-key');
    const result = await provider.suggest('declare a variable');
    expect(result).toBe('const x = 1;');
  });

  it('includes language in the system prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'let x = 1' } }],
    });
    const provider = new OpenAIProvider('test-key');
    await provider.suggest('declare a variable', 'typescript');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Use typescript'),
          }),
        ]),
      })
    );
  });

  it('handles null message content gracefully', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });
    const provider = new OpenAIProvider('test-key');
    const result = await provider.suggest('foo');
    expect(result).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — "Cannot find module './openai.js'"

- [ ] **Step 3: Create `src/providers/openai.ts`**

```typescript
import OpenAI from 'openai';
import type { Provider } from './types.js';

export class OpenAIProvider implements Provider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async suggest(prompt: string, language?: string): Promise<string> {
    const langInstruction = language ? ` Use ${language}.` : '';
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a coding assistant. Return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.${langInstruction}`,
        },
        { role: 'user', content: prompt },
      ],
    });
    return (response.choices[0].message.content ?? '').trim();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/providers/openai.ts src/providers/openai.test.ts
git commit -m "feat: add OpenAI provider"
```

---

### Task 6: SnippetView component

**Files:**
- Create: `src/ui/SnippetView.tsx`
- Create: `src/ui/SnippetView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/SnippetView.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { SnippetView } from './SnippetView.js';

describe('SnippetView', () => {
  it('shows usage hint when no snippet and not loading', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={false} error={null} />
    );
    expect(lastFrame()).toContain('Type a request');
  });

  it('shows "Generating" text while loading', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={true} error={null} />
    );
    expect(lastFrame()).toContain('Generating');
  });

  it('shows error message when error is set', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={false} error="API rate limit exceeded" />
    );
    expect(lastFrame()).toContain('API rate limit exceeded');
  });

  it('renders snippet content when provided', () => {
    const { lastFrame } = render(
      <SnippetView snippet="function foo() {}" loading={false} error={null} />
    );
    expect(lastFrame()).toContain('function foo() {}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — "Cannot find module './SnippetView.js'"

- [ ] **Step 3: Create `src/ui/SnippetView.tsx`**

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { highlight } from 'cli-highlight';

interface Props {
  snippet: string;
  loading: boolean;
  error: string | null;
}

export function SnippetView({ snippet, loading, error }: Props) {
  if (loading) {
    return (
      <Box gap={1}>
        <Text color="yellow"><Spinner type="dots" /></Text>
        <Text>Generating snippet...</Text>
      </Box>
    );
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (!snippet) {
    return (
      <Text dimColor>Type a request above and press Enter to generate a snippet.</Text>
    );
  }

  const highlighted = highlight(snippet, { ignoreIllegals: true });
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text>{highlighted}</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/ui/SnippetView.tsx src/ui/SnippetView.test.tsx
git commit -m "feat: add SnippetView component"
```

---

### Task 7: InputBar component

**Files:**
- Create: `src/ui/InputBar.tsx`
- Create: `src/ui/InputBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/InputBar.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — "Cannot find module './InputBar.js'"

- [ ] **Step 3: Create `src/ui/InputBar.tsx`**

```typescript
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  disabled: boolean;
  onSubmit: (query: string, language?: string) => void;
}

export function InputBar({ disabled, onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [editingLang, setEditingLang] = useState(false);

  useInput((input, key) => {
    if (key.ctrl && input === 'l') {
      setEditingLang(prev => !prev);
    }
    if (key.escape && editingLang) {
      setEditingLang(false);
    }
  }, { isActive: !disabled });

  const handleSubmit = (value: string) => {
    if (!value.trim()) return;
    onSubmit(value.trim(), language.trim() || undefined);
    setQuery('');
  };

  const handleLangSubmit = (value: string) => {
    setLanguage(value.trim());
    setEditingLang(false);
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box gap={1}>
        {language && !editingLang && <Text dimColor>[lang: {language}]</Text>}
        {editingLang ? (
          <Box gap={1}>
            <Text>lang:</Text>
            <TextInput
              value={language}
              onChange={setLanguage}
              onSubmit={handleLangSubmit}
              placeholder="e.g. typescript"
            />
          </Box>
        ) : (
          <TextInput
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            placeholder="Describe the code you need..."
            isDisabled={disabled}
          />
        )}
      </Box>
      <Text dimColor>Ctrl+L: set language  •  Enter: submit  •  Ctrl+C: exit</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/ui/InputBar.tsx src/ui/InputBar.test.tsx
git commit -m "feat: add InputBar component"
```

---

### Task 8: App root component

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/App.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Agent } from '../agent/Agent.js';

describe('App', () => {
  it('renders input bar and empty snippet hint on load', () => {
    const agent = { suggest: vi.fn() } as unknown as Agent;
    const { lastFrame } = render(<App agent={agent} />);
    expect(lastFrame()).toContain('Ctrl+L');
    expect(lastFrame()).toContain('Type a request');
  });

  it('shows snippet after successful suggest', async () => {
    const agent = {
      suggest: vi.fn().mockResolvedValue('const x = 1;'),
    } as unknown as Agent;
    const { lastFrame, stdin } = render(<App agent={agent} />);
    stdin.write('declare a variable');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('shows error message when suggest fails', async () => {
    const agent = {
      suggest: vi.fn().mockRejectedValue(new Error('API rate limit')),
    } as unknown as Agent;
    const { lastFrame, stdin } = render(<App agent={agent} />);
    stdin.write('foo');
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    expect(lastFrame()).toContain('API rate limit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — "Cannot find module './App.js'"

- [ ] **Step 3: Create `src/ui/App.tsx`**

```typescript
import React, { useState } from 'react';
import { Box } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';

interface Props {
  agent: Agent;
}

export function App({ agent }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Box flexDirection="column" padding={1}>
      <InputBar disabled={loading} onSubmit={handleSubmit} />
      <SnippetView snippet={snippet} loading={loading} error={error} />
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat: add App root component"
```

---

### Task 9: Entry point and provider selection

**Files:**
- Create: `src/index.tsx`

- [ ] **Step 1: Create `src/index.tsx`**

```typescript
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Agent } from './agent/Agent.js';
import { ClaudeProvider } from './providers/claude.js';
import { OpenAIProvider } from './providers/openai.js';
import type { Provider } from './providers/types.js';

function createProvider(): Provider {
  const name = (process.env['DRAGON_PROVIDER'] ?? 'claude').toLowerCase();

  if (name === 'openai') {
    const key = process.env['OPENAI_API_KEY'];
    if (!key) {
      process.stderr.write('Error: OPENAI_API_KEY is required for the OpenAI provider.\n');
      process.exit(1);
    }
    return new OpenAIProvider(key);
  }

  const key = process.env['ANTHROPIC_API_KEY'];
  if (!key) {
    process.stderr.write('Error: ANTHROPIC_API_KEY is required for the Claude provider.\n');
    process.exit(1);
  }
  return new ClaudeProvider(key);
}

const agent = new Agent(createProvider());
render(<App agent={agent} />);
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: add entry point with provider selection"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: `dist/` directory created with compiled JS, no TypeScript errors.

- [ ] **Step 3: Smoke test — missing API key**

Run: `npm run dev` (no env vars set)

Expected: prints `Error: ANTHROPIC_API_KEY is required for the Claude provider.` and exits cleanly.

- [ ] **Step 4: Smoke test — full run (requires API key)**

Run: `ANTHROPIC_API_KEY=<your-key> npm run dev`

Expected: Terminal UI launches. Top section shows an input box with placeholder text and keyboard hints. Bottom section shows the empty-state hint. Type `write a debounce function in TypeScript` and press Enter. A spinner appears briefly, then a syntax-highlighted TypeScript snippet fills the bottom panel.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: dragon coding agent TUI — iteration 1 complete"
```
