import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import type { DaemonConfig, DaemonDependencies, DaemonLogger } from '../types.js';
import {
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
  ExportStateRepository,
} from '@qmd-team-intent-kb/store';
import type Database from 'better-sqlite3';

export const NOW = '2026-01-15T10:00:00.000Z';
export const TENANT = 'team-alpha';

/** Build a valid MemoryCandidate, merging optional overrides */
export function makeCandidate(overrides?: Record<string, unknown>): MemoryCandidate {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations in the codebase',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: TENANT,
    metadata: { filePaths: ['src/utils.ts'], tags: ['error-handling'] },
    prePolicyFlags: {},
    capturedAt: NOW,
    ...overrides,
  });
}

/** Build a valid GovernancePolicy with basic rules */
export function makePolicy(overrides?: Record<string, unknown>): GovernancePolicy {
  return GovernancePolicy.parse({
    id: randomUUID(),
    name: 'Test Policy',
    tenantId: TENANT,
    rules: [
      {
        id: 'rule-secret',
        type: 'secret_detection',
        action: 'reject',
        enabled: true,
        priority: 0,
        parameters: {},
      },
      {
        id: 'rule-length',
        type: 'content_length',
        action: 'reject',
        enabled: true,
        priority: 1,
        parameters: { min: 10, max: 50000 },
      },
    ],
    enabled: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

/** Create all daemon dependencies from an in-memory test database */
export function makeDeps(db: Database.Database): DaemonDependencies {
  return {
    candidateRepo: new CandidateRepository(db),
    memoryRepo: new MemoryRepository(db),
    policyRepo: new PolicyRepository(db),
    auditRepo: new AuditRepository(db),
    exportStateRepo: new ExportStateRepository(db),
  };
}

/** Create a default test config */
export function makeConfig(overrides?: Partial<DaemonConfig>): DaemonConfig {
  return {
    tenantId: TENANT,
    pollIntervalMs: 100, // fast for tests
    maxCandidatesPerCycle: 100,
    maxSpoolFileSizeBytes: 10 * 1024 * 1024,
    enableExport: false, // default off in tests — no filesystem side effects
    enableIndexUpdate: false,
    exportOutputDir: 'kb-export/',
    exportTargetId: 'kb-export-default',
    supersessionThreshold: 0.6,
    pidFilePath: '/tmp/daemon-test-' + randomUUID() + '.pid',
    nowFn: () => NOW,
    ...overrides,
  };
}

/** Recording logger for test assertions */
export class RecordingLogger implements DaemonLogger {
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

/** Serialise a candidate to a JSONL line */
export function candidateToJsonl(candidate: MemoryCandidate): string {
  return JSON.stringify(candidate);
}

/** Write candidates to a spool file */
export async function writeSpoolFile(
  dir: string,
  name: string,
  candidates: MemoryCandidate[],
): Promise<string> {
  const { writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const filepath = join(dir, name);
  const lines = candidates.map(candidateToJsonl).join('\n');
  await writeFile(filepath, lines, 'utf8');
  return filepath;
}
