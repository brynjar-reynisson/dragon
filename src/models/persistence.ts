import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATE_DIR = join(homedir(), '.dragon');
const STATE_FILE = join(STATE_DIR, 'state.json');

export function loadSavedModel(): string | null {
  try {
    const raw = readFileSync(STATE_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'model' in parsed) {
      const { model } = parsed as Record<string, unknown>;
      if (typeof model === 'string') return model;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveModel(id: string): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify({ model: id }));
  } catch {
    // persistence failure must not crash the app
  }
}
