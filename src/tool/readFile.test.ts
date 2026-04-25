import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileContent } from './readFile.js';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = join(tmpdir(), `dragon-test-${Date.now()}`);
  await mkdir(tmpRoot, { recursive: true });
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('readFileContent', () => {
  it('returns the content of an existing file', async () => {
    await writeFile(join(tmpRoot, 'hello.ts'), 'const x = 1;');
    const result = await readFileContent('hello.ts', tmpRoot);
    expect(result).toBe('const x = 1;');
  });

  it('reads a file in a subdirectory', async () => {
    await mkdir(join(tmpRoot, 'src'));
    await writeFile(join(tmpRoot, 'src', 'app.ts'), 'export const app = true;');
    const result = await readFileContent('src/app.ts', tmpRoot);
    expect(result).toBe('export const app = true;');
  });

  it('returns error for a non-existent file', async () => {
    const result = await readFileContent('missing.ts', tmpRoot);
    expect(result).toMatch(/Error.*cannot read file/);
  });

  it('rejects paths outside the project root', async () => {
    const result = await readFileContent('/etc/passwd', tmpRoot);
    expect(result).toMatch(/Error.*outside the project root/);
  });

  it('rejects path traversal attempts', async () => {
    const result = await readFileContent('../../etc/passwd', tmpRoot);
    expect(result).toMatch(/Error.*outside the project root/);
  });
});
