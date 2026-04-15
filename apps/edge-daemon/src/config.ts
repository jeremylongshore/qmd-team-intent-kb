import { resolveTeamKbPath } from '@qmd-team-intent-kb/common';
import type { DaemonConfig } from './types.js';

/** Default configuration values */
const DEFAULTS = {
  pollIntervalMs: 10_000,
  maxCandidatesPerCycle: 100,
  maxSpoolFileSizeBytes: 10 * 1024 * 1024, // 10MB
  enableExport: true,
  enableIndexUpdate: true,
  enableStalenessSweep: true,
  staleDays: 90,
  exportOutputDir: 'kb-export/',
  exportTargetId: 'kb-export-default',
  supersessionThreshold: 0.6,
} as const;

/**
 * Load daemon configuration from environment variables with defaults.
 *
 * Environment variables:
 *   DAEMON_TENANT_ID       — required tenant identifier
 *   DAEMON_POLL_INTERVAL   — poll interval in ms (default 10000)
 *   DAEMON_MAX_CANDIDATES  — max candidates per cycle (default 100)
 *   DAEMON_MAX_SPOOL_SIZE  — max spool file size in bytes (default 10MB)
 *   DAEMON_ENABLE_EXPORT   — 'true'/'false' (default true)
 *   DAEMON_ENABLE_INDEX    — 'true'/'false' (default true)
 *   DAEMON_ENABLE_STALENESS — 'true'/'false' (default true)
 *   DAEMON_STALE_DAYS      — days before auto-deprecation (default 90)
 *   DAEMON_SPOOL_DIR       — spool directory path
 *   DAEMON_EXPORT_DIR      — export output directory
 *   DAEMON_EXPORT_TARGET   — export target identifier
 *   DAEMON_SUPERSESSION_THRESHOLD — Jaccard threshold (default 0.6)
 *   DAEMON_PID_FILE        — PID file path
 *   DAEMON_HEALTH_PORT     — HTTP health server port (default 0 = disabled)
 */
export function loadDaemonConfig(
  env: Record<string, string | undefined> = process.env,
): DaemonConfig {
  const tenantId = env['DAEMON_TENANT_ID'];
  if (!tenantId) {
    throw new Error('DAEMON_TENANT_ID environment variable is required');
  }

  const pollIntervalMs = parsePositiveInt(env['DAEMON_POLL_INTERVAL'], DEFAULTS.pollIntervalMs);
  const maxCandidatesPerCycle = parsePositiveInt(
    env['DAEMON_MAX_CANDIDATES'],
    DEFAULTS.maxCandidatesPerCycle,
  );
  const maxSpoolFileSizeBytes = parsePositiveInt(
    env['DAEMON_MAX_SPOOL_SIZE'],
    DEFAULTS.maxSpoolFileSizeBytes,
  );

  return {
    tenantId,
    pollIntervalMs,
    maxCandidatesPerCycle,
    maxSpoolFileSizeBytes,
    enableExport: parseBool(env['DAEMON_ENABLE_EXPORT'], DEFAULTS.enableExport),
    enableIndexUpdate: parseBool(env['DAEMON_ENABLE_INDEX'], DEFAULTS.enableIndexUpdate),
    enableStalenessSweep: parseBool(env['DAEMON_ENABLE_STALENESS'], DEFAULTS.enableStalenessSweep),
    staleDays: parsePositiveInt(env['DAEMON_STALE_DAYS'], DEFAULTS.staleDays),
    spoolDir: env['DAEMON_SPOOL_DIR'] ?? undefined,
    exportOutputDir: env['DAEMON_EXPORT_DIR'] ?? DEFAULTS.exportOutputDir,
    exportTargetId: env['DAEMON_EXPORT_TARGET'] ?? DEFAULTS.exportTargetId,
    supersessionThreshold: parseFloat(
      env['DAEMON_SUPERSESSION_THRESHOLD'] ?? String(DEFAULTS.supersessionThreshold),
    ),
    pidFilePath: env['DAEMON_PID_FILE'] ?? resolveTeamKbPath('daemon.pid'),
    healthPort: parseNonNegativeInt(env['DAEMON_HEALTH_PORT'], 0),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}
