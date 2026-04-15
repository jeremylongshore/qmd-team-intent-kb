import { describe, it, expect } from 'vitest';
import { evaluateSensitivityGate } from '../rules/sensitivity-gate-rule.js';
import { makeCandidate, makeContext } from './fixtures.js';

function makeRule(overrides?: Record<string, unknown>) {
  return {
    id: 'rule-sensitivity-gate',
    type: 'sensitivity_gate' as const,
    action: 'reject' as const,
    enabled: true,
    priority: 0,
    parameters: {},
    ...overrides,
  };
}

describe('evaluateSensitivityGate', () => {
  it('passes clean content', () => {
    const candidate = makeCandidate({
      content: 'Use dependency injection for all services in the codebase.',
    });
    const rule = makeRule();
    const result = evaluateSensitivityGate(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.ruleId).toBe(rule.id);
  });

  it('fails content with AWS key (restricted)', () => {
    const candidate = makeCandidate({
      content: 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE',
    });
    const rule = makeRule();
    const result = evaluateSensitivityGate(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('restricted');
  });

  it('fails content with email address (confidential)', () => {
    const candidate = makeCandidate({
      content: 'Contact alice@example.com for onboarding access.',
    });
    const rule = makeRule();
    const result = evaluateSensitivityGate(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('confidential');
  });

  it('passes content with /home/ path when internal is not in blockedLevels', () => {
    const candidate = makeCandidate({
      content: 'Config file is at /home/alice/projects/config.json',
    });
    const rule = makeRule(); // default blockedLevels: ['restricted', 'confidential']
    const result = evaluateSensitivityGate(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.reason).toContain('internal');
  });

  it('passes confidential content when custom blockedLevels only blocks restricted', () => {
    const candidate = makeCandidate({
      content: 'Contact alice@example.com for onboarding access.',
    });
    const rule = makeRule({ parameters: { blockedLevels: ['restricted'] } });
    const result = evaluateSensitivityGate(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
  });

  it('fails internal-path content when blockedLevels includes internal', () => {
    const candidate = makeCandidate({
      content: 'Config file is at /home/alice/projects/config.json',
    });
    const rule = makeRule({
      parameters: { blockedLevels: ['restricted', 'confidential', 'internal'] },
    });
    const result = evaluateSensitivityGate(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('internal');
  });
});
