import { readFile as fsReadFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export async function readFileContent(filePath: string, projectRoot = process.cwd()): Promise<string> {
  const absRoot = resolve(projectRoot);
  const absPath = resolve(projectRoot, filePath);

  if (!absPath.startsWith(absRoot)) {
    return `Error: path "${filePath}" is outside the project root`;
  }

  try {
    return await fsReadFile(absPath, 'utf-8');
  } catch {
    return `Error: cannot read file "${filePath}"`;
  }
}

export const readFileTool = tool(
  ({ path }) => readFileContent(path),
  {
    name: 'read_file',
    description: 'Read the full content of a file within the project. Use this to understand what a file does before describing the project.',
    schema: z.object({
      path: z.string().describe('Relative path to the file from the project root.'),
    }),
  },
);
