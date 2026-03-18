import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { QmdExecutor } from './executor.js';
import type { CommandResult } from '../types.js';
import { DEFAULT_QMD_BINARY, DEFAULT_TIMEOUT } from '../config.js';

const execFileAsync = promisify(execFile);

/** Real qmd CLI executor using child_process */
export class RealQmdExecutor implements QmdExecutor {
  private readonly binary: string;
  private readonly timeout: number;
  private readonly dataDir: string | null;

  constructor(options?: { binary?: string; timeout?: number; dataDir?: string }) {
    this.binary = options?.binary ?? DEFAULT_QMD_BINARY;
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    this.dataDir = options?.dataDir ?? null;
  }

  async execute(args: string[]): Promise<CommandResult> {
    const fullArgs = this.dataDir ? ['--data-dir', this.dataDir, ...args] : args;

    try {
      const { stdout, stderr } = await execFileAsync(this.binary, fullArgs, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'stdout' in e && 'stderr' in e && 'code' in e) {
        const err = e as { stdout: string; stderr: string; code: number | string };
        return {
          stdout: err.stdout ?? '',
          stderr: err.stderr ?? '',
          exitCode: typeof err.code === 'number' ? err.code : 1,
        };
      }
      return { stdout: '', stderr: String(e), exitCode: 1 };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.execute(['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}
