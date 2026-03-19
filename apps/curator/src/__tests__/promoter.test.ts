import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, MemoryRepository, AuditRepository } from '@qmd-team-intent-kb/store';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { PipelineResult } from '@qmd-team-intent-kb/policy-engine';
import { promote } from '../promotion/promoter.js';
import { makeCandidate, makeCuratedMemory, TENANT } from './fixtures.js';

function makePipelineResult(overrides?: Partial<PipelineResult>): PipelineResult {
  return {
    candidateId: randomUUID(),
    outcome: 'approved',
    evaluations: [],
    ...overrides,
  };
}

describe('promote', () => {
  let memoryRepo: MemoryRepository;
  let auditRepo: AuditRepository;

  beforeEach(() => {
    const db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
    auditRepo = new AuditRepository(db);
  });

  it('creates a CuratedMemory from candidate with correct fields', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const pipelineResult = makePipelineResult({ candidateId: candidate.id });

    const memory = promote({ candidate, contentHash, pipelineResult }, memoryRepo, auditRepo);

    expect(memory.candidateId).toBe(candidate.id);
    expect(memory.content).toBe(candidate.content);
    expect(memory.title).toBe(candidate.title);
    expect(memory.category).toBe(candidate.category);
    expect(memory.trustLevel).toBe(candidate.trustLevel);
    expect(memory.tenantId).toBe(candidate.tenantId);
  });

  it('sets lifecycle to active', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );
    expect(memory.lifecycle).toBe('active');
  });

  it('generates a valid UUID for the memory ID', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );
    expect(memory.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('preserves the content hash from input', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );
    expect(memory.contentHash).toBe(contentHash);
  });

  it('sets promotedBy to system/curator', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );
    expect(memory.promotedBy).toEqual({ type: 'system', id: 'curator' });
  });

  it('converts pipeline evaluations to PolicyEvaluation records', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const pipelineResult = makePipelineResult({
      evaluations: [
        { ruleId: 'rule-secret', ruleType: 'secret_detection', outcome: 'pass', reason: 'Clean' },
        { ruleId: 'rule-length', ruleType: 'content_length', outcome: 'pass', reason: 'OK' },
      ],
    });

    const memory = promote({ candidate, contentHash, pipelineResult }, memoryRepo, auditRepo);

    expect(memory.policyEvaluations).toHaveLength(2);
    expect(memory.policyEvaluations[0]?.ruleId).toBe('rule-secret');
    expect(memory.policyEvaluations[0]?.result).toBe('pass');
    expect(memory.policyEvaluations[1]?.ruleId).toBe('rule-length');
  });

  it('inserts memory into store', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );

    expect(memoryRepo.count()).toBe(1);
    expect(memoryRepo.findById(memory.id)).not.toBeNull();
  });

  it('records a promotion audit event', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );

    const events = auditRepo.findByMemory(memory.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('promoted');
    expect(events[0]?.tenantId).toBe(TENANT);
  });

  it('handles supersession: marks old memory as superseded with link', () => {
    const old = makeCuratedMemory({ title: 'Error handling guide', category: 'convention' });
    memoryRepo.insert(old);

    const candidate = makeCandidate({
      title: 'Error handling guide updated',
      category: 'convention',
    });
    const contentHash = computeContentHash(candidate.content);
    const supersession = {
      supersededMemoryId: old.id,
      supersededTitle: old.title,
      similarity: 0.75,
    };

    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult(), supersession },
      memoryRepo,
      auditRepo,
    );

    const updatedOld = memoryRepo.findById(old.id);
    expect(updatedOld?.lifecycle).toBe('superseded');
    expect(updatedOld?.supersession?.supersededBy).toBe(memory.id);
    expect(updatedOld?.supersession?.reason).toContain('0.75');
  });

  it('creates a supersession audit event for the old memory', () => {
    const old = makeCuratedMemory({ title: 'Error handling guide', category: 'convention' });
    memoryRepo.insert(old);

    const candidate = makeCandidate({ title: 'Error handling guide v2', category: 'convention' });
    const contentHash = computeContentHash(candidate.content);
    const supersession = {
      supersededMemoryId: old.id,
      supersededTitle: old.title,
      similarity: 0.8,
    };

    promote(
      { candidate, contentHash, pipelineResult: makePipelineResult(), supersession },
      memoryRepo,
      auditRepo,
    );

    const events = auditRepo.findByMemory(old.id);
    const supersededEvent = events.find((e) => e.action === 'superseded');
    expect(supersededEvent).toBeDefined();
    expect(supersededEvent?.tenantId).toBe(TENANT);
  });

  it('dry run does not insert memory into store', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
      true, // dryRun
    );

    expect(memoryRepo.count()).toBe(0);
  });

  it('dry run does not record audit events', () => {
    const candidate = makeCandidate({ tenantId: TENANT });
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
      true, // dryRun
    );

    expect(auditRepo.findByTenant(TENANT)).toHaveLength(0);
    // Memory object is still returned
    expect(memory.candidateId).toBe(candidate.id);
  });

  it('dry run still returns a valid CuratedMemory', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
      true,
    );
    expect(memory.lifecycle).toBe('active');
    expect(memory.contentHash).toBe(contentHash);
  });

  it('new memory has no supersession link (it is the superseder)', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );
    expect(memory.supersession).toBeUndefined();
  });

  // Additional: promotion timestamp is set
  it('sets promotedAt and updatedAt to a valid ISO datetime', () => {
    const candidate = makeCandidate();
    const contentHash = computeContentHash(candidate.content);
    const before = new Date().toISOString();
    const memory = promote(
      { candidate, contentHash, pipelineResult: makePipelineResult() },
      memoryRepo,
      auditRepo,
    );
    const after = new Date().toISOString();
    expect(memory.promotedAt >= before).toBe(true);
    expect(memory.promotedAt <= after).toBe(true);
    expect(memory.updatedAt).toBe(memory.promotedAt);
  });
});
