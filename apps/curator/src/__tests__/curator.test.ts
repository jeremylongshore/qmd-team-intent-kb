import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDatabase,
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
} from '@qmd-team-intent-kb/store';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type Database from 'better-sqlite3';
import { Curator } from '../curator.js';
import type { CuratorDependencies } from '../curator.js';
import { makeCandidate, makeCuratedMemory, makePolicy, TENANT } from './fixtures.js';

function makeDeps(db: Database.Database): CuratorDependencies {
  return {
    candidateRepo: new CandidateRepository(db),
    memoryRepo: new MemoryRepository(db),
    policyRepo: new PolicyRepository(db),
    auditRepo: new AuditRepository(db),
  };
}

describe('Curator.processSingle', () => {
  let deps: CuratorDependencies;

  beforeEach(() => {
    const db = createTestDatabase();
    deps = makeDeps(db);
  });

  it('promotes a clean candidate when no governance policy exists', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const candidate = makeCandidate();
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('promoted');
    expect(result.memoryId).toBeDefined();
    expect(result.candidateId).toBe(candidate.id);
  });

  it('promotes a clean candidate that passes all policy rules', () => {
    const policy = makePolicy();
    deps.policyRepo.insert(policy);
    const curator = new Curator(deps, { tenantId: TENANT });

    const candidate = makeCandidate({
      content:
        'Always use strict TypeScript settings in tsconfig including noUncheckedIndexedAccess and noUnusedLocals.',
    });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('promoted');
    expect(result.memoryId).toBeDefined();
  });

  it('rejects a candidate that contains secrets', () => {
    const policy = makePolicy();
    deps.policyRepo.insert(policy);
    const curator = new Curator(deps, { tenantId: TENANT });

    const candidate = makeCandidate({
      content: 'API key is AKIAIOSFODNN7EXAMPLE — keep safe',
    });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('rule-secret');
  });

  it('detects exact duplicate and returns duplicate outcome', () => {
    const content = 'Use Result<T, E> for all fallible operations in the codebase';
    const existing = makeCuratedMemory({ content });
    deps.memoryRepo.insert(existing);

    const curator = new Curator(deps, { tenantId: TENANT });
    const candidate = makeCandidate({ content });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('duplicate');
    expect(result.reason).toContain(existing.id);
  });

  it('detects supersession and links memories', () => {
    const existingContent = 'Existing error handling guide for the team at work';
    const existing = makeCuratedMemory({
      title: 'Error handling guide',
      category: 'convention',
      content: existingContent,
    });
    deps.memoryRepo.insert(existing);

    const curator = new Curator(deps, { tenantId: TENANT, supersessionThreshold: 0.5 });
    const candidate = makeCandidate({
      title: 'Error handling guide',
      category: 'convention',
      content: 'Updated error handling guide with new patterns for the team here today.',
    });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('promoted');
    expect(result.supersedes).toBe(existing.id);

    const oldMemory = deps.memoryRepo.findById(existing.id);
    expect(oldMemory?.lifecycle).toBe('superseded');
    expect(oldMemory?.supersession?.supersededBy).toBe(result.memoryId);
  });

  it('auto-approves when policy is disabled', () => {
    const policy = makePolicy({ enabled: false });
    deps.policyRepo.insert(policy);
    const curator = new Curator(deps, { tenantId: TENANT });
    const candidate = makeCandidate();
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('promoted');
  });

  it('returns correct CurationResult fields on promotion', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const candidate = makeCandidate();
    const result = curator.processSingle(candidate);
    expect(result.candidateId).toBe(candidate.id);
    expect(result.outcome).toBe('promoted');
    expect(result.memoryId).toBeDefined();
    expect(result.reason).toBeTruthy();
  });

  it('records policy evaluations on the promoted memory', () => {
    const policy = makePolicy();
    deps.policyRepo.insert(policy);
    const curator = new Curator(deps, { tenantId: TENANT });

    const candidate = makeCandidate({
      content: 'Repository pattern for all data access operations across the application layer.',
    });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('promoted');

    const memory = deps.memoryRepo.findById(result.memoryId!);
    expect(memory).not.toBeNull();
    expect(memory!.policyEvaluations.length).toBeGreaterThan(0);
  });

  it('content hash is computed correctly on the promoted memory', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const content = 'Specific content for hash verification in curator test suite.';
    const candidate = makeCandidate({ content });
    const result = curator.processSingle(candidate);

    const memory = deps.memoryRepo.findById(result.memoryId!);
    expect(memory?.contentHash).toBe(computeContentHash(content));
  });

  it('superseded memory lifecycle changes to superseded', () => {
    const existingContent = 'Architecture decision record for REST versus GraphQL approach used';
    const existing = makeCuratedMemory({
      title: 'API architecture decision',
      category: 'decision',
      content: existingContent,
    });
    deps.memoryRepo.insert(existing);

    const curator = new Curator(deps, { tenantId: TENANT, supersessionThreshold: 0.5 });
    const candidate = makeCandidate({
      title: 'API architecture decision',
      category: 'decision',
      content: 'Updated architecture decision for REST versus GraphQL with new details.',
    });
    curator.processSingle(candidate);

    const old = deps.memoryRepo.findById(existing.id);
    expect(old?.lifecycle).toBe('superseded');
  });

  it('does not supersede memories in a different category', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling convention',
      category: 'pattern',
    });
    deps.memoryRepo.insert(existing);

    const curator = new Curator(deps, { tenantId: TENANT, supersessionThreshold: 0.5 });
    const candidate = makeCandidate({
      title: 'Error handling convention',
      category: 'convention',
      content: 'Different content for the new convention entry not a duplicate.',
    });
    const result = curator.processSingle(candidate);
    expect(result.supersedes).toBeUndefined();
  });

  it('supersession threshold is configurable', () => {
    const existingContent = 'Error convention established for team use and coding standards';
    const existing = makeCuratedMemory({
      title: 'Error handling pattern guide',
      category: 'convention',
      content: existingContent,
    });
    deps.memoryRepo.insert(existing);

    // High threshold — "Error handling convention" vs "Error handling pattern guide"
    // A: {error, handling, convention}, B: {error, handling, pattern, guide}
    // intersection=2, union=5, similarity=0.4
    const curatorHigh = new Curator(deps, { tenantId: TENANT, supersessionThreshold: 0.9 });
    const candidate = makeCandidate({
      title: 'Error handling convention',
      category: 'convention',
      content: 'New convention content for error handling that is different from existing.',
    });
    const resultHigh = curatorHigh.processSingle(candidate);
    expect(resultHigh.supersedes).toBeUndefined();
  });

  it('flagged candidate is not promoted', () => {
    const policy = makePolicy({
      rules: [
        {
          id: 'rule-relevance',
          type: 'relevance_score',
          action: 'flag',
          enabled: true,
          priority: 0,
          parameters: { minimumScore: 0.99 },
        },
      ],
    });
    deps.policyRepo.insert(policy);

    const curator = new Curator(deps, { tenantId: TENANT });
    // Minimal candidate — low relevance score triggers flag
    const candidate = makeCandidate({
      title: 'note',
      content: 'Short.',
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('flagged');
    expect(result.memoryId).toBeUndefined();
  });

  it('candidate from wrong tenant gets rejected by tenant_match rule', () => {
    // Policy is stored under 'team-beta' (the curator's tenantId) so it gets found.
    // The candidate has tenantId 'team-alpha'. The rule compares candidate.tenantId
    // against context.tenantId ('team-beta') → mismatch → rejected.
    const policy = makePolicy({
      tenantId: 'team-beta',
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

    const curator = new Curator(deps, { tenantId: 'team-beta' });
    // Candidate tenantId is 'team-alpha' (from fixture), curator tenantId is 'team-beta'
    const candidate = makeCandidate({ tenantId: TENANT });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('rejected');
  });

  it('candidate in same tenant passes tenant_match rule', () => {
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

    const curator = new Curator(deps, { tenantId: TENANT });
    const candidate = makeCandidate({ tenantId: TENANT });
    const result = curator.processSingle(candidate);
    expect(result.outcome).toBe('promoted');
  });
});

describe('Curator.processBatch', () => {
  let deps: CuratorDependencies;

  beforeEach(() => {
    const db = createTestDatabase();
    deps = makeDeps(db);
  });

  it('processes mixed batch and returns correct counts', () => {
    const policy = makePolicy();
    deps.policyRepo.insert(policy);
    const curator = new Curator(deps, { tenantId: TENANT });

    const cleanContent =
      'Clean architectural decision for the monorepo setup with pnpm workspaces.';
    const secretContent = 'API key is AKIAIOSFODNN7EXAMPLE — store this safely somewhere';
    const dupContent = cleanContent; // same content — first will promote, second is dup

    const candidates = [
      makeCandidate({ content: cleanContent }),
      makeCandidate({ content: secretContent }),
      makeCandidate({ content: dupContent }),
    ];

    const batchResult = curator.processBatch(candidates);

    expect(batchResult.processed).toBe(3);
    expect(batchResult.promoted).toBe(1);
    expect(batchResult.rejected).toBe(1);
    expect(batchResult.duplicates).toBe(1);
    expect(batchResult.results).toHaveLength(3);
  });

  it('CurationBatchResult has correct structure', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const candidates = [makeCandidate(), makeCandidate()];
    const result = curator.processBatch(candidates);

    expect(typeof result.processed).toBe('number');
    expect(typeof result.promoted).toBe('number');
    expect(typeof result.rejected).toBe('number');
    expect(typeof result.flagged).toBe('number');
    expect(typeof result.duplicates).toBe('number');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('empty batch returns zeroed counts', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const result = curator.processBatch([]);
    expect(result.processed).toBe(0);
    expect(result.promoted).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.flagged).toBe(0);
    expect(result.duplicates).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('dry run mode returns same outcomes but does not persist', () => {
    const curator = new Curator(deps, { tenantId: TENANT, dryRun: true });
    // Use distinct content so intra-batch dedup doesn't catch the second
    const candidates = [
      makeCandidate({ content: 'First unique candidate with enough content for length check.' }),
      makeCandidate({ content: 'Second unique candidate with enough content for length check.' }),
    ];
    const result = curator.processBatch(candidates);

    // Outcomes are computed
    expect(result.promoted).toBe(2);
    // But nothing is persisted
    expect(deps.memoryRepo.count()).toBe(0);
    expect(deps.auditRepo.findByTenant(TENANT)).toHaveLength(0);
  });

  it('dry run processes all candidates and returns results', () => {
    const curator = new Curator(deps, { tenantId: TENANT, dryRun: true });
    const candidate = makeCandidate();
    const result = curator.processBatch([candidate]);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.candidateId).toBe(candidate.id);
    expect(result.results[0]?.outcome).toBe('promoted');
    // memoryId is set (computed in dry run)
    expect(result.results[0]?.memoryId).toBeDefined();
  });

  it('second candidate with same content as first is detected as duplicate', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const content = 'Specific unique content for duplicate detection across batch here.';
    const c1 = makeCandidate({ content });
    const c2 = makeCandidate({ content });

    const result = curator.processBatch([c1, c2]);
    expect(result.promoted).toBe(1);
    expect(result.duplicates).toBe(1);
  });

  it('batch counting: flagged candidates counted separately', () => {
    const policy = makePolicy({
      rules: [
        {
          id: 'rule-relevance',
          type: 'relevance_score',
          action: 'flag',
          enabled: true,
          priority: 0,
          parameters: { minimumScore: 0.99 },
        },
      ],
    });
    deps.policyRepo.insert(policy);

    const curator = new Curator(deps, { tenantId: TENANT });
    // Minimal content → low score → flagged
    const flaggedCandidate = makeCandidate({
      title: 'x',
      content: 'short',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const result = curator.processBatch([flaggedCandidate]);
    expect(result.flagged).toBe(1);
    expect(result.promoted).toBe(0);
  });

  it('full pipeline: multiple candidates with varied outcomes', () => {
    const policy = makePolicy();
    deps.policyRepo.insert(policy);
    const curator = new Curator(deps, { tenantId: TENANT });

    const candidates = [
      makeCandidate({
        content: 'Use TypeScript strict mode always in this codebase for type safety benefits.',
      }),
      makeCandidate({
        content: 'AKIAIOSFODNN7EXAMPLE is the test AWS key for secret detection tests here.',
      }),
    ];

    const result = curator.processBatch(candidates);
    expect(result.processed).toBe(2);
    expect(result.promoted + result.rejected + result.flagged + result.duplicates).toBe(2);
  });
});
