/**
 * Regression tests for the health-server startup race condition.
 *
 * Bug: if stop() was called before the HealthServer.start() Promise resolved,
 * stop() would call _healthServer.stop() while _server was still null (the
 * http.Server had not yet been assigned). stop() would return early (idempotent
 * null guard), then start() would later resolve, set _server, and the underlying
 * http.Server would run forever with no owner to close it.
 *
 * Fix: EdgeDaemon tracks the in-flight _healthServerStartPromise and stop()
 * awaits it before calling _healthServer.stop(), ensuring the http.Server is
 * always closed even under fast teardown.
 *
 * These tests are intentionally SQLite-free so they run without native bindings.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { EdgeDaemon } from '../daemon.js';
import type { HealthServer } from '../health-server.js';
import type { DaemonConfig, DaemonDependencies, DaemonLogger } from '../types.js';

/** Ask the OS for a free TCP port by binding to :0, recording the assigned port, then closing. */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

const NOW = '2026-01-15T10:00:00.000Z';
const TENANT = 'team-alpha';

/**
 * Build a minimal DaemonDependencies stub — no SQLite required.
 *
 * The lifecycle tests only exercise start()/stop() and never run a full cycle
 * (pollIntervalMs is set very high), so the repository methods are never called.
 * We satisfy the TypeScript interface with a typed cast of empty objects.
 */
function makeStubDeps(): DaemonDependencies {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {} as any;
}

/** Minimal config for lifecycle tests — no SQLite, no export, no index update */
function makeLifecycleConfig(overrides?: Partial<DaemonConfig>): DaemonConfig {
  return {
    tenantId: TENANT,
    pollIntervalMs: 9_999_999, // never fires during tests
    maxCandidatesPerCycle: 100,
    maxSpoolFileSizeBytes: 10 * 1024 * 1024,
    enableExport: false,
    enableIndexUpdate: false,
    enableStalenessSweep: false,
    staleDays: 90,
    exportOutputDir: 'kb-export/',
    exportTargetId: 'kb-export-default',
    supersessionThreshold: 0.6,
    pidFilePath: join(tmpdir(), `daemon-lifecycle-test-${randomUUID()}.pid`),
    scopeByRepo: false,
    healthHost: '127.0.0.1',
    maxRetries: 0,
    retryBaseDelayMs: 0,
    retryMaxJitterMs: 0,
    sleepFn: async (_ms: number) => {},
    nowFn: () => NOW,
    // healthPort provided by each test via overrides
    ...overrides,
  };
}

/** Recording logger for test assertions — matches DaemonLogger interface inline */
class RecordingLogger implements DaemonLogger {
  readonly messages: Array<{ level: string; message: string }> = [];
  info(message: string): void {
    this.messages.push({ level: 'info', message });
  }
  warn(message: string): void {
    this.messages.push({ level: 'warn', message });
  }
  error(message: string): void {
    this.messages.push({ level: 'error', message });
  }
}

describe('EdgeDaemon health-server lifecycle race', () => {
  let spoolDir: string;
  let config: DaemonConfig;
  let logger: RecordingLogger;
  const deps = makeStubDeps();

  beforeEach(async () => {
    spoolDir = await mkdtemp(join(tmpdir(), 'daemon-lifecycle-test-'));
    // Acquire a free port then release it; pass it to the daemon so healthPort > 0.
    // Port 0 in the daemon config means "disabled", so we need an actual port number.
    const freePort = await getFreePort();
    config = makeLifecycleConfig({ spoolDir, healthPort: freePort });
    logger = new RecordingLogger();
  });

  afterEach(async () => {
    await rm(spoolDir, { recursive: true, force: true });
    await rm(config.pidFilePath, { force: true });
  });

  it('stop() called immediately after start() fully closes the http.Server (no leak)', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);

    // start() is synchronous — it fires HealthServer.start() on the microtask queue
    // but does NOT await it. Calling stop() right away means stop() races start().
    daemon.start();
    expect(daemon.state).toBe('running');

    // Capture the HealthServer reference before stop() nulls _healthServer.
    // @ts-expect-error — accessing private field for test assertion
    const hs = daemon._healthServer as HealthServer | null;
    expect(hs).not.toBeNull();

    // This is the race: stop() is invoked before HealthServer.start() has resolved.
    // The fix ensures stop() awaits _healthServerStartPromise so the http.Server
    // is always fully started and then properly closed.
    await daemon.stop();

    expect(daemon.state).toBe('stopped');

    // Confirm the underlying http.Server was closed (not leaked).
    // After stop(), HealthServer.stop() sets _server = null via its close callback.
    const httpServer = (hs as unknown as { _server: Server | null })._server;
    expect(httpServer).toBeNull();
  });

  it('_healthServerStartPromise is null after stop() completes (no dangling reference)', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    daemon.start();

    // The promise is assigned synchronously by start() before returning.
    // @ts-expect-error — accessing private field for test assertion
    const promiseBefore = daemon._healthServerStartPromise as Promise<void> | null;
    expect(promiseBefore).not.toBeNull();

    await daemon.stop();

    // The .finally() handler in start() clears the field once the chain resolves.
    // stop() awaits the chain, so by the time stop() returns the field is null.
    // @ts-expect-error — accessing private field for test assertion
    const promiseAfter = daemon._healthServerStartPromise as Promise<void> | null;
    expect(promiseAfter).toBeNull();
  });

  it('daemon transitions to stopped and releases PID lock with healthPort configured', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    daemon.start();
    expect(existsSync(config.pidFilePath)).toBe(true);

    await daemon.stop();

    expect(daemon.state).toBe('stopped');
    expect(existsSync(config.pidFilePath)).toBe(false);
  });

  it('stop() awaits start() so the "Health server listening" log appears before stop completes', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    daemon.start();

    // No microtask tick between start() and stop() — pure race condition scenario.
    await daemon.stop();

    const messages = logger.messages.map((m) => m.message);
    // Because stop() awaits the in-flight promise, the .then() handler that emits
    // this log fires before stop() returns, making it observable here.
    expect(messages.some((m) => m.includes('Health server listening on port'))).toBe(true);
  });

  it('start() remains synchronous — throws immediately on non-idle state', () => {
    // This guards the contract stated in the fix requirements: start() must NOT
    // become async. The throw must be synchronous, not deferred to a Promise rejection.
    const daemon = new EdgeDaemon(config, deps, logger);
    daemon.start();
    expect(() => daemon.start()).toThrow('Cannot start daemon');
    void daemon.stop();
  });
});
