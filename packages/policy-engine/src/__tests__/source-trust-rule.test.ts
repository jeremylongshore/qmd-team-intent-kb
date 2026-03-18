import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { evaluateSourceTrust } from '../rules/source-trust-rule.js';
import type { EvaluationContext } from '../types.js';

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

function makeRule(parameters: Record<string, unknown> = {}, action: 'reject' | 'flag' = 'reject') {
  return {
    id: 'rule-source-trust',
    type: 'source_trust' as const,
    action,
    enabled: true,
    priority: 0,
    parameters,
  };
}

function makeContext(candidate: MemoryCandidate): EvaluationContext {
  return {
    candidate,
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

describe('evaluateSourceTrust', () => {
  it('passes high trust when minimum is low', () => {
    const candidate = makeCandidate({ trustLevel: 'high' });
    const rule = makeRule({ minimumTrust: 'low' });
    const result = evaluateSourceTrust(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.score).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
  });

  it('fails untrusted when minimum is medium', () => {
    const candidate = makeCandidate({ trustLevel: 'untrusted' });
    const rule = makeRule({ minimumTrust: 'medium' });
    const result = evaluateSourceTrust(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('untrusted');
    expect(result.reason).toContain('medium');
  });

  it('uses default minimum of low when not specified', () => {
    // 'low' trust against default minimum 'low' — should pass
    const candidate = makeCandidate({ trustLevel: 'low' });
    const rule = makeRule({});
    const result = evaluateSourceTrust(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
  });

  it('handles all trust levels in correct order', () => {
    const levels = ['untrusted', 'low', 'medium', 'high'] as const;
    // With minimumTrust='medium', only medium and high should pass
    for (const level of levels) {
      const candidate = makeCandidate({ trustLevel: level });
      const rule = makeRule({ minimumTrust: 'medium' });
      const result = evaluateSourceTrust(candidate, rule, makeContext(candidate));
      if (level === 'medium' || level === 'high') {
        expect(result.outcome).toBe('pass');
      } else {
        expect(result.outcome).toBe('fail');
      }
    }
  });

  it('returns a trust score on pass', () => {
    const candidate = makeCandidate({ trustLevel: 'high' });
    const rule = makeRule({ minimumTrust: 'low' });
    const result = evaluateSourceTrust(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    // high = 4/4 = 1.0
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('uses rule.action to determine fail outcome: flag action yields flag outcome', () => {
    const candidate = makeCandidate({ trustLevel: 'untrusted' });
    const rule = makeRule({ minimumTrust: 'high' }, 'flag');
    const result = evaluateSourceTrust(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
  });
});
