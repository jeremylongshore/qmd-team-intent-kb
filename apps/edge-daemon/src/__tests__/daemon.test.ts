import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import type Database from 'better-sqlite3';
import { EdgeDaemon } from '../daemon.js';
import type { DaemonConfig, DaemonDependencies } from '../types.js';
import {
  makeDeps,
  makeConfig,
  makeCandidate,
  writeSpoolFile,
  RecordingLogger,
  NOW,
} from './fixtures.js';

describe('EdgeDaemon', () => {
  let db: Database.Database;
  let deps: DaemonDependencies;
  let spoolDir: string;
  let config: DaemonConfig;
  let logger: RecordingLogger;

  beforeEach(async () => {
    db = createTestDatabase();
    deps = makeDeps(db);
    spoolDir = await mkdtemp(join(tmpdir(), 'daemon-test-spool-'));
    config = makeConfig({ spoolDir });
    logger = new RecordingLogger();
  });

  afterEach(async () => {
    await rm(spoolDir, { recursive: true, force: true });
    // Clean up PID files
    try {
      if (existsSync(config.pidFilePath)) unlinkSync(config.pidFilePath);
    } catch {
      /* ignore */
    }
  });

  it('starts in idle state', () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    expect(daemon.state).toBe('idle');
  });

  it('transitions to running on start()', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.start();
    expect(daemon.state).toBe('running');
    void daemon.stop();
  });

  it('creates PID file on start()', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.start();
    expect(existsSync(config.pidFilePath)).toBe(true);
    void daemon.stop();
  });

  it('removes PID file on stop()', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.start();
    await daemon.stop();
    expect(existsSync(config.pidFilePath)).toBe(false);
  });

  it('transitions to stopped after stop()', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.start();
    await daemon.stop();
    expect(daemon.state).toBe('stopped');
  });

  it('throws when starting from non-idle state', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.start();
    await expect(daemon.start()).rejects.toThrow('Cannot start daemon');
    void daemon.stop();
  });

  it('throws when lock is held by another process', () => {
    const pidPath = config.pidFilePath;
    // Write current PID (simulates lock held by us in another instance)
    writeFileSync(pidPath, String(process.pid), 'utf8');

    const daemon = new EdgeDaemon(config, deps, logger);
    expect(() => daemon.start()).toThrow('Cannot acquire lock');

    unlinkSync(pidPath);
  });

  it('runOnce executes a single cycle', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    const result = await daemon.runOnce();
    expect(result.startedAt).toBe(NOW);
    expect(result.completedAt).toBe(NOW);
    expect(daemon.lastCycleResult).toBe(result);
  });

  it('runOnce processes spool candidates', async () => {
    const candidate = makeCandidate({
      content: 'Testing daemon runOnce with a real candidate to process here.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const daemon = new EdgeDaemon(config, deps, logger);
    const result = await daemon.runOnce();
    expect(result.ingest.ingested).toBe(1);
    expect(result.curation).not.toBeNull();
    expect(result.curation!.promoted).toBe(1);
  });

  it('stop() is a no-op when idle', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.stop(); // should not throw
    expect(daemon.state).toBe('idle');
  });

  it('logs start and stop messages', async () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    await daemon.start();
    await daemon.stop();
    const messages = logger.messages.map((m) => m.message);
    expect(messages.some((m) => m.includes('Daemon started'))).toBe(true);
    expect(messages.some((m) => m.includes('Daemon stopped'))).toBe(true);
  });

  it('lastCycleResult is null before any cycle runs', () => {
    const daemon = new EdgeDaemon(config, deps, logger);
    expect(daemon.lastCycleResult).toBeNull();
  });
});
