# Dragon — LangChain Model Selection: Design Spec

**Date:** 2026-04-21
**Status:** Approved
**Scope:** Replace Provider abstraction with LangChain; add in-TUI model selector via `/model` command.

---

## Overview

Replace the custom `Provider` interface and its `ClaudeProvider`/`OpenAIProvider` implementations with LangChain chat models. The `Agent` owns and manages its LangChain model instance and exposes `setModel(id)` for runtime swapping. A new `/model` command in the input bar lets the user pick a model interactively (arrow-key picker) or by typing a name directly.

---

## Architecture

```
dragon/
├── src/
│   ├── index.tsx                  # Simplified — reads DRAGON_MODEL, no createProvider()
│   ├── models/
│   │   ├── list.ts                # Hardcoded MODELS array
│   │   └── registry.ts            # createModel(id) → BaseChatModel
│   ├── agent/
│   │   └── Agent.ts               # Owns BaseChatModel, exposes setModel(id)
│   └── ui/
│       ├── App.tsx                # Owns selectedModel state, passes to InputBar
│       ├── InputBar.tsx           # Model badge top-right, /model selector
│       └── SnippetView.tsx        # Unchanged
```

`src/providers/` is deleted entirely.

---

## Models

### `src/models/list.ts`

Exports a typed `MODELS` constant — hardcoded for iteration 2, configurable later.

| ID | Provider |
|---|---|
| `claude-sonnet-4-6` | Anthropic |
| `claude-haiku-4-5-20251001` | Anthropic |
| `gpt-4o` | OpenAI |
| `gpt-4o-mini` | OpenAI |

### `src/models/registry.ts`

Exports `createModel(id: string): BaseChatModel`. Switches on model ID, constructs `ChatAnthropic` or `ChatOpenAI` with the API key read from env vars at call time. Throws with a clear message for unknown IDs or missing keys.

---

## Agent

```ts
class Agent {
  private model: BaseChatModel;
  constructor(initialModelId: string) { this.model = createModel(initialModelId); }
  setModel(id: string): void { this.model = createModel(id); }
  async suggest(prompt: string, language?: string): Promise<string>
}
```

`suggest()` builds `[SystemMessage, HumanMessage]` and calls `this.model.invoke([...])`. Returns trimmed text content. API key errors surface at `createModel()` call time — before UI mounts at startup, or immediately on model switch.

---

## Entry Point

`index.tsx` reads `DRAGON_MODEL` env var (default: `claude-sonnet-4-6`) and constructs `new Agent(modelId)`. `DRAGON_PROVIDER` is removed. Missing API key causes `createModel()` to throw before `render()`.

---

## UI

### `App.tsx`

New props: `initialModelId: string` (passed from `index.tsx`). New state: `selectedModel: string` (initialized from `initialModelId`). New handler `handleModelChange(id)` calls `agent.setModel(id)` and `setSelectedModel(id)`; catches any thrown errors and sets the error state so `SnippetView` displays them. Passes `selectedModel` and `onModelChange` to `InputBar`.

### `InputBar.tsx`

**Model badge:** The input row uses `justifyContent="space-between"`. A dim `[model: <id>]` badge is pinned to the right, always visible.

**Modes:**

| Mode | Trigger | Behaviour |
|---|---|---|
| `default` | Initial state | Normal query input |
| `editingLang` | `Ctrl+L` | Language override field |
| `selectingModel` | User types `/model` | Model picker or free-text |

**`/model` flow:**

1. User types `/model` in the query field → input clears, mode switches to `selectingModel`
2. **Picker sub-mode** (default entry): vertical list of models, highlighted entry in cyan, arrow up/down to navigate, `Enter` to confirm, `Esc` to cancel
3. **Free-text sub-mode**: `Space` in picker mode hides the list, shows a focused text field for typing a model name directly; `Enter` confirms, `Esc` returns to picker

**Hints bar while in `selectingModel` mode:**
```
↑↓: navigate  •  Enter: select  •  Space: type name  •  Esc: cancel
```

### `SnippetView.tsx`

Unchanged.

---

## Dependencies Added

```
@langchain/core
@langchain/anthropic
@langchain/openai
```

---

## Configuration

| Env var | Values | Default |
|---|---|---|
| `DRAGON_MODEL` | any model ID from `MODELS` list | `claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | string | required for Claude models |
| `OPENAI_API_KEY` | string | required for OpenAI models |

`DRAGON_PROVIDER` is removed.

---

## Error Handling

- **Unknown model ID:** `createModel()` throws immediately with `Unknown model: <id>`.
- **Missing API key:** `createModel()` throws immediately with a clear message before UI renders (startup) or is shown as a one-line red error in `SnippetView` (runtime model switch).
- **Model switch during loading:** `setModel` is disabled (input is disabled while loading), so no race condition.

---

## Out of Scope

- Streaming responses
- Persistent model preference across sessions
- Dynamic model list from provider APIs
