# Dragon

A terminal UI coding agent that accepts natural-language requests and returns syntax-highlighted code snippets. Built with TypeScript and Ink (React for terminals), with pluggable AI providers (Claude and OpenAI).

## Build

```bash
npm install
npm run build
```

## Install globally

```bash
npm run build:install
```

This compiles the project and runs `npm link`, making the `dragon` command available system-wide — run it from any directory.

## Configuration

Copy `.env.example` to `.env` and set the API key for your chosen provider:

```bash
cp .env.example .env
```

| Env var | Values | Default |
|---|---|---|
| `DRAGON_MODEL` | any model ID from `src/models/list.ts` | `claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | string | required for Claude models |
| `OPENAI_API_KEY` | string | required for OpenAI models |

## Run

After installing globally:

```bash
dragon
```

Or without installing:

```bash
npm run dev      # run via tsx directly
npm start        # run compiled output
```
