# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run directly via tsx (no build step)
npm run build        # Compile TypeScript to dist/
npm run build:install  # Build and npm link (installs `dragon` globally)
npm start            # Run compiled output
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
```

Run a single test file:
```bash
npx vitest run src/agent/Agent.test.ts
```

## Environment Setup

Copy `.env.example` to `.env` and fill in the required API key for your chosen provider.

| Env var | Values | Default |
|---|---|---|
| `DRAGON_PROVIDER` | `claude`, `openai` | `claude` |
| `ANTHROPIC_API_KEY` | string | required for claude |
| `OPENAI_API_KEY` | string | required for openai |

## Architecture

Dragon is a terminal UI (TUI) coding assistant built with **Ink** (React for terminals). It accepts natural-language queries and returns raw code snippets with syntax highlighting.

**Data flow:** `InputBar` (query + language) → `App.onSubmit` → `Agent.suggest()` → active `Provider` → snippet string → `SnippetView` renders with `cli-highlight`.

### Provider abstraction (`src/providers/`)

- `types.ts` — `Provider` interface: `suggest(prompt, language?): Promise<string>`
- `claude.ts` — Anthropic SDK implementation
- `openai.ts` — OpenAI SDK implementation
- Provider selected at startup via `DRAGON_PROVIDER` env var; instantiated in `src/index.tsx`

### Agent (`src/agent/Agent.ts`)

Thin orchestrator: constructor takes a `Provider`, exposes `suggest(query, language?)`. Builds a system prompt that instructs the model to return only raw code — no markdown fences, no prose.

### UI (`src/ui/`)

- `App.tsx` — root Ink component; owns state (`snippet`, `loading`, `error`, `language`); renders `InputBar` above `SnippetView`
- `InputBar.tsx` — text input; `Ctrl+L` toggles language-override mode (Tab to confirm, Esc to clear); shows `[lang: x]` prefix when set; input is disabled while loading
- `SnippetView.tsx` — displays snippet via `cli-highlight`; shows spinner while loading; one-line red error on failure; usage hint on empty state

### Key bindings

| Key | Action |
|---|---|
| `Enter` | Submit query |
| `Ctrl+L` | Toggle language override |
| `Ctrl+C` | Exit |

## Testing

Tests live alongside source files (`*.test.ts` / `*.test.tsx`). `src/test-setup.ts` wraps `ink-testing-library`'s `render` with React `act()` so Ink effects flush synchronously in tests.

## Iteration 1 scope

Snippet suggestions only — no file editing, code execution, git operations, streaming, or persistent history.
