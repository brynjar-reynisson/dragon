# Dragon Global Installer — Design Spec

**Date:** 2026-04-21  
**Status:** Approved  
**Scope:** Make `dragon` available as a global CLI command via `npm link`.

---

## Overview

Add a `build:install` npm script that compiles the project and registers it globally so `dragon` can be typed from any directory.

---

## Changes

### `src/index.tsx`

Add `#!/usr/bin/env node` as the very first line (hashbang). TypeScript preserves hashbangs in compiled output, so `dist/index.js` will carry it through. On Windows, npm's `.cmd` wrapper handles execution without needing the hashbang directly, but having it ensures cross-platform correctness.

### `package.json`

Add to `scripts`:

```json
"build:install": "tsc && npm link"
```

The existing `bin` field (`"dragon": "./dist/index.js"`) already declares the binary — `npm link` uses it to register `dragon` globally.

---

## Usage

```bash
npm run build:install   # compile + register globally
dragon                  # works from any directory
npm unlink -g dragon    # remove global registration
```

---

## Out of Scope

- Standalone install scripts (`.sh` / `.ps1`)
- Publishing to npm registry
- Auto-update on file change
