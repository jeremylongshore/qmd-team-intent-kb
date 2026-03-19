import { describe, it, expect, beforeEach } from 'vitest';
import type {
  MemoryRepository,
  AuditRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';
import { Reporter } from '../reporter.js';
import { createTestRepos, makeMemory, makeCandidate, makeAuditEvent } from './fixtures.js';

const FIXED_NOW = '2026-03-01T00:00:00.000Z';
const OLD = '2026-01-01T00:00:00.000Z';
const RECENT = '2026-02-20T00:00:00.000Z';

describe('Reporter', () => {
  let memoryRepo: MemoryRepository;
  let auditRepo: AuditRepository;
  let candidateRepo: CandidateRepository;
  let reporter: Reporter;

  beforeEach(() => {
    ({ memoryRepo, auditRepo, candidateRepo } = createTestRepos());
    reporter = new Reporter(memoryRepo, auditRepo, candidateRepo, { staleDays: 30 });
  });

  describe('generateSystemReport', () => {
    it('produces a complete report on empty DB', () => {
      const report = reporter.generateSystemReport(() => FIXED_NOW);
      expect(report.lifecycle.total).toBe(0);
      expect(report.curation.promoted).toBe(0);
      expect(report.health.staleCount).toBe(0);
      expect(report.tenants).toEqual([]);
      expect(report.generatedAt).toBe(FIXED_NOW);
    });

    it('produces accurate report with populated data', () => {
      memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: RECENT }));
      memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: OLD }));
      memoryRepo.insert(makeMemory({ lifecycle: 'archived', updatedAt: OLD }));

      auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
      auditRepo.insert(makeAuditEvent({ action: 'demoted' }));

      const { candidate, contentHash } = makeCandidate();
      candidateRepo.insert(candidate, contentHash);

      const report = reporter.generateSystemReport(() => FIXED_NOW);
      expect(report.lifecycle.total).toBe(3);
      expect(report.lifecycle.distribution['active']).toBe(2);
      expect(report.curation.promoted).toBe(1);
      expect(report.curation.rejected).toBe(1);
      expect(report.health.staleCount).toBe(1);
      expect(report.tenants.length).toBeGreaterThan(0);
    });
  });

  describe('generateTenantReport', () => {
    it('returns null for unknown tenant', () => {
      const result = reporter.generateTenantReport('nonexistent');
      expect(result).toBeNull();
    });

    it('returns summary for known tenant', () => {
      memoryRepo.insert(makeMemory({ tenantId: 'team-alpha' }));
      memoryRepo.insert(makeMemory({ tenantId: 'team-alpha' }));
      const { candidate, contentHash } = makeCandidate({ tenantId: 'team-alpha' });
      candidateRepo.insert(candidate, contentHash);
      auditRepo.insert(makeAuditEvent({ tenantId: 'team-alpha', action: 'promoted' }));

      const result = reporter.generateTenantReport('team-alpha');
      expect(result).not.toBeNull();
      expect(result?.memoryCount).toBe(2);
      expect(result?.candidateCount).toBe(1);
      expect(result?.auditActions['promoted']).toBe(1);
    });
  });

  describe('generateStaleReport', () => {
    it('returns empty stale report on empty DB', () => {
      const report = reporter.generateStaleReport(() => FIXED_NOW);
      expect(report.totalStale).toBe(0);
      expect(report.staleMemories).toEqual([]);
    });

    it('identifies stale memories with details', () => {
      const stale = makeMemory({
        lifecycle: 'active',
        updatedAt: OLD,
        title: 'Stale Pattern',
        category: 'pattern',
      });
      memoryRepo.insert(stale);
      memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: RECENT }));

      const report = reporter.generateStaleReport(() => FIXED_NOW);
      expect(report.totalStale).toBe(1);
      expect(report.staleMemories[0]?.title).toBe('Stale Pattern');
      expect(report.staleMemories[0]?.id).toBe(stale.id);
    });
  });
});
