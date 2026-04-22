#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
import { App } from './ui/App.js';
import { Agent } from './agent/Agent.js';
import { DEFAULT_MODEL_ID, MODELS } from './models/list.js';
import { loadSavedModel } from './models/persistence.js';

const savedModelId = loadSavedModel();
const envModelId = process.env['DRAGON_MODEL'] ?? DEFAULT_MODEL_ID;
const startupModelId = (savedModelId !== null && MODELS.some(m => m.id === savedModelId))
  ? savedModelId
  : envModelId;

let agent: Agent;
try {
  agent = new Agent(startupModelId);
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

render(<App agent={agent} initialModelId={startupModelId} savedModelId={savedModelId} />);
