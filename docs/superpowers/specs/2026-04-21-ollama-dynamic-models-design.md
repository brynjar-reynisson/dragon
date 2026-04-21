# Dragon — Ollama Dynamic Model Discovery: Design Spec

**Date:** 2026-04-21
**Status:** Approved
**Scope:** Dynamically fetch locally installed Ollama models and merge them into the TUI model picker, showing only the newest-pulled variant per model family.

---

## Overview

At startup, `App` fetches the list of locally installed Ollama models from the Ollama REST API. Results are deduplicated — one entry per model family (e.g. `llama3.2`), keeping the most recently pulled variant. The merged list (static cloud models first, then Ollama models) is passed down to `InputBar` for display in the `/model` picker. If Ollama is not running the fetch fails silently and only the static models are shown.

---

## Architecture

```
dragon/
├── src/
│   ├── models/
│   │   ├── list.ts        # Add 'ollama' to ModelProvider
│   │   ├── ollama.ts      # NEW — fetchOllamaModels()
│   │   └── registry.ts    # Add ChatOllama branch
│   └── ui/
│       ├── App.tsx        # Add models state + useEffect fetch
│       └── InputBar.tsx   # Accept models prop instead of importing MODELS
```

---

## `src/models/list.ts`

Add `'ollama'` to the `ModelProvider` union:

```typescript
export type ModelProvider = 'anthropic' | 'openai' | 'ollama';
```

`MODELS` and `DEFAULT_MODEL_ID` are unchanged — they contain only the static cloud models.

---

## `src/models/ollama.ts` (new)

Exports a single function:

```typescript
export async function fetchOllamaModels(): Promise<ModelInfo[]>
```

**Steps:**

1. `fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })`
2. Parse JSON — Ollama returns `{ models: Array<{ name: string; modified_at: string }> }`
3. Group entries by base name (the part of `name` before `:`): `"llama3.2:3b"` and `"llama3.2:latest"` both map to key `"llama3.2"`
4. Within each group, keep the entry with the lexicographically largest `modified_at` (ISO 8601 strings sort correctly as strings)
5. Map winners to `{ id: name, provider: 'ollama' }` — the full `name` (e.g. `"llama3.2:latest"`) is used as the model id since that is what `ChatOllama` expects
6. Return the resulting array

Any error (network, timeout, parse) is caught and returns `[]`.

---

## `src/models/registry.ts`

Add `'ollama'` branch using `ChatOllama` from `@langchain/ollama`:

```typescript
if (info.provider === 'ollama') {
  return new ChatOllama({ model: id });
}
```

No API key is required for Ollama.

The error message for unknown model IDs is simplified to `Unknown model: "<id>"` — the previous valid-model list is removed because the full set of valid models is dynamic at runtime.

The exhaustiveness guard (`const _exhaustive: never = info.provider`) is updated to cover all three providers.

---

## `src/ui/App.tsx`

New `models` state initialized from the static `MODELS` array:

```typescript
const [models, setModels] = useState<ModelInfo[]>(MODELS);
```

`useEffect` on mount fetches Ollama models and merges them:

```typescript
useEffect(() => {
  fetchOllamaModels().then(ollamaModels => {
    if (ollamaModels.length > 0) setModels([...MODELS, ...ollamaModels]);
  });
}, []);
```

Ollama models are appended after the static cloud models so picker order is: Claude → GPT → local models.

`models` is passed to `InputBar` as a new required prop.

---

## `src/ui/InputBar.tsx`

Accepts a new required prop `models: ModelInfo[]`. The `/model` picker renders from this prop instead of importing `MODELS` directly. No other InputBar behaviour changes.

---

## Dependencies Added

```
@langchain/ollama
```

---

## Error Handling

- **Ollama not running:** fetch times out after 2 seconds, caught silently, `fetchOllamaModels` returns `[]`, only static models shown.
- **Ollama running but returns malformed JSON:** parse error caught, returns `[]`.
- **Unknown model id at runtime:** `createModel()` throws `Unknown model: "<id>"` — caught by `App.handleModelChange` and displayed as a one-line red error in `SnippetView` (existing behaviour).

---

## Out of Scope

- Periodic refresh of Ollama model list while the TUI is open
- Displaying which models are local vs cloud in the picker
- Pulling new Ollama models from within the TUI
