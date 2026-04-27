import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, relative } from 'node:path';
import { rgPath } from '@vscode/ripgrep';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

const MAX_LINES = 500;

interface RgMatchData {
  type: 'match';
  data: {
    path: { text: string };
    line_number: number;
    lines: { text: string };
  };
}

export async function grepInProject(
  pattern: string,
  searchPath = '.',
  glob?: string,
  projectRoot = process.cwd(),
): Promise<string> {
  const absRoot = resolve(projectRoot);
  const absPath = resolve(projectRoot, searchPath);

  if (!absPath.startsWith(absRoot)) {
    return `Error: path "${searchPath}" is outside the project root`;
  }

  const args = ['--json'];
  if (glob) args.push('--glob', glob);
  args.push('--', pattern, absPath);

  try {
    const { stdout } = await execFileAsync(rgPath, args, { cwd: absRoot });
    const matches: string[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      let obj: RgMatchData;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.type !== 'match') continue;
      const rel = relative(absRoot, obj.data.path.text).replace(/\\/g, '/');
      matches.push(`${rel}:${obj.data.line_number}:${obj.data.lines.text.trimEnd()}`);
      if (matches.length >= MAX_LINES) {
        return matches.join('\n') + `\n(truncated at ${MAX_LINES} lines)`;
      }
    }
    return matches.join('\n') || '(no matches)';
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 1) {
      return '(no matches)';
    }
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export const grepFilesTool = tool(
  ({ pattern, path, glob }) => grepInProject(pattern, path ?? '.', glob),
  {
    name: 'grep_files',
    description: 'Search for a regex pattern in project files using ripgrep. Returns matching lines with relative file paths and line numbers. Files excluded by .gitignore are skipped automatically.',
    schema: z.object({
      pattern: z.string().describe('Regex pattern to search for.'),
      path: z.string().optional().describe('Relative path to search in (default: project root).'),
      glob: z.string().optional().describe('Glob pattern to restrict file types, e.g. "*.ts".'),
    }),
  },
);
