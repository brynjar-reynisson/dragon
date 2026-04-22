# Dragon — Google Models & Provider Availability: Design Spec

**Date:** 2026-04-22
**Status:** Approved
**Scope:** Add Google Gemini models; filter unavailable providers from the model picker; show dim notices for missing API keys.

---

## Overview

Two concerns are addressed together because they are coupled: adding Google requires a new API key, and the app should handle missing API keys gracefully instead of crashing. When a provider's key is absent, its models are excluded from the picker and a dim one-line notice explains why.

---

## Architecture

```
dragon/
├── src/
│   ├── models/
│   │   ├── list.ts          # Add 'google' to ModelProvider; add gemini-2.5-pro, gemini-2.5-flash
│   │   ├── registry.ts      # Add 'google' branch using ChatGoogleGenerativeAI
│   │   ├── availability.ts  # NEW — availableModels() / unavailableProviderMessages()
│   │   └── availability.test.ts  # NEW
│   ├── index.tsx            # Use availableModels() for startup model resolution
│   └── ui/
│       ├── App.tsx          # Use availableModels() as initial models state; pass notices to InputBar
│       ├── App.test.tsx     # Update mocks; add availability mock
│       ├── InputBar.tsx     # Accept unavailableNotices prop; render below model list
│       └── InputBar.test.tsx  # Add notice rendering tests
```

---

## `src/models/list.ts`

Add `'google'` to `ModelProvider`:

```typescript
export type ModelProvider = 'anthropic' | 'openai' | 'ollama' | 'google';
```

Add two entries to `MODELS`:

```typescript
{ id: 'gemini-2.5-pro', provider: 'google' },
{ id: 'gemini-2.5-flash', provider: 'google' },
```

---

## `src/models/registry.ts`

Add a `'google'` branch:

```typescript
if (info.provider === 'google') {
  const apiKey = process.env['GOOGLE_API_KEY'];
  if (!apiKey) throw new Error('GOOGLE_API_KEY is required for Google models.');
  return new ChatGoogleGenerativeAI({ model: info.id, apiKey });
}
```

Import: `ChatGoogleGenerativeAI` from `@langchain/google-genai`.

The throw is an internal safety net — not reachable through the normal UI flow because the availability filter ensures Google models are never shown when the key is absent.

---

## `src/models/availability.ts` (new)

Two synchronous exports:

```typescript
export function availableModels(): ModelInfo[]
export function unavailableProviderMessages(): string[]
```

### `availableModels()`

Filters `MODELS` to providers that are usable. A provider is considered available if:
- Its `provider` is `'ollama'` (no key required), or
- Its required env var is a non-empty string

Required env vars per provider:
| Provider | Env var |
|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_API_KEY` |

### `unavailableProviderMessages()`

Returns one string per unavailable cloud provider (in a stable order). Message format:

```
"Google models are not available without GOOGLE_API_KEY"
"Anthropic models are not available without ANTHROPIC_API_KEY"
"OpenAI models are not available without OPENAI_API_KEY"
```

Provider display names: `anthropic` → `"Anthropic"`, `openai` → `"OpenAI"`, `google` → `"Google"`.

Returns `[]` if all cloud providers have keys.

---

## `src/index.tsx`

Replace the `MODELS.some(...)` check with `availableModels().some(...)` so a saved model from a provider without a key is not used as the startup model.

Startup fallback chain when `startupModelId` is unavailable:
1. `savedModelId` if it is in `availableModels()` → use it
2. `process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID` if it is in `availableModels()` → use it
3. First model in `availableModels()` → use it
4. If `availableModels()` is empty → `process.stderr.write` listing which keys are needed, then `process.exit(1)`

The `Agent` constructor is only ever called with a model from `availableModels()`, so `createModel` will not throw for a missing key at startup.

---

## `src/ui/App.tsx`

### Initial models state

Replace `useState<ModelInfo[]>(MODELS)` with `useState<ModelInfo[]>(availableModels())`.

Import `availableModels` and `unavailableProviderMessages` from `../models/availability.js`.

### Notices passed to InputBar

```tsx
<InputBar
  ...
  unavailableNotices={unavailableProviderMessages()}
/>
```

`unavailableProviderMessages()` is called inline (pure, no state needed). The notices are static for the lifetime of the process — provider availability is determined by env vars at startup.

### Ollama useEffect

The merged list computation changes from `[...MODELS, ...ollamaModels]` to `[...availableModels(), ...ollamaModels]` so Ollama models are appended to the already-filtered list.

---

## `src/ui/InputBar.tsx`

### New prop

```typescript
unavailableNotices: string[]
```

### Rendering

In the `selectingModel` + `picker` branch, after the model list, render each notice as a dim line:

```tsx
{unavailableNotices.map(msg => (
  <Text key={msg} dimColor>{msg}</Text>
))}
```

---

## Error Handling

- `availableModels()` and `unavailableProviderMessages()` read only `process.env` and the static `MODELS` array — no I/O, no error paths.
- `registry.ts` retains its throws as an internal safety net; these are unreachable through normal UI flow.
- If all providers are unavailable at startup, the app exits with a clear message listing the required env vars.

---

## Testing

### `src/models/availability.test.ts`

Mock `process.env` per test. Cover:
- All keys present → `availableModels()` returns all non-Ollama models; `unavailableProviderMessages()` returns `[]`
- One key missing (e.g. `GOOGLE_API_KEY`) → Google models excluded; one message returned
- All cloud keys missing → only Ollama models returned (empty if none in MODELS); three messages returned
- Empty string key treated as missing (same as absent)

### `src/models/registry.test.ts`

Add two tests for the Google provider:
- Creates `ChatGoogleGenerativeAI` when `GOOGLE_API_KEY` is set
- Throws when `GOOGLE_API_KEY` is missing

### `src/ui/InputBar.test.tsx`

Add tests:
- Notices rendered as dim text below model list when picker is open
- No notice text rendered when `unavailableNotices` is empty

### `src/ui/App.test.tsx`

- Mock `../models/availability.js` (both exports)
- Update all renders to pass through the availability mock
- Existing tests pass `availableModels` returning the same models as before (no behaviour change when all keys present)

---

## Package

Add `@langchain/google-genai` to `dependencies` in `package.json`.

---

## `.env.example` + `CLAUDE.md`

`.env.example`: Add `GOOGLE_API_KEY=` with comment "Required when using a Google model".

`CLAUDE.md`:
- Add `google` to `ModelProvider` in the model layer description
- Add `availability.ts` to the model layer section: `availableModels()` / `unavailableProviderMessages()`; filters MODELS by present env keys
- Add `GOOGLE_API_KEY` row to the env var table
- Update `registry.ts` description to mention `ChatGoogleGenerativeAI`
- Update `App.tsx` description to note `availableModels()` as initial state and `unavailableNotices` passed to InputBar
- Update `InputBar.tsx` description to mention `unavailableNotices` prop

---

## Out of Scope

- Runtime key detection (notices are set at startup from env vars, not polled)
- Per-model key configuration
- Vertex AI / service account authentication
