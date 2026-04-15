import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, AuditRepository } from '@qmd-team-intent-kb/store';
import type { PipelineResult } from '@qmd-team-intent-kb/policy-engine';
import { reject } from '../rejection/rejector.js';
import { makeCandidate, TENANT } from './fixtures.js';

function makeRejectedResult(overrides?: Partial<PipelineResult>): PipelineResult {
  return {
    candidateId: randomUUID(),
    outcome: 'rejected',
    evaluations: [
      {
        ruleId: 'rule-secret',
        ruleType: 'secret_detection',
        outcome: 'fail',
        reason: 'Secret found',
      },
    ],
    rejectedBy: 'rule-secret',
    ...overrides,
  };
}

function makeFlaggedResult(overrides?: Partial<PipelineResult>): PipelineResult {
  return {
    candidateId: randomUUID(),
    outcome: 'flagged',
    evaluations: [
      {
        ruleId: 'rule-relevance',
        ruleType: 'relevance_score',
        outcome: 'flag',
        reason: 'Low score',
      },
    ],
    flaggedBy: ['rule-relevance'],
    ...overrides,
  };
}

describe('reject', () => {
  let auditRepo: AuditRepository;

  beforeEach(() => {
    const db = createTestDatabase();
    auditRepo = new AuditRepository(db);
  });

  it('returns a reason string including the rejectedBy rule ID', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const pipelineResult = makeRejectedResult({ rejectedBy: 'rule-secret' });

    const reason = reject(candidate, pipelineResult, auditRepo);
    expect(reason).toContain('rule-secret');
    expect(reason).toContain('Rejected by rule');
  });

  it('returns a reason string including flaggedBy rule IDs when rejected by flagging', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const pipelineResult = makeFlaggedResult({ flaggedBy: ['rule-relevance', 'rule-trust'] });

    const reason = reject(candidate, pipelineResult, auditRepo);
    expect(reason).toContain('rule-relevance');
    expect(reason).toContain('rule-trust');
    expect(reason).toContain('Flagged by rules');
  });

  it('records an audit event in the repository', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const pipelineResult = makeRejectedResult();

    reject(candidate, pipelineResult, auditRepo);

    const events = auditRepo.findByTenant(TENANT);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('deleted');
  });

  it('audit event includes candidateId in details', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const pipelineResult = makeRejectedResult();

    reject(candidate, pipelineResult, auditRepo);

    const events = auditRepo.findByTenant(TENANT);
    const details = events[0]?.details;
    expect(details?.['candidateId']).toBe(candidate.id);
  });

  it('dry run does not insert audit event', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const pipelineResult = makeRejectedResult();

    reject(candidate, pipelineResult, auditRepo, true /* dryRun */);

    expect(auditRepo.findByTenant(TENANT)).toHaveLength(0);
  });

  it('dry run still returns the reason string', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const pipelineResult = makeRejectedResult({ rejectedBy: 'rule-length' });

    const reason = reject(candidate, pipelineResult, auditRepo, true);
    expect(reason).toBeTruthy();
    expect(reason).toContain('rule-length');
  });
});
