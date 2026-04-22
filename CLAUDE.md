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
| `DRAGON_MODEL` | static model ID from `src/models/list.ts` only (Ollama models are selected at runtime via `/model`) | `claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | string | required for Claude models |
| `OPENAI_API_KEY` | string | required for OpenAI models |

## Architecture

Dragon is a terminal UI (TUI) coding assistant built with **Ink** (React for terminals). It accepts natural-language queries and returns raw code snippets with syntax highlighting.

**Data flow:** `InputBar` (query + language) → `App.onSubmit` → `Agent.suggest()` → LangChain `BaseChatModel` → snippet string → `SnippetView` renders with `cli-highlight`.

### Model layer (`src/models/`)

- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`; `ModelProvider` includes `'anthropic' | 'openai' | 'ollama'`
- `registry.ts` — `createModel(info: ModelInfo): BaseChatModel`; switches on `info.provider` to construct `ChatAnthropic`, `ChatOpenAI`, or `ChatOllama`; throws for missing API keys or unrecognised provider
- `ollama.ts` — `fetchOllamaModels(): Promise<ModelInfo[]>`; calls `GET http://localhost:11434/api/tags` (2 s timeout), groups by model family (base name before `:`), keeps newest `modified_at` per family; returns `[]` on any error

### Agent (`src/agent/Agent.ts`)

Owns a `BaseChatModel` instance. Constructor takes `initialModelId`, resolves it to a `ModelInfo` from `MODELS`, and throws for unknown startup model IDs. Exposes `setModel(info: ModelInfo)` for runtime switching (caller resolves provider). `suggest(query, language?)` builds `[SystemMessage, HumanMessage]` and calls `model.invoke()`.

### UI (`src/ui/`)

- `App.tsx` — root Ink component; owns state (`snippet`, `loading`, `error`, `selectedModel`, `models`); `handleModelChange` resolves `ModelInfo` and calls `agent.setModel(info)`; fetches Ollama models on mount and merges into `models`; renders `InputBar` above `SnippetView`
- `InputBar.tsx` — three modes: `default` (normal query), `editingLang` (`Ctrl+L`), `selectingModel` (triggered by typing `/model`). Shows `[model-id]` badge pinned right. Model picker shows arrow-key list; `Space` switches to free-text model entry; `Esc` cancels.
- `SnippetView.tsx` — displays snippet via `cli-highlight`; shows spinner while loading; one-line red error on failure; usage hint on empty state

### Key bindings

| Key | Action |
|---|---|
| `Enter` | Submit query (or confirm model selection) |
| `Ctrl+L` | Toggle language override |
| `/model` | Open model selector |
| `↑` / `↓` | Navigate model picker |
| `Space` | Switch to free-text model entry |
| `Esc` | Cancel model selection |
| `Ctrl+C` | Exit |

## Testing

Tests live alongside source files (`*.test.ts` / `*.test.tsx`). `src/test-setup.ts` wraps `ink-testing-library`'s `render` with React `act()` so Ink effects flush synchronously in tests.

## Iteration 1 scope

Snippet suggestions only — no file editing, code execution, git operations, streaming, or persistent history.
