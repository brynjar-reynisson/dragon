# Dragon — Coding Agent TUI: Design Spec

**Date:** 2026-04-20  
**Status:** Approved  
**Scope:** Iteration 1 — snippet suggestions only. No file editing, code execution, or git.

---

## Overview

Dragon is a TypeScript terminal UI application that accepts natural-language requests and returns code snippets. It uses Ink (React for terminals) for rendering and supports pluggable AI providers (Claude, OpenAI) selected via environment variable.

---

## Architecture

```
dragon/
├── src/
│   ├── index.tsx              # Entry point, mounts Ink app
│   ├── ui/
│   │   ├── App.tsx            # Root component, owns all state
│   │   ├── SnippetView.tsx    # Highlighted code display
│   │   └── InputBar.tsx       # Text input + language selector
│   ├── agent/
│   │   └── Agent.ts           # Orchestrates request → provider → response
│   └── providers/
│       ├── types.ts            # Provider interface
│       ├── claude.ts           # Claude implementation
│       └── openai.ts           # OpenAI implementation
├── package.json
└── tsconfig.json
```

### Data Flow

`InputBar` captures query + optional language → calls `Agent.suggest()` → `Agent` delegates to active `Provider` → returns snippet string → `App` state updates → `SnippetView` re-renders with highlighted code.

### Provider Interface

```ts
interface Provider {
  suggest(prompt: string, language?: string): Promise<string>
}
```

Active provider selected at startup via `DRAGON_PROVIDER=claude|openai` env var (default: `claude`).

---

## Components

### `App.tsx`
Root Ink component. Owns state: `snippet`, `loading`, `error`, `language`. Renders `InputBar` above `SnippetView`. Passes `onSubmit(query, language?)` to `InputBar`.

### `InputBar.tsx`
Two modes toggled by `Ctrl+L`:
- **Default:** free-text query input
- **Language override:** inline text field to type a language name; Tab to confirm, Esc to clear back to `auto`

When language is set, shows `[lang: typescript]` as a dim prefix. Submitting clears the input field.

### `SnippetView.tsx`
Renders the current snippet using `cli-highlight` for terminal syntax highlighting. Shows Ink `<Spinner>` while loading. Shows one-line red error on failure. Empty state shows a brief usage hint.

### `Agent.ts`
Constructor accepts a `Provider`. Single public method: `suggest(query, language?)`. Builds a system prompt instructing the model to return only a raw code snippet — no markdown fences, no prose explanation. Returns the result string.

---

## Error Handling

- **Provider failure** (network, rate limit): show one-line red error in `SnippetView`; input stays active for immediate retry.
- **Missing API key at startup**: print a clear error message and exit before mounting the UI.
- **Loading state**: input disabled, spinner shown; prevents double-submits.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Submit query |
| `Ctrl+L` | Open/clear language override |
| `Ctrl+C` | Exit |

---

## Configuration

| Env var | Values | Default |
|---------|--------|---------|
| `DRAGON_PROVIDER` | `claude`, `openai` | `claude` |
| `ANTHROPIC_API_KEY` | string | — |
| `OPENAI_API_KEY` | string | — |

---

## Out of Scope (Iteration 1)

- File editing or applying snippets
- Running/executing code
- Git operations
- Persistent conversation history
- Streaming responses
