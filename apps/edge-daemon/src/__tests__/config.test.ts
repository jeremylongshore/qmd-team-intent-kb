import { describe, it, expect } from 'vitest';
import { loadDaemonConfig } from '../config.js';

describe('loadDaemonConfig', () => {
  it('throws when DAEMON_TENANT_ID is missing', () => {
    expect(() => loadDaemonConfig({})).toThrow('DAEMON_TENANT_ID');
  });

  it('returns config with all defaults when only tenant is set', () => {
    const config = loadDaemonConfig({ DAEMON_TENANT_ID: 'my-team' });
    expect(config.tenantId).toBe('my-team');
    expect(config.pollIntervalMs).toBe(10_000);
    expect(config.maxCandidatesPerCycle).toBe(100);
    expect(config.maxSpoolFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(config.enableExport).toBe(true);
    expect(config.enableIndexUpdate).toBe(true);
    expect(config.exportOutputDir).toBe('kb-export/');
    expect(config.exportTargetId).toBe('kb-export-default');
    expect(config.supersessionThreshold).toBe(0.6);
  });

  it('parses poll interval from env', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_POLL_INTERVAL: '5000',
    });
    expect(config.pollIntervalMs).toBe(5000);
  });

  it('falls back to default for invalid poll interval', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_POLL_INTERVAL: 'abc',
    });
    expect(config.pollIntervalMs).toBe(10_000);
  });

  it('falls back to default for negative poll interval', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_POLL_INTERVAL: '-1',
    });
    expect(config.pollIntervalMs).toBe(10_000);
  });

  it('parses boolean enable flags', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_ENABLE_EXPORT: 'false',
      DAEMON_ENABLE_INDEX: 'false',
    });
    expect(config.enableExport).toBe(false);
    expect(config.enableIndexUpdate).toBe(false);
  });

  it('respects custom spool dir', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_SPOOL_DIR: '/custom/spool',
    });
    expect(config.spoolDir).toBe('/custom/spool');
  });

  it('parses supersession threshold', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_SUPERSESSION_THRESHOLD: '0.8',
    });
    expect(config.supersessionThreshold).toBe(0.8);
  });

  it('parses max candidates per cycle', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_MAX_CANDIDATES: '50',
    });
    expect(config.maxCandidatesPerCycle).toBe(50);
  });

  it('parses staleness sweep config from env', () => {
    const config = loadDaemonConfig({
      DAEMON_TENANT_ID: 'team',
      DAEMON_ENABLE_STALENESS: 'false',
      DAEMON_STALE_DAYS: '30',
    });
    expect(config.enableStalenessSweep).toBe(false);
    expect(config.staleDays).toBe(30);
  });

  it('defaults staleness sweep to enabled with 90 days', () => {
    const config = loadDaemonConfig({ DAEMON_TENANT_ID: 'team' });
    expect(config.enableStalenessSweep).toBe(true);
    expect(config.staleDays).toBe(90);
  });
});
