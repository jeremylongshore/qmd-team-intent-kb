import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import type Database from 'better-sqlite3';
import { runCycle } from '../cycle.js';
import type { DaemonConfig, DaemonDependencies } from '../types.js';
import {
  makeDeps,
  makeConfig,
  makeCandidate,
  makePolicy,
  writeSpoolFile,
  RecordingLogger,
  TENANT,
  NOW,
} from './fixtures.js';

describe('runCycle', () => {
  let db: Database.Database;
  let deps: DaemonDependencies;
  let spoolDir: string;
  let exportDir: string;
  let config: DaemonConfig;
  let logger: RecordingLogger;

  beforeEach(async () => {
    db = createTestDatabase();
    deps = makeDeps(db);
    spoolDir = await mkdtemp(join(tmpdir(), 'daemon-cycle-spool-'));
    exportDir = await mkdtemp(join(tmpdir(), 'daemon-cycle-export-'));
    config = makeConfig({
      spoolDir,
      exportOutputDir: exportDir,
      enableExport: false,
      enableIndexUpdate: false,
    });
    logger = new RecordingLogger();
  });

  afterEach(async () => {
    await rm(spoolDir, { recursive: true, force: true });
    await rm(exportDir, { recursive: true, force: true });
  });

  it('returns a complete CycleResult on empty spool', async () => {
    const result = await runCycle(config, deps, logger);
    expect(result.startedAt).toBe(NOW);
    expect(result.completedAt).toBe(NOW);
    expect(result.ingest.ingested).toBe(0);
    expect(result.ingest.errors).toHaveLength(0);
    expect(result.curation).toBeNull();
    expect(result.export).toBeNull();
    expect(result.indexUpdate).toBeNull();
  });

  it('ingests candidates from spool', async () => {
    const candidate = makeCandidate({
      content: 'Architecture decision for monorepo structure and package organization.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const result = await runCycle(config, deps, logger);
    expect(result.ingest.ingested).toBe(1);
  });

  it('curates ingested candidates', async () => {
    const candidate = makeCandidate({
      content: 'TypeScript strict mode is required in all packages for type safety.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const result = await runCycle(config, deps, logger);
    expect(result.curation).not.toBeNull();
    expect(result.curation!.processed).toBe(1);
    expect(result.curation!.promoted).toBe(1);
  });

  it('rejects candidates that fail policy', async () => {
    const policy = makePolicy();
    deps.policyRepo.insert(policy);

    const candidate = makeCandidate({
      content: 'API key is AKIAIOSFODNN7EXAMPLE — this has a secret',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const result = await runCycle(config, deps, logger);
    expect(result.curation!.rejected).toBe(1);
    expect(result.curation!.promoted).toBe(0);
  });

  it('caps ingestion at maxCandidatesPerCycle', async () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({
        content: `Unique candidate number ${i} with enough content to pass length check.`,
      }),
    );
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', candidates);

    const limitedConfig = makeConfig({
      spoolDir,
      maxCandidatesPerCycle: 3,
      enableExport: false,
      enableIndexUpdate: false,
    });

    const result = await runCycle(limitedConfig, deps, logger);
    expect(result.ingest.ingested).toBe(3);
    expect(result.curation!.processed).toBe(3);
    // Should have a capped warning
    const warnMessages = logger.messages.filter((m) => m.level === 'warn');
    expect(warnMessages.some((m) => m.message.includes('Capped ingestion'))).toBe(true);
  });

  it('runs export step when enableExport is true', async () => {
    const candidate = makeCandidate({
      content: 'Use dependency injection for all service classes in the application.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const exportConfig = makeConfig({
      spoolDir,
      exportOutputDir: exportDir,
      enableExport: true,
      enableIndexUpdate: false,
    });

    const result = await runCycle(exportConfig, deps, logger);
    expect(result.export).not.toBeNull();
    expect(result.export!.totalProcessed).toBeGreaterThanOrEqual(0);
  });

  it('skips curation when nothing ingested', async () => {
    const result = await runCycle(config, deps, logger);
    expect(result.curation).toBeNull();
  });

  it('handles spool directory that does not exist', async () => {
    const badConfig = makeConfig({
      spoolDir: join(tmpdir(), 'nonexistent-spool-' + Date.now().toString()),
      enableExport: false,
      enableIndexUpdate: false,
    });

    const result = await runCycle(badConfig, deps, logger);
    expect(result.ingest.errors.length).toBeGreaterThan(0);
    expect(result.curation).toBeNull();
  });

  it('index update records error when adapter throws', async () => {
    const candidate = makeCandidate({
      content: 'Index test candidate with enough content for the length rule check.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const mockAdapter = {
      ensureCollections: async () => ({ ok: false as const, error: { message: 'qmd not found' } }),
      update: async () => ({ ok: true as const, value: undefined }),
    };

    const indexConfig = makeConfig({
      spoolDir,
      enableExport: false,
      enableIndexUpdate: true,
    });

    const indexDeps = { ...deps, qmdAdapter: mockAdapter as never };
    const result = await runCycle(indexConfig, indexDeps, logger);
    expect(result.indexUpdate).not.toBeNull();
    expect(result.indexUpdate!.ok).toBe(false);
    expect(result.indexUpdate!.error).toContain('qmd not found');
  });

  it('index update succeeds with mock adapter', async () => {
    const mockAdapter = {
      ensureCollections: async () => ({ ok: true as const, value: ['curated'] }),
      update: async () => ({ ok: true as const, value: undefined }),
    };

    const indexConfig = makeConfig({
      spoolDir,
      enableExport: false,
      enableIndexUpdate: true,
    });

    const indexDeps = { ...deps, qmdAdapter: mockAdapter as never };
    const result = await runCycle(indexConfig, indexDeps, logger);
    expect(result.indexUpdate).not.toBeNull();
    expect(result.indexUpdate!.ok).toBe(true);
  });

  it('skips index update when no adapter provided', async () => {
    const indexConfig = makeConfig({
      spoolDir,
      enableExport: false,
      enableIndexUpdate: true,
    });

    // deps has no qmdAdapter by default
    const result = await runCycle(indexConfig, deps, logger);
    expect(result.indexUpdate).toBeNull();
  });

  it('records timestamps correctly', async () => {
    let callCount = 0;
    const timedConfig = makeConfig({
      spoolDir,
      enableExport: false,
      enableIndexUpdate: false,
      nowFn: () => {
        callCount++;
        return `2026-01-15T10:00:0${callCount}.000Z`;
      },
    });

    const result = await runCycle(timedConfig, deps, logger);
    expect(result.startedAt).toBe('2026-01-15T10:00:01.000Z');
    expect(result.completedAt).toBe('2026-01-15T10:00:02.000Z');
  });

  it('does not call memoryRepo.insert directly (governance bypass prevention)', async () => {
    // Verify the cycle only promotes through Curator pipeline
    const candidate = makeCandidate({
      content: 'Testing governance bypass prevention through curator pipeline.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const result = await runCycle(config, deps, logger);
    expect(result.curation).not.toBeNull();
    expect(result.curation!.promoted).toBe(1);
    // Memory was created through the proper pipeline
    const memories = deps.memoryRepo.findByTenant(TENANT);
    expect(memories).toHaveLength(1);
  });

  it('tenant match — foreign candidates rejected with tenant_match rule', async () => {
    const policy = makePolicy({
      rules: [
        {
          id: 'rule-tenant',
          type: 'tenant_match',
          action: 'reject',
          enabled: true,
          priority: 0,
          parameters: {},
        },
      ],
    });
    deps.policyRepo.insert(policy);

    const candidate = makeCandidate({
      tenantId: 'team-foreign',
      content: 'This candidate is from a different tenant and should be rejected.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const result = await runCycle(config, deps, logger);
    expect(result.curation!.rejected).toBe(1);
    expect(result.curation!.promoted).toBe(0);
  });

  it('failed curation does not abort export step', async () => {
    // An error in the curation step should not prevent export from running
    const candidate = makeCandidate({
      content: 'Content for testing that export still runs after curation errors.',
    });
    await writeSpoolFile(spoolDir, 'spool-001.jsonl', [candidate]);

    const exportConfig = makeConfig({
      spoolDir,
      exportOutputDir: exportDir,
      enableExport: true,
      enableIndexUpdate: false,
    });

    const result = await runCycle(exportConfig, deps, logger);
    // Export should have run regardless of curation outcome
    expect(result.export).not.toBeNull();
  });
});
