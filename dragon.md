# Dragon — Terminal UI Coding Agent

**Dragon** is a terminal-based coding assistant that accepts natural-language requests and returns syntax-highlighted code snippets. It is built with **TypeScript** and **Ink** (React for terminals), and supports multiple AI backends through LangChain.

---

## Purpose

- Accept plain-English coding requests in a terminal UI
- Return raw, copy-paste-ready code snippets with syntax highlighting
- Support model selection and switching at runtime (including local Ollama models)
- Execute shell commands directly (prefix `!` for system shell, `!!` for PowerShell)
- Optionally explore the project file tree before generating output (via tools)

Scope is **snippet suggestions only** — no file editing, code execution of generated code, git operations, streaming, or persistent conversation history.

---

## Directory Structure

```
dragon/
├── .claude/                  # Claude Code configuration
├── .env.example              # Environment variable template
├── .gitignore
├── .superpowers/             # Superpowers IDE integration state
├── CLAUDE.md                 # Claude Code guidance file
├── LICENSE
├── README.md
├── dragon.md                 # Auto-generated project description (from /init)
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── dist/                     # Compiled output (tsc)
├── docs/superpowers/
│   ├── plans/                # Feature planning documents
│   └── specs/                # Design specification documents
├── src/
│   ├── index.tsx             # Entry point — env setup, model resolution, render
│   ├── execution.ts          # Shell command execution (! and !! prefixes)
│   ├── test-setup.ts         # Test helper wrapping Ink render in React act()
│   ├── agent/
│   │   ├── Agent.ts          # Core agent: model management, suggest(), init(), tool loop
│   │   └── Agent.test.ts
│   ├── models/
│   │   ├── list.ts           # Static model catalog (MODELS array + DEFAULT_MODEL_ID)
│   │   ├── registry.ts       # Factory: creates BaseChatModel per provider
│   │   ├── ollama.ts         # Fetch local Ollama models from localhost:11434
│   │   ├── persistence.ts    # Save/load selected model to ~/.dragon/state.json
│   │   ├── availability.ts   # Filter models by available API keys
│   │   └── *.test.ts
│   ├── tool/
│   │   ├── listFiles.ts      # Recursive directory listing (respects .gitignore)
│   │   ├── readFile.ts       # Read file contents (sandboxed to project root)
│   │   └── *.test.ts
│   └── ui/
│       ├── App.tsx           # Root Ink component — state, effects, submit logic
│       ├── InputBar.tsx      # Query input, model selector (picker + freetext)
│       ├── SnippetView.tsx   # Renders output: spinner, highlight, errors, history
│       └── *.test.tsx
```

---

## Key Files

| File | Role |
|---|---|
| `src/index.tsx` | Entry point. Loads `.env`, resolves startup model (saved > env > first available), creates `Agent`, renders `<App>`. |
| `src/agent/Agent.ts` | Core logic. Wraps a LangChain `BaseChatModel`, exposes `suggest()` (coding assistance) and `init()` (project analysis). Implements a multi-turn tool-use loop with special handling for thinking/reasoning models (DeepSeek). |
| `src/models/list.ts` | Static catalog of 7 known models across 5 providers (Anthropic, OpenAI, Google, DeepSeek, Ollama). |
| `src/models/registry.ts` | Factory function `createModel()` that instantiates the correct LangChain chat model class based on provider and API key. |
| `src/models/ollama.ts` | `fetchOllamaModels()` — queries `localhost:11434/api/tags`, deduplicates by model family, returns `ModelInfo[]`. Swallows all errors. |
| `src/models/persistence.ts` | Persists the last-used model ID to `~/.dragon/state.json`. Failures are silently ignored. |
| `src/models/availability.ts` | Filters the model list to only those whose provider API key is set in the environment. |
| `src/ui/App.tsx` | Root UI component. Owns all application state: query history, current snippet, loading/error, selected model, tool call logs. Orchestrates model resolution, submission, and model switching. |
| `src/ui/InputBar.tsx` | Dual-mode input: normal query entry and model selection (arrow-key picker or free-text entry). Renders the model badge and hints bar. |
| `src/ui/SnippetView.tsx` | Renders output with `cli-highlight` syntax highlighting, a spinner during loading, elapsed time, tool call trace lines, and error display. |
| `src/execution.ts` | Executes shell commands with `child_process.exec()`. Supports platform shell and PowerShell. |
| `src/tool/listFiles.ts` | LangChain tool — recursively lists project files, respecting `.gitignore`, truncated at 5000 entries. |
| `src/tool/readFile.ts` | LangChain tool — reads a file within the project root (path traversal is blocked). |

