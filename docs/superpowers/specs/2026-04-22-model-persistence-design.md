# Dragon — Model Persistence: Design Spec

**Date:** 2026-04-22
**Status:** Approved
**Scope:** Persist the last selected model across sessions; restore it at startup; show a notice if it is no longer available.

---

## Overview

When the user changes model via `/model`, the selection is written to `~/.dragon/state.json`. On next startup, that model is restored. If the saved model is a static cloud model it is used immediately; if it is an Ollama model the app starts with the fallback while Ollama is queried, then silently switches once confirmed available — or shows a one-line notice if not.

---

## Architecture

```
dragon/
├── src/
│   ├── models/
│   │   └── persistence.ts   # NEW — loadSavedModel / saveModel
│   ├── index.tsx            # Read saved model, determine startupModelId, pass savedModelId to App
│   └── ui/
│       └── App.tsx          # New savedModelId prop, notice state, Ollama validation, saveModel on change
```

---

## `src/models/persistence.ts` (new)

Exports two synchronous functions:

```typescript
export function loadSavedModel(): string | null
export function saveModel(id: string): void
```

State file: `path.join(os.homedir(), '.dragon', 'state.json')`
File format: `{ "model": "<id>" }`

`loadSavedModel` reads and parses the file; returns `null` if the file does not exist, cannot be read, or does not contain a string `model` field.

`saveModel` writes the file, creating `~/.dragon/` if it does not exist. Errors are silently swallowed (persistence failure must not crash the app).

---

## `src/index.tsx`

Startup resolution order:

1. `savedModelId = loadSavedModel()` — `null` if no prior save
2. If `savedModelId` is found in the static `MODELS` array → `startupModelId = savedModelId`
3. Otherwise → `startupModelId = process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID`

`Agent` is constructed with `startupModelId` (always a valid static model; error handling unchanged). Both props are passed to `App`:

```tsx
render(<App agent={agent} initialModelId={startupModelId} savedModelId={savedModelId} />);
```

If `savedModelId === startupModelId`, the saved model was already resolved at startup and `App` does no further validation.

---

## `src/ui/App.tsx`

### New prop

```typescript
savedModelId: string | null
```

### New state

```typescript
const [notice, setNotice] = useState<string | null>(null);
```

### Extended Ollama `useEffect`

After merging `ollamaModels` into `models`, if `savedModelId` is non-null and `savedModelId !== selectedModel` (i.e. the saved model was not resolved at startup):

- **Found in merged list** — call `handleModelChange(savedModelId)` silently; no notice set
- **Not found** — `setNotice(`Previously selected model "${savedModelId}" is not available.`)`

### `handleModelChange` additions

After a successful model switch:
- Call `saveModel(id)`
- Call `setNotice(null)`

### Notice rendering

A single dim line rendered between `SnippetView` and `InputBar`:

```tsx
{notice && <Text dimColor>{notice}</Text>}
```

Cleared by: changing model (above), or submitting a query (`handleSubmit` calls `setNotice(null)`).

---

## Error Handling

- `loadSavedModel` returns `null` on any read/parse error — startup proceeds normally with no saved model
- `saveModel` swallows write errors silently — the app must not crash because state could not be persisted
- If the saved cloud model's API key is missing, the existing startup error path in `index.tsx` catches it and exits with a clear message (unchanged behaviour)

---

## Out of Scope

- Saving any other preference (language override, window size, etc.)
- Syncing state across multiple running instances
- Migrating the state file format
