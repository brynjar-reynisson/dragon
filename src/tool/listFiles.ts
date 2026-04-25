import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ignore from 'ignore';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const DEFAULT_FILE_LIMIT = 5000;

async function buildIgnore(projectRoot: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore();
  const gitignorePath = join(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = await readFile(gitignorePath, 'utf-8');
    ig.add(content);
  }
  return ig;
}

async function collectFiles(
  absDir: string,
  absRoot: string,
  ig: ReturnType<typeof ignore>,
  lines: string[],
  limit: number,
): Promise<boolean> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (lines.length >= limit) return true;
    const absPath = join(absDir, entry.name);
    const relPath = relative(absRoot, absPath).replace(/\\/g, '/');
    if (ig.ignores(relPath)) continue;
    if (entry.isDirectory()) {
      lines.push(`${relPath}/`);
      if (lines.length >= limit) return true;
      const truncated = await collectFiles(absPath, absRoot, ig, lines, limit);
      if (truncated) return true;
    } else {
      lines.push(relPath);
    }
  }
  return false;
}

export async function listFilesInDir(
  dir: string,
  projectRoot = process.cwd(),
  limit = DEFAULT_FILE_LIMIT,
): Promise<string> {
  const absRoot = resolve(projectRoot);
  const absDir = resolve(dir);

  if (!absDir.startsWith(absRoot)) {
    return `Error: path "${dir}" is outside the project root`;
  }

  const ig = await buildIgnore(absRoot);

  if (!(await readdir(absDir).catch(() => null))) {
    return `Error: cannot read directory "${dir}"`;
  }

  const lines: string[] = [];
  const truncated = await collectFiles(absDir, absRoot, ig, lines, limit);

  if (lines.length === 0) return '(empty)';
  const output = lines.join('\n');
  return truncated ? `${output}\n(truncated at ${limit} entries)` : output;
}

export const listFilesTool = tool(
  ({ path }) => listFilesInDir(path),
  {
    name: 'list_files',
    description: 'Recursively list all files and directories within the project. Returns relative paths from the project root, one per line; directories are suffixed with /. Files excluded by .gitignore are hidden. Output is truncated at 5000 entries.',
    schema: z.object({
      path: z.string().describe('Relative or absolute path to start listing from. Use "." for the project root.'),
    }),
  },
);
