import { describe, it, expect, beforeEach } from 'vitest';
import type {
  MemoryRepository,
  AuditRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';
import { aggregateTenants } from '../aggregators/tenant-aggregator.js';
import { createTestRepos, makeMemory, makeCandidate, makeAuditEvent } from './fixtures.js';

describe('aggregateTenants', () => {
  let memoryRepo: MemoryRepository;
  let auditRepo: AuditRepository;
  let candidateRepo: CandidateRepository;

  beforeEach(() => {
    ({ memoryRepo, auditRepo, candidateRepo } = createTestRepos());
  });

  it('returns empty array when no tenants exist', () => {
    const tenants = aggregateTenants(memoryRepo, candidateRepo, auditRepo);
    expect(tenants).toEqual([]);
  });

  it('discovers tenants from memories and candidates', () => {
    memoryRepo.insert(makeMemory({ tenantId: 'team-alpha' }));
    const { candidate, contentHash } = makeCandidate({ tenantId: 'team-beta' });
    candidateRepo.insert(candidate, contentHash);

    const tenants = aggregateTenants(memoryRepo, candidateRepo, auditRepo);
    expect(tenants).toHaveLength(2);
    expect(tenants[0]?.tenantId).toBe('team-alpha');
    expect(tenants[1]?.tenantId).toBe('team-beta');
  });

  it('includes audit action distribution per tenant', () => {
    memoryRepo.insert(makeMemory({ tenantId: 'team-alpha' }));
    auditRepo.insert(makeAuditEvent({ tenantId: 'team-alpha', action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ tenantId: 'team-alpha', action: 'promoted' }));
    auditRepo.insert(makeAuditEvent({ tenantId: 'team-alpha', action: 'archived' }));

    const tenants = aggregateTenants(memoryRepo, candidateRepo, auditRepo);
    const alpha = tenants.find((t) => t.tenantId === 'team-alpha');
    expect(alpha?.auditActions['promoted']).toBe(2);
    expect(alpha?.auditActions['archived']).toBe(1);
  });

  it('sorts tenants alphabetically by ID', () => {
    memoryRepo.insert(makeMemory({ tenantId: 'z-team' }));
    memoryRepo.insert(makeMemory({ tenantId: 'a-team' }));
    memoryRepo.insert(makeMemory({ tenantId: 'm-team' }));

    const tenants = aggregateTenants(memoryRepo, candidateRepo, auditRepo);
    expect(tenants.map((t) => t.tenantId)).toEqual(['a-team', 'm-team', 'z-team']);
  });
});
