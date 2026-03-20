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
import { makeCandidate, TENANT } from './fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(db: Database.Database): CuratorDependencies {
  return {
    candidateRepo: new CandidateRepository(db),
    memoryRepo: new MemoryRepository(db),
    policyRepo: new PolicyRepository(db),
    auditRepo: new AuditRepository(db),
  };
}

// ---------------------------------------------------------------------------
// Intra-batch dedup tests
// ---------------------------------------------------------------------------

describe('Curator.processBatch — intra-batch duplicate detection', () => {
  let deps: CuratorDependencies;

  beforeEach(() => {
    const db = createTestDatabase();
    deps = makeDeps(db);
  });

  it('second candidate with identical content is detected as intra-batch duplicate', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const sharedContent = 'Intra-batch dedup test: unique content string here abc123xyz.';
    const c1 = makeCandidate({ content: sharedContent });
    const c2 = makeCandidate({ content: sharedContent });

    const result = curator.processBatch([c1, c2]);

    expect(result.promoted).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.results[0]?.outcome).toBe('promoted');
    expect(result.results[1]?.outcome).toBe('duplicate');
  });

  it('intra-batch duplicate reason mentions intra-batch (dry-run mode)', () => {
    // In dry-run mode, promote() does not insert to the store, so checkDuplicate
    // (store-based) will NOT find the first candidate. The second candidate is
    // caught by the intra-batch existingHashes set instead, which does contain
    // the hash added after the first promotion completes.
    const curator = new Curator(deps, { tenantId: TENANT, dryRun: true });
    const content = 'Specific content to verify intra-batch reason message here.';
    const c1 = makeCandidate({ content });
    const c2 = makeCandidate({ content });

    const result = curator.processBatch([c1, c2]);

    const dupResult = result.results[1];
    expect(dupResult?.outcome).toBe('duplicate');
    expect(dupResult?.reason).toMatch(/intra-batch/i);
  });

  it('distinct candidates both get promoted (no false dedup)', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const c1 = makeCandidate({
      content: 'First distinct content for testing batch promotion candidate A.',
    });
    const c2 = makeCandidate({
      content: 'Second distinct content for testing batch promotion candidate B.',
    });

    const result = curator.processBatch([c1, c2]);

    expect(result.promoted).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(result.results[0]?.outcome).toBe('promoted');
    expect(result.results[1]?.outcome).toBe('promoted');
  });

  it('hash set grows after each promotion — third identical candidate is also a duplicate', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const content = 'Triple duplicate content for intra-batch hash set growth test here.';
    const c1 = makeCandidate({ content });
    const c2 = makeCandidate({ content });
    const c3 = makeCandidate({ content });

    const result = curator.processBatch([c1, c2, c3]);

    expect(result.promoted).toBe(1);
    expect(result.duplicates).toBe(2);
    expect(result.results[0]?.outcome).toBe('promoted');
    expect(result.results[1]?.outcome).toBe('duplicate');
    expect(result.results[2]?.outcome).toBe('duplicate');
  });

  it('intra-batch dedup does not affect candidates with different content', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const contentA = 'Unique content for candidate alpha in dedup test suite here.';
    const contentB = 'Unique content for candidate beta in dedup test suite here.';
    const contentC = contentA; // duplicate of A

    const cA = makeCandidate({ content: contentA });
    const cB = makeCandidate({ content: contentB });
    const cC = makeCandidate({ content: contentC });

    const result = curator.processBatch([cA, cB, cC]);

    expect(result.promoted).toBe(2); // A and B both promoted
    expect(result.duplicates).toBe(1); // C is dup of A
    expect(result.results[0]?.outcome).toBe('promoted'); // A
    expect(result.results[1]?.outcome).toBe('promoted'); // B
    expect(result.results[2]?.outcome).toBe('duplicate'); // C
  });

  it('hash set starts from store — existing memory blocks intra-batch first candidate', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const content = 'Content already in store before batch runs here for dedup check.';

    // Pre-populate the store with a memory having this hash
    const existing = makeCandidate({ content });
    // Use Curator to promote it so the store has the hash
    curator.processSingle(existing);
    expect(deps.memoryRepo.count()).toBe(1);

    // Now batch-process a candidate with the same content
    const batchCandidate = makeCandidate({ content });
    const result = curator.processBatch([batchCandidate]);

    // Should be detected as a duplicate (cross-session dedup, not intra-batch)
    expect(result.duplicates).toBe(1);
    expect(result.promoted).toBe(0);
  });

  it('hash set is updated correctly — content hash of promoted item matches expected', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const content = 'Hash set update verification: content used to verify tracking here.';
    const c1 = makeCandidate({ content });
    const c2 = makeCandidate({ content }); // same content — should be blocked

    curator.processBatch([c1, c2]);

    // Only one memory in store — dedup prevented the second
    expect(deps.memoryRepo.count()).toBe(1);
    const hashes = deps.memoryRepo.getAllContentHashes();
    expect(hashes).toContain(computeContentHash(content));
  });

  it('empty batch returns zero duplicates', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const result = curator.processBatch([]);
    expect(result.duplicates).toBe(0);
    expect(result.promoted).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('single-item batch never produces intra-batch duplicate', () => {
    const curator = new Curator(deps, { tenantId: TENANT });
    const c = makeCandidate({
      content: 'Only one candidate in this batch so no intra-batch dup possible.',
    });
    const result = curator.processBatch([c]);
    expect(result.duplicates).toBe(0);
    expect(result.promoted).toBe(1);
  });
});
