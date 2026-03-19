import { describe, it, expect, beforeEach } from 'vitest';
import type { AuditRepository } from '@qmd-team-intent-kb/store';
import { aggregateCuration } from '../aggregators/curation-aggregator.js';
import { createTestRepos, makeAuditEvent } from './fixtures.js';

describe('aggregateCuration', () => {
  let auditRepo: AuditRepository;

  beforeEach(() => {
    ({ auditRepo } = createTestRepos());
  });

  it('returns zero counts when audit trail is empty', () => {
    const report = aggregateCuration(auditRepo);
    expect(report.promoted).toBe(0);
    expect(report.rejected).toBe(0);
    expect(report.superseded).toBe(0);
    expect(report.archived).toBe(0);
    expect(report.promotionRate).toBe(0);
  });

  it('counts curation outcomes from audit events', () => {
    auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'demoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'superseded' }));
    auditRepo.insert(makeAuditEvent({ action: 'archived' }));
    auditRepo.insert(makeAuditEvent({ action: 'archived' }));

    const report = aggregateCuration(auditRepo);
    expect(report.promoted).toBe(3);
    expect(report.rejected).toBe(1);
    expect(report.superseded).toBe(1);
    expect(report.archived).toBe(2);
  });

  it('calculates promotion rate correctly', () => {
    auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ action: 'demoted' }));

    const report = aggregateCuration(auditRepo);
    expect(report.promotionRate).toBe(0.75);
  });

  it('ignores non-curation audit actions', () => {
    auditRepo.insert(makeAuditEvent({ action: 'searched' }));
    auditRepo.insert(makeAuditEvent({ action: 'exported' }));

    const report = aggregateCuration(auditRepo);
    expect(report.promoted).toBe(0);
    expect(report.rejected).toBe(0);
    expect(report.promotionRate).toBe(0);
  });
});