---

## Architecture

### Technology Stack

- **Runtime**: Node.js (ES2022 modules)
- **Language**: TypeScript (strict mode)
- **UI Framework**: Ink 5 (React renderer for terminals)
- **AI Layer**: LangChain (`@langchain/core` + provider-specific packages)
- **Syntax Highlighting**: `cli-highlight`
- **Testing**: Vitest + `ink-testing-library`

### Provider Model

```
┌──────────────────────────────────────────┐
│                  Agent                    │
│  suggest() / init()  +  tool-use loop    │
└─────────────────┬────────────────────────┘
                  │
     ┌────────────▼────────────┐
     │    model registry       │
     │    createModel(info)    │
     └────────┬───┬───┬───┬───┘
              │   │   │   │
    ┌─────────┘   │   │   └─────────┐
    ▼             ▼   ▼             ▼
ChatAnthropic  ChatOpenAI  ...  ChatDeepSeek
(ChatOllama, ChatGoogleGenerativeAI)
```

Each provider requires its own API key environment variable. Ollama is the exception — it connects to a local instance with no key required.

### Data Flow (Snippet Generation)

```
InputBar (query + Enter)
  → App.handleSubmit(query)
    → Agent.suggest(query, onToolCall)
      → LangChain model.invoke() with system prompt + tools
      → [optional tool calls: list_files / read_file]
      → raw code snippet string
    → SnippetView renders with cli-highlight
```

### Data Flow (Shell Execution)

```
InputBar ("!ls" or "!!Get-Process")
  → App.handleSubmit(query)
    → executeCommand(cmd, 'platform' | 'powershell')
      → child_process.exec()
    → SnippetView renders raw output (no highlighting)
```

### Model Selection Flow

```
User types "/model" → InputBar enters selectingModel mode
  ├─ Picker mode: ↑↓ navigate, Enter select, Space → freetext
  └─ Freetext mode: type arbitrary model name → Enter confirm
→ App.handleModelChange(id)
  → Agent.setModel(info)
  → saveModel(id) → ~/.dragon/state.json
```

### Tool-Use Design

The agent has two LangChain tools (`list_files` and `read_file`) that allow it to explore the project directory before answering. The tool loop in `Agent.invokeWithTools()` handles multi-turn conversations:

- **Standard models**: accumulate `SystemMessage` → `HumanMessage` → `AIMessage` (with `tool_calls`) → `ToolMessage` turns.
- **Thinking/reasoning models** (DeepSeek): LangChain drops `reasoning_content` on subsequent turns, causing API errors. The agent works around this by never passing the `AIMessage` back — instead accumulating tool results as text and rebuilding the conversation from scratch each turn.

### Startup Model Resolution

```
savedModelId (from ~/.dragon/state.json)
  ↓ fallback
DRAGON_MODEL env var (or DEFAULT_MODEL_ID)
  ↓ fallback
first available model (by provider key presence)
  ↓ fallback
exit with error + missing-key messages
```

Ollama models are fetched asynchronously after mount and merged into the available list. If the saved model is an Ollama model that is no longer present, a dim notice is shown but the app continues with the startup model.

### Key Bindings

| Key | Context | Action |
|---|---|---|
| `Enter` | Default | Submit query |
| `Enter` | Model picker | Select highlighted model |
| `Enter` | Freetext model | Confirm typed model name |
| `/model` | Default (typed in input) | Open model selector |
| `↑` / `↓` | Model picker | Navigate model list |
| `Space` | Model picker | Switch to free-text entry |
| `Esc` | Model selection | Cancel, return to default |
| `Ctrl+C` | Any | Exit application |
| `!cmd` | Default query | Execute in platform shell |
| `!!cmd` | Default query | Execute in PowerShell |

### Special Commands

| Input | Behavior |
|---|---|
| `/model` | Opens the model selector UI |
| `/init` | Generates a project description markdown file (`dragon.md`) using agent tools |
| `!command` | Runs `command` in the platform shell (cmd.exe on Windows, bash otherwise) |
| `!!command` | Runs `command` in PowerShell (`powershell.exe` / `pwsh`) |