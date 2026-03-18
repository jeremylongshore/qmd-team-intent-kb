import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import { evaluateDedupCheck } from '../rules/dedup-check-rule.js';
import type { EvaluationContext } from '../types.js';

const CLEAN_CONTENT = 'Use Result<T, E> for all fallible operations in the codebase';

function makeCandidate(content = CLEAN_CONTENT) {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content,
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: '2026-01-15T10:00:00.000Z',
  });
}

function makeRule() {
  return {
    id: 'rule-dedup-check',
    type: 'dedup_check' as const,
    action: 'reject' as const,
    enabled: true,
    priority: 0,
    parameters: {},
  };
}

function makeContext(candidate: MemoryCandidate, existingHashes?: Set<string>): EvaluationContext {
  return {
    candidate,
    existingHashes,
    policy: GovernancePolicy.parse({
      id: randomUUID(),
      name: 'Test Policy',
      tenantId: 'team-alpha',
      rules: [makeRule()],
      enabled: true,
      version: 1,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    }),
  };
}

describe('evaluateDedupCheck', () => {
  it('detects exact duplicate via hash match', () => {
    const candidate = makeCandidate(CLEAN_CONTENT);
    const existingHashes = new Set([computeContentHash(CLEAN_CONTENT)]);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, existingHashes));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('Exact duplicate detected');
  });

  it('passes unique content not in existing hashes', () => {
    const candidate = makeCandidate('This is unique content that does not exist yet');
    const existingHashes = new Set([computeContentHash(CLEAN_CONTENT)]);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, existingHashes));
    expect(result.outcome).toBe('pass');
  });

  it('passes when no existingHashes are provided', () => {
    const candidate = makeCandidate(CLEAN_CONTENT);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, undefined));
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('skipped');
  });

  it('passes when existingHashes is an empty set', () => {
    const candidate = makeCandidate(CLEAN_CONTENT);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, new Set()));
    expect(result.outcome).toBe('pass');
  });

  it('reports the hash in the failure reason', () => {
    const candidate = makeCandidate(CLEAN_CONTENT);
    const expectedHash = computeContentHash(CLEAN_CONTENT);
    const existingHashes = new Set([expectedHash]);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, existingHashes));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain(expectedHash);
  });
});
