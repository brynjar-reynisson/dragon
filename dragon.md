# Dragon Coding Agent TUI

A terminal-based AI coding agent that lets you interact with various LLMs (local Ollama, Google models) through a reactive TUI built with React and Ink. The project supports dynamic model registration, persistence, and pluggable tools for file system operations and reasoning tasks.

## Purpose

Provide a fast, offline-capable coding agent that runs entirely in the terminal. It enables developers to query and execute code-related tasks, switch between multiple LLM providers, and persist their model preferences—all without leaving the command line.

## Directory Structure

```
.claude/                     # Claude-specific configuration
.superpowers/                # Brainstorming tool state (local dev tool)
dist/                        # Compiled output
docs/superpowers/            # Feature plans and design specs
  plans/                     # Markdown plans for individual features
  specs/                     # Detailed design documents
src/
  agent/                     # Core agent loop (Agent.ts)
  models/                    # Model providers, registry, persistence
  tool/                      # Pluggable tool implementations
  ui/                        # Terminal UI components (App, InputBar, SnippetView)
  index.tsx                  # Application entry point
  execution.ts               # Tool execution pipeline
  test-setup.ts              # Test environment configuration
.gitignore
.env.example
CLAUDE.md                    # Project context for AI assistants
package.json
tsconfig.json
vitest.config.ts
```

## Key Files

- **`src/index.tsx`** – renders the TUI and initializes the agent
- **`src/agent/Agent.ts`** – main agent logic, orchestrating tool calls and LLM interactions
- **`src/execution.ts`** – executes tools safely and returns results to the agent
- **`src/models/registry.ts`** – manages available model providers (Ollama, Google, etc.)
- **`src/models/persistence.ts`** – saves/restores selected models across sessions
- **`src/models/ollama.ts`** – Ollama integration, dynamic model listing
- **`src/models/availability.ts`** – checks provider reachability
- **`src/tool/listFiles.ts`** – example tool for listing directory contents
- **`src/ui/App.tsx`** – top-level TUI layout
- **`src/ui/InputBar.tsx`** – user input component
- **`src/ui/SnippetView.tsx`** – displays code or output
- **`vitest.config.ts`** – test runner configuration

## Architecture

The application follows a layered architecture:

1. **TUI Layer (`src/ui/`)**  
   React components rendered via Ink in the terminal. Handles user input and displays agent responses and tool output.

2. **Agent Core (`src/agent/`) and Execution (`src/execution.ts`)**  
   The agent processes user requests, decides which tools to invoke, and formats prompts for the selected LLM. The execution module runs tools in a controlled environment and returns results.

3. **Model Abstraction (`src/models/`)**  
   A registry pattern manages model providers. Each provider (Ollama, Google) implements a common interface for listing available models and interacting with them. Persistence ensures the last used model is retained.

4. **Tool System (`src/tool/`)**  
   Tools are self-contained modules with a defined interface. They can perform filesystem operations, run shell commands, or execute custom logic. New tools are added by creating a module in `src/tool/`.

Data flow: User input → Agent → Tool selection → Execution → LLM call (via LangChain) → Response → UI update. Model selection and provider state are decoupled from the agent, allowing runtime switching without restart.

Testing is done with Vitest, covering unit tests for models, tools, and UI components using React Testing Library (Ink-compatible).