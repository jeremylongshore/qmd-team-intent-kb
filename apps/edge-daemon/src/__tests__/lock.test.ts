import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { unlinkSync } from 'node:fs';
import { acquireLock, releaseLock, isLocked } from '../lock.js';

function tmpPidPath(): string {
  return join(tmpdir(), `daemon-lock-test-${randomUUID()}.pid`);
}

describe('acquireLock', () => {
  const pidPaths: string[] = [];

  afterEach(() => {
    for (const p of pidPaths) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
    pidPaths.length = 0;
  });

  it('creates PID file with current process PID', () => {
    const pidPath = tmpPidPath();
    pidPaths.push(pidPath);
    const acquired = acquireLock(pidPath);
    expect(acquired).toBe(true);
    expect(existsSync(pidPath)).toBe(true);
    expect(readFileSync(pidPath, 'utf8')).toBe(String(process.pid));
  });

  it('returns false when PID file held by a live process', () => {
    const pidPath = tmpPidPath();
    pidPaths.push(pidPath);
    // Write current PID (which is alive)
    writeFileSync(pidPath, String(process.pid), 'utf8');
    const acquired = acquireLock(pidPath);
    expect(acquired).toBe(false);
  });

  it('removes stale PID file and acquires lock', () => {
    const pidPath = tmpPidPath();
    pidPaths.push(pidPath);
    // Write a PID that almost certainly doesn't exist
    writeFileSync(pidPath, '999999999', 'utf8');
    const acquired = acquireLock(pidPath);
    expect(acquired).toBe(true);
    expect(readFileSync(pidPath, 'utf8')).toBe(String(process.pid));
  });

  it('handles invalid PID file content gracefully', () => {
    const pidPath = tmpPidPath();
    pidPaths.push(pidPath);
    writeFileSync(pidPath, 'not-a-number', 'utf8');
    const acquired = acquireLock(pidPath);
    expect(acquired).toBe(true);
  });

  it('creates parent directories if needed', () => {
    const nestedDir = join(tmpdir(), `daemon-lock-nested-${randomUUID()}`);
    const pidPath = join(nestedDir, 'daemon.pid');
    pidPaths.push(pidPath);
    const acquired = acquireLock(pidPath);
    expect(acquired).toBe(true);
    expect(existsSync(pidPath)).toBe(true);
  });
});

describe('releaseLock', () => {
  it('removes PID file owned by current process', () => {
    const pidPath = tmpPidPath();
    writeFileSync(pidPath, String(process.pid), 'utf8');
    releaseLock(pidPath);
    expect(existsSync(pidPath)).toBe(false);
  });

  it('does not remove PID file owned by another process', () => {
    const pidPath = tmpPidPath();
    writeFileSync(pidPath, '999999999', 'utf8');
    releaseLock(pidPath);
    expect(existsSync(pidPath)).toBe(true);
    unlinkSync(pidPath); // cleanup
  });

  it('is a no-op when PID file does not exist', () => {
    const pidPath = tmpPidPath();
    expect(() => releaseLock(pidPath)).not.toThrow();
  });
});

describe('isLocked', () => {
  it('returns false when PID file does not exist', () => {
    expect(isLocked(tmpPidPath())).toBe(false);
  });

  it('returns true when PID file contains a live PID', () => {
    const pidPath = tmpPidPath();
    writeFileSync(pidPath, String(process.pid), 'utf8');
    expect(isLocked(pidPath)).toBe(true);
    unlinkSync(pidPath);
  });

  it('returns false when PID file contains a dead PID', () => {
    const pidPath = tmpPidPath();
    writeFileSync(pidPath, '999999999', 'utf8');
    expect(isLocked(pidPath)).toBe(false);
    unlinkSync(pidPath);
  });
});
