import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { grepInProject } from './grepFiles.js';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = join(tmpdir(), `dragon-grep-test-${Date.now()}`);
  await mkdir(tmpRoot, { recursive: true });
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('grepInProject', () => {
  it('finds a pattern in a file and returns relative path with line number', async () => {
    await writeFile(join(tmpRoot, 'app.ts'), 'const x = 1;\nconst y = 2;\n');
    const result = await grepInProject('const y', '.', undefined, tmpRoot);
    expect(result).toContain('app.ts:2:');
    expect(result).toContain('const y');
  });

  it('returns (no matches) when pattern is not found', async () => {
    await writeFile(join(tmpRoot, 'app.ts'), 'const x = 1;\n');
    const result = await grepInProject('notfound', '.', undefined, tmpRoot);
    expect(result).toBe('(no matches)');
  });

  it('searches recursively into subdirectories', async () => {
    await mkdir(join(tmpRoot, 'src'));
    await writeFile(join(tmpRoot, 'src', 'util.ts'), 'export function helper() {}\n');
    const result = await grepInProject('helper', '.', undefined, tmpRoot);
    expect(result).toContain('src/util.ts:1:');
  });

  it('filters by glob pattern', async () => {
    await writeFile(join(tmpRoot, 'app.ts'), 'const x = 1;\n');
    await writeFile(join(tmpRoot, 'README.md'), 'const x = placeholder\n');
    const result = await grepInProject('const x', '.', '*.ts', tmpRoot);
    expect(result).toContain('app.ts');
    expect(result).not.toContain('README.md');
  });

  it('rejects paths outside the project root', async () => {
    const result = await grepInProject('pattern', '/etc', undefined, tmpRoot);
    expect(result).toMatch(/Error.*outside the project root/);
  });

  it('truncates output at MAX_LINES', async () => {
    const lines = Array.from({ length: 600 }, (_, i) => `match line ${i}`).join('\n');
    await writeFile(join(tmpRoot, 'big.ts'), lines);
    const result = await grepInProject('match line', '.', undefined, tmpRoot);
    expect(result).toContain('truncated at 500 lines');
  });
});
