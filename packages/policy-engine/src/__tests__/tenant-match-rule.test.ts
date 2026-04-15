import { describe, it, expect } from 'vitest';
import { evaluateTenantMatch } from '../rules/tenant-match-rule.js';
import { makeCandidate, makeContext } from './fixtures.js';

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

describe('evaluateTenantMatch', () => {
  it('passes when candidate and context tenants match', () => {
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    const rule = makeRule();
    const result = evaluateTenantMatch(
      candidate,
      rule,
      makeContext(candidate, { tenantId: 'team-alpha' }),
    );
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('team-alpha');
  });

  it('rejects when candidate and context tenants mismatch', () => {
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    const rule = makeRule();
    const result = evaluateTenantMatch(
      candidate,
      rule,
      makeContext(candidate, { tenantId: 'team-beta' }),
    );
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('team-alpha');
    expect(result.reason).toContain('team-beta');
  });

  it('passes when no tenantId is set in context', () => {
    const candidate = makeCandidate({ tenantId: 'team-alpha' });
    const rule = makeRule();
    const result = evaluateTenantMatch(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('not active');
  });

  it('reports both candidate and expected tenants in failure reason', () => {
    const candidate = makeCandidate({ tenantId: 'org-x' });
    const rule = makeRule();
    const result = evaluateTenantMatch(
      candidate,
      rule,
      makeContext(candidate, { tenantId: 'org-y' }),
    );
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
      const candidate = makeCandidate({ tenantId: fmt });
      const rule = makeRule();
      const result = evaluateTenantMatch(
        candidate,
        rule,
        makeContext(candidate, { tenantId: fmt }),
      );
      expect(result.outcome).toBe('pass');
    }
  });
});
