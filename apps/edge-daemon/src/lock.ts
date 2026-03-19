import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Acquire a PID lock file. Writes the current process PID to the file.
 *
 * @returns true if the lock was acquired, false if another process holds it.
 */
export function acquireLock(pidFilePath: string): boolean {
  if (existsSync(pidFilePath)) {
    const existingPid = readPidFile(pidFilePath);
    if (existingPid !== null && isProcessRunning(existingPid)) {
      return false; // another live process holds the lock
    }
    // Stale PID file — remove it and continue
    unlinkSync(pidFilePath);
  }

  const dir = dirname(pidFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(pidFilePath, String(process.pid), 'utf8');
  return true;
}

/**
 * Release the PID lock file.
 *
 * Only removes the file if it contains the current process PID,
 * preventing accidental removal of another process's lock.
 */
export function releaseLock(pidFilePath: string): void {
  if (!existsSync(pidFilePath)) return;

  const storedPid = readPidFile(pidFilePath);
  if (storedPid === process.pid) {
    unlinkSync(pidFilePath);
  }
}

/**
 * Check whether the lock file exists and is held by a live process.
 */
export function isLocked(pidFilePath: string): boolean {
  if (!existsSync(pidFilePath)) return false;
  const pid = readPidFile(pidFilePath);
  if (pid === null) return false;
  return isProcessRunning(pid);
}

function readPidFile(pidFilePath: string): number | null {
  try {
    const content = readFileSync(pidFilePath, 'utf8').trim();
    const pid = parseInt(content, 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 doesn't kill — just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
