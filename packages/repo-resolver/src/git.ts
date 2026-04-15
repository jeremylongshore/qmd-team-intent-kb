import { spawn } from 'node:child_process';

export interface GitInvocation {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run `git` with the given args inside `cwd`. Never rejects — git errors are
 * surfaced via exit code and stderr so callers can classify them.
 *
 * Callers must set `cwd` explicitly; this helper does not change the process
 * cwd, so concurrent resolutions are safe.
 */
export function runGit(cwd: string, args: string[]): Promise<GitInvocation> {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (e) => {
      resolve({ stdout: '', stderr: e.message, exitCode: -1 });
    });
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}
