import { describe, it, expect } from 'vitest';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import { evaluateDedupCheck } from '../rules/dedup-check-rule.js';
import { makeCandidate, makeContext, DEFAULT_CONTENT } from './fixtures.js';

const CLEAN_CONTENT = DEFAULT_CONTENT;

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

describe('evaluateDedupCheck', () => {
  it('detects exact duplicate via hash match', () => {
    const candidate = makeCandidate();
    const existingHashes = new Set([computeContentHash(CLEAN_CONTENT)]);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, { existingHashes }));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('Exact duplicate detected');
  });

  it('passes unique content not in existing hashes', () => {
    const candidate = makeCandidate({ content: 'This is unique content that does not exist yet' });
    const existingHashes = new Set([computeContentHash(CLEAN_CONTENT)]);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, { existingHashes }));
    expect(result.outcome).toBe('pass');
  });

  it('passes when no existingHashes are provided', () => {
    const candidate = makeCandidate();
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('skipped');
  });

  it('passes when existingHashes is an empty set', () => {
    const candidate = makeCandidate();
    const rule = makeRule();
    const result = evaluateDedupCheck(
      candidate,
      rule,
      makeContext(candidate, { existingHashes: new Set() }),
    );
    expect(result.outcome).toBe('pass');
  });

  it('reports the hash in the failure reason', () => {
    const candidate = makeCandidate();
    const expectedHash = computeContentHash(CLEAN_CONTENT);
    const existingHashes = new Set([expectedHash]);
    const rule = makeRule();
    const result = evaluateDedupCheck(candidate, rule, makeContext(candidate, { existingHashes }));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain(expectedHash);
  });
});
