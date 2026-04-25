import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exec } from 'node:child_process';
import { executeCommand } from './execution.js';

vi.mock('node:child_process', () => ({ exec: vi.fn() }));

function mockExec(stdout: string, stderr: string, error: Error | null = null) {
  vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
    cb(error, stdout, stderr);
    return {} as any;
  });
}

describe('executeCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns stdout when command succeeds', async () => {
    mockExec('hello\n', '');
    expect(await executeCommand('echo hello', 'platform')).toBe('hello');
  });

  it('returns stderr when command writes only to stderr', async () => {
    mockExec('', 'some error\n');
    expect(await executeCommand('bad', 'platform')).toBe('some error');
  });

  it('joins stdout and stderr when both are present', async () => {
    mockExec('out\n', 'err\n');
    const result = await executeCommand('cmd', 'platform');
    expect(result).toContain('out');
    expect(result).toContain('err');
  });

  it('returns error message when command fails with no output', async () => {
    mockExec('', '', new Error('spawn failed'));
    expect(await executeCommand('bad', 'platform')).toBe('spawn failed');
  });

  it('returns (no output) when command produces nothing', async () => {
    mockExec('', '');
    expect(await executeCommand('noop', 'platform')).toBe('(no output)');
  });

  it('passes no shell option for platform shell (uses system default)', async () => {
    mockExec('ok', '');
    await executeCommand('echo ok', 'platform');
    const opts = vi.mocked(exec).mock.calls[0][1] as any;
    expect(opts.shell).toBeUndefined();
  });

  it('passes powershell.exe or pwsh for powershell shell', async () => {
    mockExec('ok', '');
    await executeCommand('Write-Output ok', 'powershell');
    const opts = vi.mocked(exec).mock.calls[0][1] as any;
    expect(['powershell.exe', 'pwsh']).toContain(opts.shell);
  });
});
