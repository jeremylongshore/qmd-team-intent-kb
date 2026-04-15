import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Result returned after running qmd embed */
interface SyncResult {
  stdout: string;
  stderr: string;
  message: string;
}

/**
 * Run `qmd embed` to rebuild the local vector index.
 *
 * Only registered as a tool when the qmd binary is available (checked at
 * server startup via `isQmdAvailable()`).
 */
export async function runSync(qmdBinary: string = 'qmd'): Promise<SyncResult> {
  try {
    const { stdout, stderr } = await execFileAsync(qmdBinary, ['embed'], {
      timeout: 120_000, // 2 minutes — embedding can be slow
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      message: 'qmd embed completed successfully',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`qmd embed failed: ${msg}`);
  }
}

/**
 * Check if the qmd binary is available on PATH.
 * Used to conditionally register the sync tool at startup.
 */
export async function isQmdAvailable(qmdBinary: string = 'qmd'): Promise<boolean> {
  try {
    await execFileAsync(qmdBinary, ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
