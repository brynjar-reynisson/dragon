import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('os', () => ({ homedir: vi.fn().mockReturnValue('/home/user') }));
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('loadSavedModel', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns the saved model id when state file is valid', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ model: 'llama3.2' }));
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBe('llama3.2');
  });

  it('returns null when the file does not exist', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });

  it('returns null when the model field is missing', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ other: 'value' }));
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });

  it('returns null when the model field is not a string', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ model: 42 }));
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });

  it('returns null when the file contains invalid JSON', async () => {
    const { readFileSync } = await import('fs');
    vi.mocked(readFileSync).mockReturnValue('not json');
    const { loadSavedModel } = await import('./persistence.js');
    expect(loadSavedModel()).toBeNull();
  });
});

describe('saveModel', () => {
  beforeEach(() => { vi.resetModules(); });

  it('writes the model id to the state file', async () => {
    const { writeFileSync, mkdirSync } = await import('fs');
    const { saveModel } = await import('./persistence.js');
    saveModel('llama3.2');
    expect(mkdirSync).toHaveBeenCalled();
    expect(mkdirSync.mock.calls[0][1]).toEqual({ recursive: true });
    expect(writeFileSync).toHaveBeenCalled();
    const writeCall = writeFileSync.mock.calls[0];
    expect(writeCall[1]).toBe(JSON.stringify({ model: 'llama3.2' }));
    expect(writeCall[0]).toMatch(/\.dragon[/\\]state\.json$/);
  });

  it('swallows errors silently', async () => {
    const { writeFileSync } = await import('fs');
    vi.mocked(writeFileSync).mockImplementation(() => { throw new Error('EACCES'); });
    const { saveModel } = await import('./persistence.js');
    expect(() => saveModel('llama3.2')).not.toThrow();
  });
});
