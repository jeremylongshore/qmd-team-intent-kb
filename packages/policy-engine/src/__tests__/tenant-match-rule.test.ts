import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { evaluateTenantMatch } from '../rules/tenant-match-rule.js';
import type { EvaluationContext } from '../types.js';

function makeCandidate(tenantId = 'team-alpha') {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations in the codebase',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId,
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: '2026-01-15T10:00:00.000Z',
  });
}

function makeRule() {
  return {
    id: 'rule-tenant-match',
    type: 'tenant_match' as const,
    action: 'reject' as const,
    enabled: true,
    priority: 0,
    parameters: {},
  };
}

function makeContext(candidate: MemoryCandidate, tenantId?: string): EvaluationContext {
  return {
    candidate,
    tenantId,
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

describe('evaluateTenantMatch', () => {
  it('passes when candidate and context tenants match', () => {
    const candidate = makeCandidate('team-alpha');
    const rule = makeRule();
    const result = evaluateTenantMatch(candidate, rule, makeContext(candidate, 'team-alpha'));
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('team-alpha');
  });

  it('rejects when candidate and context tenants mismatch', () => {
    const candidate = makeCandidate('team-alpha');
    const rule = makeRule();
    const result = evaluateTenantMatch(candidate, rule, makeContext(candidate, 'team-beta'));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('team-alpha');
    expect(result.reason).toContain('team-beta');
  });

  it('passes when no tenantId is set in context', () => {
    const candidate = makeCandidate('team-alpha');
    const rule = makeRule();
    const result = evaluateTenantMatch(candidate, rule, makeContext(candidate, undefined));
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('not active');
  });

  it('reports both candidate and expected tenants in failure reason', () => {
    const candidate = makeCandidate('org-x');
    const rule = makeRule();
    const result = evaluateTenantMatch(candidate, rule, makeContext(candidate, 'org-y'));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('org-x');
    expect(result.reason).toContain('org-y');
  });

  it('works with various tenant ID formats', () => {
    const formats = [
      'simple',
      'team-with-dashes',
      'org_with_underscores',
      'UPPERCASE',
      'mixed-Case-123',
    ] as const;

    for (const fmt of formats) {
      const candidate = makeCandidate(fmt);
      const rule = makeRule();
      const result = evaluateTenantMatch(candidate, rule, makeContext(candidate, fmt));
      expect(result.outcome).toBe('pass');
    }
  });
});
