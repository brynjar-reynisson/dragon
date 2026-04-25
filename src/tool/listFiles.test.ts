import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listFilesInDir } from './listFiles.js';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = join(tmpdir(), `dragon-test-${Date.now()}`);
  await mkdir(tmpRoot, { recursive: true });
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('listFilesInDir', () => {
  it('lists files and directories in a flat directory', async () => {
    await writeFile(join(tmpRoot, 'index.ts'), '');
    await writeFile(join(tmpRoot, 'README.md'), '');
    await mkdir(join(tmpRoot, 'src'));

    const result = await listFilesInDir(tmpRoot, tmpRoot);
    expect(result).toContain('index.ts');
    expect(result).toContain('README.md');
    expect(result).toContain('src/');
  });

  it('lists files recursively into subdirectories', async () => {
    await mkdir(join(tmpRoot, 'src', 'ui'), { recursive: true });
    await writeFile(join(tmpRoot, 'src', 'app.ts'), '');
    await writeFile(join(tmpRoot, 'src', 'ui', 'App.tsx'), '');

    const result = await listFilesInDir(tmpRoot, tmpRoot);
    expect(result).toContain('src/');
    expect(result).toContain('src/app.ts');
    expect(result).toContain('src/ui/');
    expect(result).toContain('src/ui/App.tsx');
  });

  it('returns (empty) when directory has no visible entries', async () => {
    const result = await listFilesInDir(tmpRoot, tmpRoot);
    expect(result).toBe('(empty)');
  });

  it('filters out files listed in .gitignore', async () => {
    await writeFile(join(tmpRoot, '.gitignore'), 'node_modules\n*.log\n');
    await mkdir(join(tmpRoot, 'node_modules'));
    await writeFile(join(tmpRoot, 'error.log'), '');
    await writeFile(join(tmpRoot, 'index.ts'), '');

    const result = await listFilesInDir(tmpRoot, tmpRoot);
    expect(result).not.toContain('node_modules');
    expect(result).not.toContain('error.log');
    expect(result).toContain('index.ts');
  });

  it('filters gitignore patterns recursively', async () => {
    await writeFile(join(tmpRoot, '.gitignore'), '*.log\n');
    await mkdir(join(tmpRoot, 'logs'));
    await writeFile(join(tmpRoot, 'logs', 'debug.log'), '');
    await writeFile(join(tmpRoot, 'logs', 'info.txt'), '');

    const result = await listFilesInDir(tmpRoot, tmpRoot);
    expect(result).not.toContain('debug.log');
    expect(result).toContain('info.txt');
  });

  it('rejects paths outside the project root', async () => {
    const result = await listFilesInDir('/etc', tmpRoot);
    expect(result).toMatch(/Error.*outside the project root/);
  });

  it('returns error message for non-existent directory', async () => {
    const result = await listFilesInDir(join(tmpRoot, 'does-not-exist'), tmpRoot);
    expect(result).toMatch(/Error.*cannot read directory/);
  });

  it('works with no .gitignore present', async () => {
    await writeFile(join(tmpRoot, 'main.ts'), '');

    const result = await listFilesInDir(tmpRoot, tmpRoot);
    expect(result).toContain('main.ts');
  });

  it('truncates output when entry count reaches the limit', async () => {
    for (let i = 0; i < 15; i++) {
      await writeFile(join(tmpRoot, `file${i}.ts`), '');
    }

    const result = await listFilesInDir(tmpRoot, tmpRoot, 10);
    const lines = result.split('\n');
    expect(lines.at(-1)).toMatch(/truncated at 10 entries/);
    expect(lines.length).toBe(11); // 10 entries + truncation notice
  });

  it('does not truncate when entry count is below the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await writeFile(join(tmpRoot, `file${i}.ts`), '');
    }

    const result = await listFilesInDir(tmpRoot, tmpRoot, 10);
    expect(result).not.toContain('truncated');
  });

  it('counts directory entries toward the limit', async () => {
    for (let i = 0; i < 8; i++) {
      await mkdir(join(tmpRoot, `dir${i}`));
    }
    await writeFile(join(tmpRoot, 'file1.ts'), '');
    await writeFile(join(tmpRoot, 'file2.ts'), '');
    await writeFile(join(tmpRoot, 'file3.ts'), ''); // should not appear

    const result = await listFilesInDir(tmpRoot, tmpRoot, 10);
    expect(result).toContain('truncated at 10 entries');
  });
});
