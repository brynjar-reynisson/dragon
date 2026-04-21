# Dragon Global Installer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `dragon` available as a global CLI command by adding a hashbang to the entry point and a `build:install` npm script.

**Architecture:** Two file changes — a hashbang in `src/index.tsx` (preserved by TypeScript in `dist/index.js`) and a new `build:install` script in `package.json` that runs `tsc && npm link`. The existing `bin` field in `package.json` already declares the binary name.

**Tech Stack:** TypeScript, npm link

---

## File Map

| File | Change |
|------|--------|
| `src/index.tsx` | Add `#!/usr/bin/env node` as line 1 |
| `package.json` | Add `"build:install"` script |

---

### Task 1: Add hashbang and build:install script

**Files:**
- Modify: `src/index.tsx` (line 1)
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add hashbang to `src/index.tsx`**

The file currently starts with `import React from 'react';`. Prepend the hashbang so it becomes:

```typescript
#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Agent } from './agent/Agent.js';
import { ClaudeProvider } from './providers/claude.js';
import { OpenAIProvider } from './providers/openai.js';
import type { Provider } from './providers/types.js';

function createProvider(): Provider {
  const name = (process.env['DRAGON_PROVIDER'] ?? 'claude').toLowerCase();

  if (name !== 'claude' && name !== 'openai') {
    process.stderr.write(`Error: Unknown provider "${name}". Valid values: claude, openai.\n`);
    process.exit(1);
  }

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

- [ ] **Step 2: Add `build:install` script to `package.json`**

Add one entry to the `scripts` section:

```json
{
  "name": "dragon",
  "version": "0.1.0",
  "description": "A coding agent TUI",
  "type": "module",
  "bin": { "dragon": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "build:install": "tsc && npm link",
    "start": "node dist/index.js",
    "dev": "tsx src/index.tsx",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`

Expected: no errors. (TypeScript supports hashbang comments at the top of files.)

- [ ] **Step 4: Run `build:install`**

Run: `npm run build:install`

Expected:
- `tsc` compiles without errors
- `npm link` outputs something like: `added 1 package, and audited N packages`
- `dist/index.js` now starts with `#!/usr/bin/env node`

- [ ] **Step 5: Verify `dragon` is globally available**

Open a new terminal (or `cd` to a different directory) and run:

```bash
dragon
```

Expected: `Error: ANTHROPIC_API_KEY is required for the Claude provider.` — this confirms the binary is found and executes correctly (the API key error is the expected startup failure when no key is set).

- [ ] **Step 6: Verify the full test suite still passes**

Run: `npm test`

Expected: 18 passed, 0 failed.
