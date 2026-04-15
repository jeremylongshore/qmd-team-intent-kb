import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import type Database from 'better-sqlite3';
import { dispatch } from '../cli.js';
import type { CliDeps } from '../cli.js';
import { makeDeps, makeConfig, RecordingLogger } from './fixtures.js';

function tmpPidPath(): string {
  return join(tmpdir(), `cli-test-${randomUUID()}.pid`);
}

describe('dispatch', () => {
  let db: Database.Database;
  let deps: CliDeps;
  let pidPath: string;
  let logger: RecordingLogger;

  const stderrWrites: string[] = [];
  const stdoutWrites: string[] = [];

  beforeEach(() => {
    db = createTestDatabase();
    pidPath = tmpPidPath();
    logger = new RecordingLogger();

    deps = {
      config: makeConfig({ pidFilePath: pidPath }),
      daemonDeps: makeDeps(db),
      logger,
    };

    stderrWrites.length = 0;
    stdoutWrites.length = 0;
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrWrites.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      if (existsSync(pidPath)) unlinkSync(pidPath);
    } catch {
      /* ignore */
    }
  });

  describe('unknown subcommand', () => {
    it('returns exit code 1', async () => {
      const code = await dispatch(['bogus'], deps);
      expect(code).toBe(1);
    });

    it('writes usage to stderr', async () => {
      await dispatch(['bogus'], deps);
      const combined = stderrWrites.join('');
      expect(combined).toContain("unknown subcommand 'bogus'");
      expect(combined).toContain('Usage:');
    });
  });

  describe('start (default)', () => {
    it('returns exit code 0 with no args (defaults to start)', async () => {
      // start() with a valid config will succeed, then daemon loops — we just verify
      // the code path doesn't blow up. We rely on the lock file to confirm it ran.
      const pidPathLocal = tmpPidPath();
      const localDeps: CliDeps = {
        ...deps,
        config: makeConfig({ pidFilePath: pidPathLocal, pollIntervalMs: 9_999_999 }),
      };

      // dispatch(['start']) awaits daemon.start() which is now async (resolves repo
      // context at startup). The lock file exists after start() resolves.
      const code = await dispatch([], localDeps);
      expect(code).toBe(0);
      expect(existsSync(pidPathLocal)).toBe(true);

      // Cleanup: unlock the PID so afterEach doesn't fail
      try {
        unlinkSync(pidPathLocal);
      } catch {
        /* ignore */
      }
    });

    it('returns exit code 1 when lock is already held', async () => {
      writeFileSync(pidPath, String(process.pid), 'utf8');
      const code = await dispatch(['start'], deps);
      expect(code).toBe(1);
    });
  });

  describe('stop', () => {
    it('returns 1 when no lock file exists', async () => {
      const code = await dispatch(['stop'], deps);
      expect(code).toBe(1);
      const combined = stderrWrites.join('');
      expect(combined).toContain('no lock file found');
    });

    it('returns 0 and removes stale lock file when PID is not running', async () => {
      writeFileSync(pidPath, '999999999', 'utf8');
      const code = await dispatch(['stop'], deps);
      expect(code).toBe(0);
      expect(existsSync(pidPath)).toBe(false);
      const combined = stderrWrites.join('');
      expect(combined).toContain('stale lock file removed');
    });

    it('sends SIGTERM when process is running and returns 0', async () => {
      writeFileSync(pidPath, String(process.pid), 'utf8');
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const code = await dispatch(['stop'], deps);
      expect(code).toBe(0);
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');

      killSpy.mockRestore();
    });
  });

  describe('status', () => {
    it('returns 0 with stopped JSON when no lock file', async () => {
      const code = await dispatch(['status'], deps);
      expect(code).toBe(0);
      const output = stdoutWrites.join('');
      expect(JSON.parse(output.trim())).toEqual({ status: 'stopped' });
    });

    it('returns 0 with stopped + staleLockPid when lock file has dead PID', async () => {
      writeFileSync(pidPath, '999999999', 'utf8');
      const code = await dispatch(['status'], deps);
      expect(code).toBe(0);
      const output = stdoutWrites.join('');
      const parsed = JSON.parse(output.trim()) as { status: string; staleLockPid: number };
      expect(parsed.status).toBe('stopped');
      expect(parsed.staleLockPid).toBe(999999999);
    });

    it('returns 0 with running + pid when daemon is live', async () => {
      writeFileSync(pidPath, String(process.pid), 'utf8');
      const code = await dispatch(['status'], deps);
      expect(code).toBe(0);
      const output = stdoutWrites.join('');
      const parsed = JSON.parse(output.trim()) as { status: string; pid: number };
      expect(parsed.status).toBe('running');
      expect(parsed.pid).toBe(process.pid);
    });
  });

  describe('run-once', () => {
    it('returns 0 on successful cycle', async () => {
      const code = await dispatch(['run-once'], deps);
      expect(code).toBe(0);
    });

    it('does not create a lock file', async () => {
      await dispatch(['run-once'], deps);
      expect(existsSync(pidPath)).toBe(false);
    });

    it('cycle errors are caught internally; only uncaught exceptions return 1', async () => {
      // runCycle catches per-step errors, so ingest failures still produce exit 0.
      // A non-existent spoolDir causes ingestFromSpool to error internally, not throw.
      const localDeps: CliDeps = {
        ...deps,
        config: makeConfig({ pidFilePath: pidPath, spoolDir: '/nonexistent-spool-path' }),
      };
      const code = await dispatch(['run-once'], localDeps);
      expect(code).toBe(0);
    });
  });
});
