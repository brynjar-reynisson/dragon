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
| `GOOGLE_API_KEY` | string | required for Google models |
| `DEEPSEEK_API_KEY` | string | required for DeepSeek models |

## Architecture

Dragon is a terminal UI (TUI) coding assistant built with **Ink** (React for terminals). It accepts natural-language queries and returns raw code snippets with syntax highlighting.

**Data flow (snippet):** `InputBar` → `App.onSubmit` → `Agent.suggest()` → LangChain `BaseChatModel` → snippet string → `SnippetView` renders with `cli-highlight`.

**Data flow (execution):** Query starting with `!` → `executeCommand(cmd, 'platform')` (cmd.exe / bash). Query starting with `!!` → `executeCommand(cmd, 'powershell')`. Output shown in `SnippetView` without syntax highlighting.

### Model layer (`src/models/`)

- `list.ts` — `MODELS` array of `{ id, provider }` and `DEFAULT_MODEL_ID`; `ModelProvider` includes `'anthropic' | 'openai' | 'ollama' | 'google' | 'deepseek'`
- `registry.ts` — `createModel(info: ModelInfo): BaseChatModel`; switches on `provider`; constructs `ChatAnthropic`, `ChatOpenAI`, `ChatOllama`, `ChatGoogleGenerativeAI`, or `ChatDeepSeek`; throws for unknown provider or missing API key (safety net — not reachable through normal UI flow)
- `ollama.ts` — `fetchOllamaModels()`: hits `GET http://localhost:11434/api/tags` (2 s timeout); deduplicates to one model per base name (newest `modified_at`); returns `[]` on any error
- `persistence.ts` — `loadSavedModel(): string | null`; `saveModel(id: string): void`; state file at `~/.dragon/state.json`; errors silently swallowed
- `availability.ts` — `availableModels(): ModelInfo[]` filters `MODELS` to providers with a non-empty API key; `unavailableProviderMessages(): string[]` returns one dim message per missing cloud provider

### Agent (`src/agent/Agent.ts`)

Owns a `BaseChatModel` instance. Constructor takes `initialModelId`, resolves it to a `ModelInfo` from `MODELS`, and throws for unknown startup model IDs. Exposes `setModel(info: ModelInfo)` for runtime switching (caller resolves provider). `suggest(query, language?)` builds `[SystemMessage, HumanMessage]` and calls `model.invoke()`.

### UI (`src/ui/`)

- `App.tsx` — root Ink component; owns state (`snippet`, `loading`, `error`, `notice`, `selectedModel`); uses `availableModels()` for initial models state; `savedModelId` prop drives deferred Ollama validation (silently switches if found, sets `notice` if not); `handleModelChange` calls `agent.setModel()`, `saveModel()`, and clears notice; renders `SnippetView`, optional dim notice line, then `InputBar`
- `InputBar.tsx` — two modes: `default` (normal query), `selectingModel` (triggered by typing `/model`). Shows `[model-id]` badge pinned right. Model picker shows arrow-key list followed by dim `unavailableNotices` lines; `Space` switches to free-text model entry; `Esc` cancels.
- `SnippetView.tsx` — displays snippet via `cli-highlight`; shows spinner while loading; one-line red error on failure; usage hint on empty state

### Key bindings

| Key | Action |
|---|---|
| `Enter` | Submit query (or confirm model selection) |
| `/model` | Open model selector |
| `↑` / `↓` | Navigate model picker |
| `Space` | Switch to free-text model entry |
| `Esc` | Cancel model selection |
| `Ctrl+C` | Exit |

## Testing

Tests live alongside source files (`*.test.ts` / `*.test.tsx`). `src/test-setup.ts` wraps `ink-testing-library`'s `render` with React `act()` so Ink effects flush synchronously in tests.

## Iteration 1 scope

Snippet suggestions only — no file editing, code execution, git operations, streaming, or persistent history.
