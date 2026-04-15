import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import { PolicyPipeline } from '../pipeline.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCandidate(overrides?: Record<string, unknown>) {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations in the codebase',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  });
}

function makePolicy(rules: Record<string, unknown>[], overrides?: Record<string, unknown>) {
  return GovernancePolicy.parse({
    id: randomUUID(),
    name: 'Test Policy',
    tenantId: 'team-alpha',
    rules,
    enabled: true,
    version: 1,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  });
}

function makeRule(type: string, overrides?: Record<string, unknown>) {
  return {
    id: `rule-${type}`,
    type,
    action: 'reject',
    enabled: true,
    priority: 0,
    parameters: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PolicyPipeline', () => {
  it('approves a candidate that passes all rules', () => {
    const policy = makePolicy([makeRule('content_length'), makeRule('tenant_match')]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate();
    const result = pipeline.evaluate(candidate, { tenantId: 'team-alpha' });
    expect(result.outcome).toBe('approved');
    expect(result.candidateId).toBe(candidate.id);
    expect(result.rejectedBy).toBeUndefined();
    expect(result.flaggedBy).toBeUndefined();
  });

  it('rejects on first reject-action rule failure', () => {
    // tenant_match will fail because context tenantId doesn't match
    const policy = makePolicy([
      makeRule('tenant_match', { action: 'reject', priority: 0 }),
      makeRule('content_length', { priority: 1 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    const result = pipeline.evaluate(candidate, { tenantId: 'team-beta' });
    expect(result.outcome).toBe('rejected');
    expect(result.rejectedBy).toBe('rule-tenant_match');
  });

  it('short-circuits after rejection and does not evaluate remaining rules', () => {
    // First rule rejects. Second rule would also fail, but should never run.
    const policy = makePolicy([
      makeRule('tenant_match', { action: 'reject', priority: 0 }),
      // This rule would reject too, but we verify only 1 evaluation runs
      makeRule('content_length', { action: 'reject', priority: 1, parameters: { min: 999999 } }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    const result = pipeline.evaluate(candidate, { tenantId: 'team-beta' });
    expect(result.outcome).toBe('rejected');
    // Only the first rule ran — short-circuit happened before second rule
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0]?.ruleId).toBe('rule-tenant_match');
  });

  it('flags but does not reject on flag-action rule failure', () => {
    const policy = makePolicy([
      makeRule('tenant_match', { action: 'flag', priority: 0 }),
      makeRule('content_length', { action: 'reject', priority: 1 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    // tenantId mismatch → tenant_match flags; content_length passes
    const result = pipeline.evaluate(candidate, { tenantId: 'team-beta' });
    expect(result.outcome).toBe('flagged');
    expect(result.flaggedBy).toContain('rule-tenant_match');
    expect(result.rejectedBy).toBeUndefined();
  });

  it('returns all evaluations in execution order', () => {
    const policy = makePolicy([
      makeRule('content_length', { priority: 0 }),
      makeRule('tenant_match', { priority: 1 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate();
    const result = pipeline.evaluate(candidate, { tenantId: 'team-alpha' });
    expect(result.outcome).toBe('approved');
    expect(result.evaluations).toHaveLength(2);
    expect(result.evaluations[0]?.ruleId).toBe('rule-content_length');
    expect(result.evaluations[1]?.ruleId).toBe('rule-tenant_match');
  });

  it('skips disabled rules', () => {
    const policy = makePolicy([
      makeRule('tenant_match', { enabled: false, priority: 0 }),
      makeRule('content_length', { enabled: true, priority: 1 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    // tenant_match disabled — would have failed; only content_length runs
    const result = pipeline.evaluate(candidate, { tenantId: 'team-beta' });
    expect(result.outcome).toBe('approved');
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0]?.ruleId).toBe('rule-content_length');
  });

  it('sorts rules by priority (lower number = higher priority, runs first)', () => {
    // Assign priorities in reverse order to confirm sorting
    const policy = makePolicy([
      makeRule('content_length', { id: 'rule-low-priority', priority: 10 }),
      makeRule('tenant_match', { id: 'rule-high-priority', priority: 1 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate();
    const result = pipeline.evaluate(candidate, { tenantId: 'team-alpha' });
    expect(result.evaluations[0]?.ruleId).toBe('rule-high-priority');
    expect(result.evaluations[1]?.ruleId).toBe('rule-low-priority');
  });

  it('pipeline with only secret detection rule approves clean content', () => {
    const policy = makePolicy([makeRule('secret_detection')]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate();
    const result = pipeline.evaluate(candidate);
    expect(result.outcome).toBe('approved');
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0]?.outcome).toBe('pass');
  });

  it('pipeline with all rule types completes without error on well-formed candidate', () => {
    const policy = makePolicy([
      makeRule('secret_detection', { priority: 0 }),
      makeRule('content_length', { priority: 1 }),
      makeRule('source_trust', { priority: 2, parameters: { minimumTrust: 'low' } }),
      makeRule('relevance_score', { priority: 3, action: 'flag' }),
      makeRule('dedup_check', { priority: 4 }),
      makeRule('tenant_match', { priority: 5 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate();
    const result = pipeline.evaluate(candidate, { tenantId: 'team-alpha' });
    // All hard rules pass; relevance_score may flag (score depends on candidate shape)
    expect(['approved', 'flagged']).toContain(result.outcome);
    expect(result.evaluations).toHaveLength(6);
  });

  it('records rejectedBy ruleId on rejection', () => {
    const policy = makePolicy([
      makeRule('content_length', {
        id: 'length-guard',
        action: 'reject',
        parameters: { min: 99999 },
      }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate();
    const result = pipeline.evaluate(candidate);
    expect(result.outcome).toBe('rejected');
    expect(result.rejectedBy).toBe('length-guard');
  });

  it('records flaggedBy ruleIds including all flagging rules', () => {
    const policy = makePolicy([
      makeRule('relevance_score', {
        id: 'relevance-flag',
        action: 'flag',
        parameters: { minimumScore: 0.99 },
      }),
      makeRule('source_trust', {
        id: 'trust-flag',
        action: 'flag',
        parameters: { minimumTrust: 'high' },
      }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({ trustLevel: 'low' });
    const result = pipeline.evaluate(candidate);
    expect(result.outcome).toBe('flagged');
    expect(result.flaggedBy).toContain('relevance-flag');
    expect(result.flaggedBy).toContain('trust-flag');
  });

  it('full integration: candidate with secrets gets rejected', () => {
    const policy = makePolicy([
      makeRule('secret_detection', { action: 'reject', priority: 0 }),
      makeRule('content_length', { action: 'reject', priority: 1 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({
      content: 'API key is AKIAIOSFODNN7EXAMPLE — store safely',
    });
    const result = pipeline.evaluate(candidate);
    expect(result.outcome).toBe('rejected');
    expect(result.rejectedBy).toBe('rule-secret_detection');
  });

  it('full integration: clean candidate with good metadata gets approved', () => {
    const policy = makePolicy([
      makeRule('secret_detection', { action: 'reject', priority: 0 }),
      makeRule('content_length', { action: 'reject', priority: 1 }),
      makeRule('tenant_match', { action: 'reject', priority: 2 }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({
      content: 'Always wrap async boundaries in try/catch and convert to Result<T, E>.',
    });
    const result = pipeline.evaluate(candidate, { tenantId: 'team-alpha' });
    expect(result.outcome).toBe('approved');
    expect(result.rejectedBy).toBeUndefined();
  });

  it('full integration: low-relevance candidate gets flagged', () => {
    const policy = makePolicy([
      makeRule('relevance_score', {
        action: 'flag',
        priority: 0,
        parameters: { minimumScore: 0.9 },
      }),
    ]);
    const pipeline = new PolicyPipeline(policy);
    // Minimal candidate — title + category only → score ~0.4
    const candidate = makeCandidate({
      title: 'note',
      content: 'Short note.', // <= 50 chars
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const result = pipeline.evaluate(candidate);
    expect(result.outcome).toBe('flagged');
    expect(result.flaggedBy).toContain('rule-relevance_score');
  });

  it('context with existingHashes triggers dedup rejection', () => {
    const content = 'Use Result<T, E> for all fallible operations in the codebase';
    const policy = makePolicy([makeRule('dedup_check', { action: 'reject' })]);
    const pipeline = new PolicyPipeline(policy);
    const candidate = makeCandidate({ content });
    const existingHashes = new Set([computeContentHash(content)]);
    const result = pipeline.evaluate(candidate, { existingHashes });
    expect(result.outcome).toBe('rejected');
    expect(result.rejectedBy).toBe('rule-dedup_check');
  });
});
