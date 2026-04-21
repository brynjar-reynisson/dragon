#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
import { App } from './ui/App.js';
import { Agent } from './agent/Agent.js';
import { ClaudeProvider } from './providers/claude.js';
import { OpenAIProvider } from './providers/openai.js';
import type { Provider } from './providers/types.js';

function createProvider(): Provider {
  const name = (process.env['DRAGON_PROVIDER'] ?? 'claude').toLowerCase();

  if (name !== 'claude' && name !== 'openai') {
    process.stderr.write(`Error: Unknown provider "${name}". Valid values: claude, openai.\n`);
    process.exit(1);
  }

  if (name === 'openai') {
    const key = process.env['OPENAI_API_KEY'];
    if (!key) {
      process.stderr.write('Error: OPENAI_API_KEY is required for the OpenAI provider.\n');
      process.exit(1);
    }
    return new OpenAIProvider(key);
  }

  const key = process.env['ANTHROPIC_API_KEY'];
  if (!key) {
    process.stderr.write('Error: ANTHROPIC_API_KEY is required for the Claude provider.\n');
    process.exit(1);
  }
  return new ClaudeProvider(key);
}

const agent = new Agent(createProvider());
render(<App agent={agent} />);
