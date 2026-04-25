import { exec } from 'node:child_process';
import { platform } from 'node:os';

export type ShellType = 'platform' | 'powershell';

export function executeCommand(command: string, shell: ShellType): Promise<string> {
  const shellOpt = shell === 'powershell'
    ? (platform() === 'win32' ? 'powershell.exe' : 'pwsh')
    : true;

  return new Promise(resolve => {
    exec(command, { shell: shellOpt }, (_error, stdout, stderr) => {
      const out = [stdout, stderr].map(s => s.trim()).filter(Boolean).join('\n');
      resolve(out || (_error ? _error.message : '(no output)'));
    });
  });
}
