#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
import { App } from './ui/App.js';
import { Agent } from './agent/Agent.js';
import { DEFAULT_MODEL_ID } from './models/list.js';
import { availableModels, unavailableProviderMessages } from './models/availability.js';
import { loadSavedModel } from './models/persistence.js';

const savedModelId = loadSavedModel();
const envModelId = process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID;
const available = availableModels();

let startupModelId: string;
if (savedModelId !== null && available.some(m => m.id === savedModelId)) {
  startupModelId = savedModelId;
} else if (available.some(m => m.id === envModelId)) {
  startupModelId = envModelId;
} else if (available.length > 0) {
  startupModelId = available[0].id;
} else {
  const msgs = unavailableProviderMessages();
  process.stderr.write(`No models available. Provide at least one API key:\n${msgs.join('\n')}\n`);
  process.exit(1);
}

let agent: Agent;
try {
  agent = new Agent(startupModelId);
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

render(<App agent={agent} initialModelId={startupModelId} savedModelId={savedModelId} />);
